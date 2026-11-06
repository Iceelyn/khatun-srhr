import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { scrubPII, validateTesterFeedback, validateTriage, validateInterview, summarizeFeedback, platformFrom } from '../src/feedback.js';
import { summarizeSurvey, surveyToMarkdown } from '../src/survey.js';
import { createStore } from '../src/store.js';
import { createMetrics, summarizeEvents } from '../src/metrics.js';
import { parseCSV } from '../src/csv.js';

test('scrubPII removes emails, phone numbers, links and handles', () => {
  const out = scrubPII('call me 9911 2233 or +976 88112233, a@b.mn, fb.com/someone, @anu.b ok');
  assert.ok(!/\d{4}/.test(out), out);
  assert.ok(!out.includes('a@b.mn'));
  assert.ok(!out.includes('someone'));
  assert.ok(!out.includes('@anu'));
  assert.ok(out.endsWith('ok'));
});

test('tester feedback: consent required, values whitelisted, text scrubbed', () => {
  assert.equal(validateTesterFeedback({ rate_easy: 5 }).error, 'consent required');
  const { row } = validateTesterFeedback(
    { consent: true, role: 'hacker', task_chat: 'easy', task_check: 'nope', rate_easy: 5, rate_trust: 9, confusing: 'text me 99112233' },
    'Mozilla/5.0 (Linux; Android 14)'
  );
  assert.equal(row.role, 'other');
  assert.equal(row.task_chat, 'easy');
  assert.equal(row.task_check, 'skipped');
  assert.equal(row.rate_easy, 5);
  assert.equal(row.rate_trust, null);
  assert.equal(row.platform, 'android');
  assert.equal(row.status, 'new');
  assert.ok(row.confusing.includes('[number removed]'));
  assert.equal(validateTesterFeedback({ consent: true }).error, 'empty feedback');
});

test('triage and interview validation', () => {
  assert.deepEqual(validateTriage({ priority: 'P0', status: 'hacked', other: 1 }), { priority: 'P0', status: 'new' });
  assert.ok(validateInterview({ code: 'Anu Bat', grp: 'parent', consent: true, key_points: 'x' }).error);
  assert.ok(validateInterview({ code: 'W01', grp: 'young_woman', key_points: 'x' }).error, 'needs consent');
  const { row } = validateInterview({ code: 'w01', grp: 'young_woman', method: 'phone', month: '2026-11', consent: true, key_points: 'Afraid her mother would find out.' });
  assert.equal(row.code, 'W01');
});

test('feedback summary: top-2-box ratings, task success and open P0/P1', () => {
  const rows = [
    { role: 'young_woman', rate_easy: 5, rate_trust: 3, task_chat: 'easy', task_check: 'failed', task_clinic: 'skipped', priority: 'P0', status: 'new' },
    { role: 'young_woman', rate_easy: 4, task_chat: 'hard', task_check: 'easy', task_clinic: 'easy', priority: 'P1', status: 'fixed' },
    { role: 'health_worker', rate_easy: 2, task_chat: 'failed', task_check: 'easy', task_clinic: 'easy' },
  ];
  const s = summarizeFeedback(rows);
  assert.equal(s.n, 3);
  assert.equal(s.ratings.rate_easy.top2, 2);
  assert.equal(s.ratings.rate_easy.top2_pct, 67);
  assert.equal(s.ratings.rate_trust.n, 1);
  assert.equal(s.tasks.task_chat.success_pct, 67);
  assert.equal(s.tasks.task_clinic.tried, 2);
  assert.equal(s.open_p0_p1, 1);
});

test('survey summary: drops identity columns, handles single, tick-all, scale and open questions', () => {
  const csv = [
    'Timestamp,Email address,Have you visited a gynecologist?,Where do you get information?,Would you use it?,What would help?',
    '2026/11/01,a@b.mn,Never,"Friends, Facebook groups",5,Being anonymous',
    '2026/11/01,c@d.mn,Once,Facebook groups,4,Female doctor nearby',
    '2026/11/02,e@f.mn,Never,"Friends, TikTok or YouTube",2,Lower cost and evening hours',
  ].join('\n');
  const s = summarizeSurvey(parseCSV(csv));
  assert.equal(s.respondents, 3);
  assert.deepEqual(s.dropped_columns, ['Timestamp', 'Email address']);
  const [visited, info, use, help] = s.questions;
  assert.equal(visited.type, 'single');
  assert.deepEqual(visited.options[0], { option: 'Never', count: 2, pct: 67 });
  assert.equal(info.type, 'multi');
  assert.equal(info.options.find((o) => o.option === 'Facebook groups').count, 2);
  assert.equal(use.type, 'scale');
  assert.equal(use.top2_pct, 67);
  assert.equal(help.type, 'open');
  const md = surveyToMarkdown(s, '2026-11-03');
  assert.ok(md.includes('Small sample'));
  assert.ok(!md.includes('Female doctor nearby'), 'written answers must not be copied');
  assert.ok(!md.includes('a@b.mn'));
});

test('file store: insert, list, update, remove; metrics summary', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'naiz-'));
  const store = createStore({ table: 't', path: join(dir, 'x.jsonl') });
  const a = await store.insert({ v: 1 });
  await store.insert({ v: 2 });
  assert.equal((await store.list()).length, 2);
  assert.equal((await store.update(a.id, { v: 9 })).v, 9);
  assert.equal(await store.remove(a.id), true);
  assert.equal((await store.list()).length, 1);

  const ev = createStore({ table: 'events', path: join(dir, 'ev.jsonl') });
  const m = createMetrics(ev);
  m.log({ ev: 'question', mode: 'llm', refs: ['k1'], text: 'should not be stored' });
  m.log({ ev: 'check', level: 'soon' });
  await new Promise((r) => setTimeout(r, 20));
  const rows = await ev.list();
  assert.ok(rows.every((r) => !('text' in r)), 'message text is never stored');
  const s = summarizeEvents(rows, [{ id: 'k1', topic: 'hpv' }]);
  assert.equal(s.questions, 1);
  assert.equal(s.topics.hpv, 1);
  assert.equal(s.check_levels.soon, 1);
  assert.equal(platformFrom('iPhone'), 'ios');
});
