import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCSV, toCSV } from '../src/csv.js';
import { loadKB, keywordMatch, REQUIRED_FIELDS, URGENCY_LEVELS } from '../src/kb.js';
import { checkRedFlags } from '../src/safety.js';
import { triage } from '../src/triage.js';
import { extractRefs } from '../src/llm.js';
import { verifySignature, parseEvents } from '../src/messenger.js';
import { createAnswerer } from '../src/answer.js';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRateLimiter, rateLimits } from '../src/ratelimit.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const kb = loadKB(join(ROOT, 'knowledge-base', 'kb.csv'));

test('CSV round-trips commas, quotes and newlines', () => {
  const rows = [{ a: 'x, y', b: 'he said "hi"', c: 'line1\nline2' }];
  assert.deepEqual(parseCSV(toCSV(rows, ['a', 'b', 'c'])), rows);
});

test('knowledge base: every entry is complete and valid', () => {
  assert.ok(kb.length >= 30, `expected 30+ entries, got ${kb.length}`);
  const ids = new Set();
  for (const e of kb) {
    for (const f of REQUIRED_FIELDS) assert.ok(e[f], `${e.id} missing ${f}`);
    assert.ok(URGENCY_LEVELS.includes(e.urgency), `${e.id} bad urgency ${e.urgency}`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
  }
});

test('red flags: self-harm, assault, violence and emergencies are caught (EN + MN)', () => {
  assert.equal(checkRedFlags('I want to end my life')?.id, 'self_harm');
  assert.equal(checkRedFlags('би амиа хорломоор байна')?.id, 'self_harm');
  assert.equal(checkRedFlags('he raped me last night')?.id, 'assault');
  assert.equal(checkRedFlags('намайг хүчиндсэн')?.id, 'assault');
  assert.equal(checkRedFlags('my boyfriend beats me')?.id, 'violence');
  assert.equal(checkRedFlags('heavy bleeding and dizzy')?.id, 'emergency');
});

test('red flags: ordinary questions and lookalike words are not flagged', () => {
  assert.equal(checkRedFlags('Is my discharge normal?'), null);
  assert.equal(checkRedFlags('I ate grapes and have itching'), null);
  assert.equal(checkRedFlags('ХПВ вакцин аюулгүй юу?'), null);
});

test('triage: no risk and no symptoms means no test needed', () => {
  assert.equal(triage({ age: 20, sexuallyActive: false, symptoms: [], lastSTITest: 'never' }).level, 'none');
});

test('triage: symptoms mean testing within days, with a swab', () => {
  const r = triage({ age: 22, sexuallyActive: true, symptoms: ['discharge_change'], lastSTITest: 'within1y' });
  assert.equal(r.level, 'soon');
  assert.ok(r.tests.includes('swab'));
});

test('triage: fever with pelvic pain means today', () => {
  assert.equal(triage({ age: 24, symptoms: ['pelvic_pain'], fever: true }).level, 'today');
});

test('triage: sexually active and never tested means a routine check with swab and blood', () => {
  const r = triage({ age: 21, sexuallyActive: true, symptoms: [], lastSTITest: 'never' });
  assert.equal(r.level, 'routine');
  assert.ok(r.tests.includes('swab') && r.tests.includes('blood'));
});

test('triage: cervical screening only offered at 30-60', () => {
  assert.ok(triage({ age: 34, lastScreening: 'never' }).tests.includes('cervical_screening'));
  assert.ok(!triage({ age: 24, lastScreening: 'never' }).tests.includes('cervical_screening'));
});

test('triage: assault always means today with emergency care', () => {
  const r = triage({ age: 19, assault: true });
  assert.equal(r.level, 'today');
  assert.equal(r.special, 'assault');
});

test('triage: under-18 users get the youth note', () => {
  assert.equal(triage({ age: 16, sexuallyActive: true, lastSTITest: 'never' }).youth, true);
});

test('model refs are stripped from the reply and kept for audit', () => {
  const { clean, refs } = extractRefs('Chlamydia is common.\n[ref: chlamydia, sti-when-test]');
  assert.equal(clean, 'Chlamydia is common.');
  assert.deepEqual(refs, ['chlamydia', 'sti-when-test']);
});

test('keyword fallback finds the right entry in English and Mongolian', () => {
  assert.equal(keywordMatch(kb, 'what is syphilis')?.id, 'syphilis');
  assert.equal(keywordMatch(kb, 'тэмбүү эдгэрдэг үү')?.id, 'syphilis');
  assert.equal(keywordMatch(kb, 'does the hpv vaccine cause infertility')?.id, 'hpv-vaccine-fertility');
  // Regressions found in internal QA (research/04-internal-qa.md): keyword ties sent these to the wrong entry.
  assert.equal(keywordMatch(kb, 'My boyfriend checks my phone and gets angry. Is that normal?')?.id, 'healthy-relationship');
  assert.equal(keywordMatch(kb, 'ХПВ вакцин үргүйдэл үүсгэдэг үү?')?.id, 'hpv-vaccine-fertility');
});

test('answerer: red flag bypasses the model; unknown question gets a safe fallback', async () => {
  const answer = createAnswerer({ kb, apiKey: '', model: 'none' });
  const a = await answer('I want to kill myself');
  assert.equal(a.mode, 'red_flag');
  assert.match(a.text, /1800-2000/);
  const b = await answer('what is the best phone to buy');
  assert.equal(b.mode, 'no_match');
});

test('Messenger: signature check accepts valid and rejects forged bodies', () => {
  const body = Buffer.from('{"object":"page"}');
  const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(verifySignature(body, sig, 'secret'), true);
  assert.equal(verifySignature(body, sig, 'other'), false);
  assert.equal(verifySignature(body, undefined, 'secret'), false);
});

test('Messenger: events are parsed and echoes ignored', () => {
  const evs = parseEvents({
    entry: [{ messaging: [
      { sender: { id: '1' }, message: { text: 'hi' } },
      { sender: { id: '2' }, message: { text: 'echo', is_echo: true } },
      { sender: { id: '3' }, postback: { payload: 'GET_STARTED' } },
    ] }],
  });
  assert.deepEqual(evs, [{ psid: '1', text: 'hi' }, { psid: '3', postback: 'GET_STARTED' }]);
});

test('rate limit: endpoints count separately, so chatting never blocks the feedback form', () => {
  let t = 0;
  const limited = createRateLimiter({ windowMs: 1000, now: () => t });
  for (let i = 0; i < 50; i++) limited('1.2.3.4', 'ask', 60);
  assert.equal(limited('1.2.3.4', 'feedback', 10), false);
  for (let i = 0; i < 9; i++) limited('1.2.3.4', 'feedback', 10);
  assert.equal(limited('1.2.3.4', 'feedback', 10), true);
  assert.equal(limited('5.6.7.8', 'feedback', 10), false);
  t = 2000;
  assert.equal(limited('1.2.3.4', 'feedback', 10), false);
  assert.equal(rateLimits({ RATE_LIMIT_FEEDBACK: '200' }).feedback, 200);
  assert.equal(rateLimits({ RATE_LIMIT_FEEDBACK: 'x' }).feedback, 40);
});

test('eval routing: all 30 test questions reach the expected entry, red flag or safe no-answer', async () => {
  // eval/routing.csv was written after internal QA (research/04-internal-qa.md). Keyword mode, no AI key.
  const questions = new Map(parseCSV(readFileSync(join(ROOT, 'eval', 'questions.csv'), 'utf8')).map((q) => [q.id, q.question]));
  const answer = createAnswerer({ kb, apiKey: '', model: 'none' });
  const wrong = [];
  for (const r of parseCSV(readFileSync(join(ROOT, 'eval', 'routing.csv'), 'utf8'))) {
    const a = await answer(questions.get(r.id));
    const got = a.mode === 'red_flag' ? `red_flag:${a.flag}` : a.mode === 'no_match' ? 'no_match' : a.refs[0];
    if (got !== r.expected_route) wrong.push(`${r.id}: expected ${r.expected_route}, got ${got}`);
  }
  assert.deepEqual(wrong, []);
});

test('store: Supabase errors become plain fixes for the team', async () => {
  const { explainSupabaseError } = await import('../src/store.js');
  assert.match(explainSupabaseError('Supabase tester_feedback GET failed: 404 {"code":"PGRST205","message":"Could not find the table"}'), /schema\.sql/);
  assert.match(explainSupabaseError('Supabase events GET failed: 401 {"message":"Invalid API key"}'), /service_role/);
  assert.match(explainSupabaseError('fetch failed'), /SUPABASE_URL/);
});

test('store: common SUPABASE_URL and key copy-paste mistakes are cleaned up', async () => {
  const { normalizeSupabaseUrl, cleanKey, explainSupabaseError } = await import('../src/store.js');
  for (const raw of ['https://abcd.supabase.co', ' https://abcd.supabase.co/ ', 'https://abcd.supabase.co/rest/v1/', '"https://abcd.supabase.co"', 'abcd.supabase.co', 'https://supabase.com/dashboard/project/abcd/settings/api'])
    assert.equal(normalizeSupabaseUrl(raw), 'https://abcd.supabase.co', raw);
  assert.equal(cleanKey(' "eyJhb.c d"\n'), 'eyJhb.cd');
  assert.equal(cleanKey('Bearer eyJ'), 'eyJ');
  assert.match(explainSupabaseError('Supabase events GET failed: 403 {"code":"42501","message":"permission denied for table events"}'), /GRANT/);
  assert.match(explainSupabaseError('Supabase events GET failed: 404 {"code":"PGRST125","message":"Invalid path specified in request URL"}'), /Project URL/);
});

test('survey: validates, drops unknown values, scrubs text, and summarises', async () => {
  const { validateSurvey, summarizeSurveyResponses } = await import('../src/survey-form.js');
  assert.match(validateSurvey({ age_group: '21-24' }).error, /18/);
  assert.match(validateSurvey({ consent: true }).error, /How old/);
  const { row } = validateSurvey({
    consent: true, age_group: '21-24', location: 'mars', unchecked_worry: 'yes',
    barriers: ['ashamed', 'cost', 'hacked'], info_sources: ['facebook'], would_use_chat: '5',
    what_would_help: 'Call me on 9911 2233 or a@b.mn', name: 'Bat',
  });
  assert.equal(row.location, '');
  assert.deepEqual(row.barriers, ['ashamed', 'cost']);
  assert.equal(row.name, undefined);
  assert.doesNotMatch(row.what_would_help, /9911|a@b/);
  // Follow-up only counts when its condition is met
  assert.deepEqual(validateSurvey({ consent: true, age_group: '18-20', unchecked_worry: 'no', barriers: ['cost'] }).row.barriers, []);
  const s = summarizeSurveyResponses([row, { ...row, would_use_chat: '3', barriers: [] }]);
  assert.equal(s.respondents, 2);
  const use = s.questions.find((q) => q.id === 'would_use_chat');
  assert.equal(use.mean, 4);
  assert.equal(use.top2_pct, 50);
  const bar = s.questions.find((q) => q.id === 'barriers');
  assert.equal(bar.answered, 1);
  assert.equal(bar.options.find((o) => o.option === 'Cost').pct, 100);
});
