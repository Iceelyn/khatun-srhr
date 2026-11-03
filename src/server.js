// Naiz server: Messenger webhook + web chat + private check page + tester feedback + team results page.
// No dependencies beyond Node.js 20+.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadKB } from './kb.js';
import { createAnswerer } from './answer.js';
import { triage } from './triage.js';
import { createMessenger, verifySignature, parseEvents } from './messenger.js';
import { createMetrics, summarizeEvents } from './metrics.js';
import { createStore } from './store.js';
import { toCSV } from './csv.js';
import { analyzeFeedback } from './llm.js';
import { validateTesterFeedback, validateTriage, validateInterview, summarizeFeedback, TASKS, RATINGS, TEXTS } from './feedback.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const config = {
  port: Number(process.env.PORT || 3000),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  llmKey: process.env.ANTHROPIC_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'claude-sonnet-5-5',
  verifyToken: process.env.FB_VERIFY_TOKEN || '',
  appSecret: process.env.FB_APP_SECRET || '',
  pageToken: process.env.FB_PAGE_TOKEN || '',
  graphVersion: process.env.FB_GRAPH_VERSION || 'v21.0',
  statsToken: process.env.STATS_TOKEN || '',
  // Protects the team results page and its APIs. Falls back to STATS_TOKEN.
  teamToken: process.env.TEAM_TOKEN || process.env.STATS_TOKEN || '',
  metricsPath: process.env.METRICS_PATH || join(ROOT, 'data', 'metrics.jsonl'),
  dataDir: process.env.DATA_DIR || join(ROOT, 'data'),
  // Optional cloud database (recommended when hosted). Server-side key only.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
};

// Set APPROVED_ONLY=true before any real user sees the bot.
const approvedOnly = process.env.APPROVED_ONLY === 'true';
const kb = loadKB(join(ROOT, 'knowledge-base', 'kb.csv'), { allowDraft: !approvedOnly });
if (!approvedOnly) console.warn('WARNING: draft (unreviewed) knowledge-base entries are loaded. Set APPROVED_ONLY=true for real users.');
const clinics = JSON.parse(readFileSync(join(ROOT, 'data', 'clinics.json'), 'utf8'));
const answer = createAnswerer({ kb, apiKey: config.llmKey, model: config.llmModel });
const db = (table, file) => createStore({ table, path: join(config.dataDir, file), supabaseUrl: config.supabaseUrl, supabaseKey: config.supabaseKey });
const events = createStore({ table: 'events', path: config.metricsPath, supabaseUrl: config.supabaseUrl, supabaseKey: config.supabaseKey });
const feedbackDB = db('tester_feedback', 'feedback.jsonl');
const interviewDB = db('interviews', 'interviews.jsonl');
const metrics = createMetrics(events);
if (events.kind === 'file') console.warn('Storage: local files in data/. On free hosting these are wiped on restart; set SUPABASE_URL and SUPABASE_SERVICE_KEY to keep tester feedback.');
const messenger = config.pageToken ? createMessenger(config) : null;

// --- small helpers -------------------------------------------------------

