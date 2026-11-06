// Usage: npm run survey -- research/raw/survey.csv
// Reads the raw survey export (which stays in research/raw/, never committed) and writes
// anonymous counts to research/survey-summary.md and research/survey-summary.json.
// Those two files are safe to commit and are shown on the team results page.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/csv.js';
import { summarizeSurvey, surveyToMarkdown } from '../src/survey.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run survey -- research/raw/survey.csv');
  process.exit(1);
}

const text = readFileSync(input, 'utf8');
const rows = parseCSV(text);
const columns = Object.keys(rows[0] || {});
const summary = summarizeSurvey(rows, columns);

writeFileSync(join(ROOT, 'research', 'survey-summary.json'), JSON.stringify(summary, null, 2) + '\n');
writeFileSync(join(ROOT, 'research', 'survey-summary.md'), surveyToMarkdown(summary));

console.log(`Survey: ${summary.respondents} responses, ${summary.questions.length} questions.`);
if (summary.dropped_columns.length) console.log(`Removed identity columns: ${summary.dropped_columns.join(', ')}`);
for (const q of summary.questions.filter((q) => q.type === 'open')) console.log(`Written answers (theme by hand): ${q.question}`);
console.log('Wrote research/survey-summary.md and research/survey-summary.json. Check them before committing.');
