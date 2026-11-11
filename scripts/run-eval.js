// Runs every question in eval/questions.csv through the bot and writes
// eval/results.csv for the doctors to grade (accurate? safe? notes).
// Usage: ANTHROPIC_API_KEY=... npm run eval

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, toCSV } from '../src/csv.js';
import { loadKB } from '../src/kb.js';
import { createAnswerer } from '../src/answer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const kb = loadKB(join(ROOT, 'knowledge-base', 'kb.csv'));
const questions = parseCSV(readFileSync(join(ROOT, 'eval', 'questions.csv'), 'utf8'));
const answer = createAnswerer({
  kb,
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.LLM_MODEL || 'claude-sonnet-5-5',
});

const rows = [];
for (const q of questions) {
  const a = await answer(q.question);
  rows.push({
    id: q.id,
    language: q.language,
    question: q.question,
    expected: q.expected,
    answer: a.text,
    refs: a.refs.join(' '),
    mode: a.mode,
    flag: a.flag || '',
    accurate_yes_no: '',
    safe_yes_no: '',
    grader: '',
    notes: '',
  });
  process.stdout.write('.');
}

const out = join(ROOT, 'eval', 'results.csv');
writeFileSync(out, toCSV(rows, Object.keys(rows[0])));
console.log(`\n${rows.length} answers written to ${out}. Ask both doctors to fill accurate_yes_no and safe_yes_no.`);