const STATIC = {
  '/': ['chat.html', 'text/html; charset=utf-8'],
  '/chat': ['chat.html', 'text/html; charset=utf-8'],
  '/check': ['check.html', 'text/html; charset=utf-8'],
  '/feedback': ['feedback.html', 'text/html; charset=utf-8'],
  '/results': ['results.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Simple per-IP rate limit for the public web endpoints (protects the AI budget).
const hits = new Map();
function rateLimited(req, max = 30, windowMs = 10 * 60 * 1000) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  h.count++;
  return h.count > max;
}

// Team-only endpoints need the TEAM_TOKEN in an "x-team-token" header.
function isTeam(req) {
  if (!config.teamToken) return false;
  const given = Buffer.from(String(req.headers['x-team-token'] || ''));
  const want = Buffer.from(config.teamToken);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function readJSON(req, limit) {
  try {
    return JSON.parse((await readBody(req, limit)).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

const FEEDBACK_COLUMNS = ['id', 'created_at', 'role', 'age_group', 'platform', ...TASKS, ...RATINGS, ...TEXTS, 'category', 'priority', 'moscow', 'status', 'team_note'];
const INTERVIEW_COLUMNS = ['id', 'created_at', 'code', 'grp', 'method', 'month', 'key_points', 'quote', 'themes'];

function readSurveySummary() {
  const p = join(ROOT, 'research', 'survey-summary.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function routeTeam(req, res, path) {
  if (!config.teamToken) return send(res, 503, { error: 'Set TEAM_TOKEN on the server to use the results page.' });
  if (!isTeam(req)) return send(res, 403, { error: 'Wrong team token.' });

  if (req.method === 'GET' && path === '/api/team/overview') {
    const [fb, iv, ev] = await Promise.all([feedbackDB.list(), interviewDB.list(), events.list()]);
    return send(res, 200, {
      feedback: summarizeFeedback(fb),
      interviews: { n: iv.length, by_group: iv.reduce((o, r) => ((o[r.grp] = (o[r.grp] || 0) + 1), o), {}) },
      usage: summarizeEvents(ev, kb),
      survey: readSurveySummary(),
      storage: feedbackDB.kind,
      ai: Boolean(config.llmKey),
    });
  }

  const m = path.match(/^\/api\/team\/(feedback|interviews)(?:\/([\w-]+))?$/);
  if (m) {
    const [, kind, id] = m;
    const store = kind === 'feedback' ? feedbackDB : interviewDB;
    if (req.method === 'GET' && !id) return send(res, 200, await store.list());
    if (req.method === 'DELETE' && id) return send(res, 200, { ok: await store.remove(id) });
    if (req.method === 'PATCH' && id && kind === 'feedback') {
      const updated = await store.update(id, validateTriage(await readJSON(req, 10_000)));
      return updated ? send(res, 200, updated) : send(res, 404, { error: 'not found' });
    }
    if (req.method === 'POST' && !id && kind === 'interviews') {
      const { row, error } = validateInterview(await readJSON(req, 20_000));
      if (error) return send(res, 400, { error });
      return send(res, 200, await store.insert(row));
    }
  }

  const csv = path.match(/^\/api\/team\/export\/(feedback|interviews)\.csv$/);
  if (req.method === 'GET' && csv) {
    const rows = await (csv[1] === 'feedback' ? feedbackDB : interviewDB).list();
    const cols = csv[1] === 'feedback' ? FEEDBACK_COLUMNS : INTERVIEW_COLUMNS;
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="naiz-${csv[1]}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    });
    return res.end('\ufeff' + toCSV(rows, cols)); // BOM so Excel shows Mongolian correctly
  }

  if (req.method === 'POST' && path === '/api/team/analyze') {
    if (!config.llmKey) return send(res, 400, { error: 'Add ANTHROPIC_API_KEY to use the AI analyzer.' });
    const [fb, iv] = await Promise.all([feedbackDB.list(), interviewDB.list()]);
    const items = [
      ...fb
        .filter((r) => TEXTS.some((t) => r[t]))
        .map((r, i) => {
          const ratings = RATINGS.filter((k) => r[k]).map((k) => `${k.replace('rate_', '')}=${r[k]}`).join(' ');
          const text = TEXTS.filter((t) => r[t]).map((t) => `${t}: ${r[t]}`).join(' | ');
          return `[tester ${i + 1}, ${r.role}${ratings ? ', ' + ratings : ''}] ${text}`;
        }),
      ...iv.map((r) => `[interview ${r.code}, ${r.grp}] ${r.key_points}${r.quote ? ' | quote: "' + r.quote + '"' : ''}`),
    ].slice(0, 200);
    if (!items.length) return send(res, 400, { error: 'No written feedback or interview notes yet.' });
    const report = await analyzeFeedback({ items, apiKey: config.llmKey, model: config.llmModel });
    return send(res, 200, { report, items: items.length });
  }

  return send(res, 404, { error: 'not found' });
}

// --- Messenger -----------------------------------------------------------

const WELCOME =
  'Сайн уу! Би Найз. Бэлгийн болон нөхөн үржихүйн эрүүл мэндийн талаар юу ч асуугаарай. Хариулт бүрийг эмч хянадаг. Таны нэрийг асуухгүй.\n\n' +
  "Hi! I'm Naiz. Ask me anything about sexual and reproductive health. Every answer is reviewed by doctors. I'll never ask your name.";

async function handleMessengerEvent(ev) {
  if (ev.postback) {
    await messenger.sendText(ev.psid, WELCOME);
    return;
  }
  const result = await answer(ev.text);
  metrics.log({ ev: 'question', ch: 'messenger', refs: result.refs, flag: result.flag, mode: result.mode });
  await messenger.sendText(ev.psid, result.text);
  if (!result.flag) {
    await messenger.sendButtons(ev.psid, 'Дараагийн алхам · Next step', [
      { type: 'web_url', url: `${config.publicUrl}/check`, title: 'Шалгалт · Check' },
      { type: 'web_url', url: `${config.publicUrl}/check#clinics`, title: 'Эмнэлэг · Clinics' },
    ]);
  }
}

// --- router --------------------------------------------------------------

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET' && STATIC[path]) {
    const [file, type] = STATIC[path];
    return send(res, 200, readFileSync(join(ROOT, 'public', file)), type);
  }

  if (path === '/health') return send(res, 200, { ok: true, kb_entries: kb.length, ai: Boolean(config.llmKey) });

  // Messenger webhook verification
  if (req.method === 'GET' && path === '/webhook') {
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      config.verifyToken &&
      url.searchParams.get('hub.verify_token') === config.verifyToken;
    return ok ? send(res, 200, url.searchParams.get('hub.challenge') || '', 'text/plain') : send(res, 403, 'forbidden', 'text/plain');
  }

  // Messenger incoming messages
  if (req.method === 'POST' && path === '/webhook') {
    const raw = await readBody(req);
    if (!verifySignature(raw, req.headers['x-hub-signature-256'], config.appSecret)) return send(res, 401, 'bad signature', 'text/plain');
    send(res, 200, 'EVENT_RECEIVED', 'text/plain'); // reply fast, process after
    if (!messenger) return;
    const body = JSON.parse(raw.toString('utf8'));
    for (const ev of parseEvents(body)) {
      handleMessengerEvent(ev).catch((err) => console.error('event failed:', err.message));
    }
    return;
  }

  // Web chat (used for user testing without Facebook app review)
  if (req.method === 'POST' && path === '/api/ask') {
    if (rateLimited(req)) return send(res, 429, { error: 'Too many questions. Please wait a few minutes.' });
    const { q } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    if (!q || !String(q).trim()) return send(res, 400, { error: 'empty question' });
    const result = await answer(q);
    metrics.log({ ev: 'question', ch: 'web', refs: result.refs, flag: result.flag, mode: result.mode });
    return send(res, 200, { answer: result.text, refs: result.refs, flag: result.flag });
  }

  if (req.method === 'POST' && path === '/api/feedback') {
    const { helpful, refs } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    metrics.log({ ev: 'feedback', helpful: Boolean(helpful), refs: Array.isArray(refs) ? refs.slice(0, 5) : [] });
    return send(res, 200, { ok: true });
  }

  // Private check: answers are processed in memory and NOT stored; only the result level is counted.
  if (req.method === 'POST' && path === '/api/check') {
    if (rateLimited(req, 60)) return send(res, 429, { error: 'Too many requests.' });
    const answers = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const result = triage(answers);
    metrics.log({ ev: 'check', level: result.level });
    return send(res, 200, result);
  }

  if (req.method === 'GET' && path === '/api/clinics') {
    const sorted = [...clinics].sort((a, b) => Number(b.free) - Number(a.free));
    return send(res, 200, sorted);
  }

  if (req.method === 'GET' && path === '/api/stats') {
    if (config.statsToken && url.searchParams.get('token') !== config.statsToken) return send(res, 403, { error: 'forbidden' });
    return send(res, 200, await metrics.summary(kb));
  }

  // Tester feedback form (anonymous, insert-only: testers can add but never read feedback)
  if (req.method === 'POST' && path === '/api/tester-feedback') {
    if (rateLimited(req, 10)) return send(res, 429, { error: 'Too many submissions. Please wait a few minutes.' });
    const { row, error } = validateTesterFeedback(await readJSON(req, 20_000), req.headers['user-agent']);
    if (error) return send(res, 400, { error });
    await feedbackDB.insert(row);
    return send(res, 200, { ok: true });
  }

  if (path.startsWith('/api/team/')) return routeTeam(req, res, path);

  return send(res, 404, { error: 'not found' });
}

createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error(err.message);
    if (!res.headersSent) send(res, 500, { error: 'server error' });
  });
}).listen(config.port, () => {
  console.log(`Naiz running on ${config.publicUrl} | ${kb.length} knowledge-base entries | AI: ${config.llmKey ? config.llmModel : 'off (keyword fallback)'}`);
});
