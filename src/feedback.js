// Tester feedback and interview records: validation, privacy scrubbing and summaries.
//
// Follows the usability-testing method: testers do 3 fixed tasks, rate the experience 1-5,
// and leave short comments. The team then triages each comment by
// category (bug / usability / missing feature / enhancement), priority (P0-P3) and MoSCoW.

export const ROLES = ['young_woman', 'health_worker', 'parent', 'other'];
export const AGE_GROUPS = ['18-20', '21-24', '25-29', '30+'];
export const TASKS = ['task_chat', 'task_check', 'task_clinic'];
export const TASK_RESULTS = ['easy', 'hard', 'failed', 'skipped'];
export const RATINGS = ['rate_easy', 'rate_private', 'rate_trust', 'rate_would_test'];
export const TEXTS = ['liked', 'confusing', 'change'];

export const TRIAGE = {
  category: ['', 'bug', 'usability', 'missing_feature', 'enhancement', 'positive', 'not_actionable'],
  priority: ['', 'P0', 'P1', 'P2', 'P3'],
  moscow: ['', 'must', 'should', 'could', 'wont'],
  status: ['new', 'planned', 'fixed', 'wont_fix'],
};

export const INTERVIEW_GROUPS = ['young_woman', 'health_worker', 'parent'];
export const INTERVIEW_METHODS = ['in_person', 'phone', 'online'];

// Removes things that could identify someone if a tester types them by mistake.
export function scrubPII(text) {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email removed]')
    .replace(/https?:\/\/\S+|www\.\S+|(?:facebook|fb|instagram|tiktok)\.com\/\S+/gi, '[link removed]')
    .replace(/(^|\s)@[\w.]{3,}/g, '$1[handle removed]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number removed]')
    .trim();
}

const clip = (s, n) => scrubPII(s).slice(0, n);
const pick = (v, allowed, fallback = '') => (allowed.includes(v) ? v : fallback);

export function platformFrom(ua = '') {
  const s = String(ua).toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (s.includes('android')) return 'android';
  if (s.includes('windows')) return 'windows';
  if (s.includes('mac os')) return 'mac';
  if (s.includes('linux')) return 'linux';
  return 'other';
}

export function validateTesterFeedback(body = {}, userAgent = '') {
  if (body.consent !== true) return { error: 'consent required' };
  const row = {
    role: pick(body.role, ROLES, 'other'),
    age_group: pick(body.age_group, AGE_GROUPS, ''),
    platform: platformFrom(userAgent),
    source: 'web_form',
    consent: true,
  };
  for (const t of TASKS) row[t] = pick(body[t], TASK_RESULTS, 'skipped');
  for (const r of RATINGS) {
    const n = Number(body[r]);
    row[r] = Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  }
  for (const t of TEXTS) row[t] = clip(body[t], 600);
  const answered = RATINGS.some((r) => row[r] !== null) || TEXTS.some((t) => row[t]) || TASKS.some((t) => row[t] !== 'skipped');
  if (!answered) return { error: 'empty feedback' };
  Object.assign(row, { category: '', priority: '', moscow: '', status: 'new', team_note: '' });
  return { row };
}

export function validateTriage(body = {}) {
  const patch = {};
  for (const [k, allowed] of Object.entries(TRIAGE)) if (k in body) patch[k] = pick(body[k], allowed, allowed[0]);
  if ('team_note' in body) patch.team_note = clip(body.team_note, 500);
  return patch;
}

export function validateInterview(body = {}) {
  const code = String(body.code || '').trim().toUpperCase();
  if (!/^[A-Z]{1,2}\d{1,3}$/.test(code)) return { error: 'Use an anonymous code like W01, H02 or P03 (never a name).' };
  if (body.consent !== true) return { error: 'Only record interviews where the person agreed to notes being taken.' };
  const month = String(body.month || '');
  const row = {
    code,
    grp: pick(body.grp, INTERVIEW_GROUPS, ''),
    method: pick(body.method, INTERVIEW_METHODS, ''),
    month: /^\d{4}-\d{2}$/.test(month) ? month : '',
    consent: true,
    key_points: clip(body.key_points, 1500),
    quote: clip(body.quote, 300),
    themes: clip(body.themes, 200),
  };
  if (!row.grp) return { error: 'Choose a group.' };
  if (!row.key_points) return { error: 'Add the key points.' };
  return { row };
}

export function summarizeFeedback(rows) {
  const out = { n: rows.length, roles: {}, platforms: {}, ratings: {}, tasks: {}, triage: { category: {}, priority: {}, status: {} }, open_p0_p1: 0 };
  const inc = (obj, k) => (obj[k || 'none'] = (obj[k || 'none'] || 0) + 1);
  for (const r of RATINGS) out.ratings[r] = { n: 0, sum: 0, top2: 0, mean: null, top2_pct: null };
  for (const t of TASKS) out.tasks[t] = { easy: 0, hard: 0, failed: 0, skipped: 0, success_pct: null };

  for (const row of rows) {
    inc(out.roles, row.role);
    inc(out.platforms, row.platform);
    for (const r of RATINGS) {
      const v = row[r];
      if (typeof v === 'number') {
        const s = out.ratings[r];
        s.n++;
        s.sum += v;
        if (v >= 4) s.top2++;
      }
    }
    for (const t of TASKS) inc(out.tasks[t], row[t] || 'skipped');
    inc(out.triage.category, row.category);
    inc(out.triage.priority, row.priority);
    inc(out.triage.status, row.status);
    if ((row.priority === 'P0' || row.priority === 'P1') && row.status !== 'fixed' && row.status !== 'wont_fix') out.open_p0_p1++;
  }
  for (const s of Object.values(out.ratings)) {
    if (s.n) {
      s.mean = Math.round((s.sum / s.n) * 10) / 10;
      s.top2_pct = Math.round((s.top2 / s.n) * 100);
    }
    delete s.sum;
  }
  for (const t of Object.values(out.tasks)) {
    const tried = t.easy + t.hard + t.failed;
    t.tried = tried;
    if (tried) t.success_pct = Math.round(((t.easy + t.hard) / tried) * 100);
  }
  return out;
}
