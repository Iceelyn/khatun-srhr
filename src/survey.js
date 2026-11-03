// Turns a Google Forms (or any) survey CSV export into anonymous counts and percentages.
// Identity columns (timestamp, email, name, phone) are dropped. Written answers are
// counted but never copied, because free text can identify people.

export const IDENTITY_COLUMN = /timestamp|хугацааны тэмдэг|e-?mail|имэйл|и-мэйл|^\s*(full\s+)?name\s*$|^\s*нэр\s*$|phone|утас/i;

const isScale = (vals) => vals.length > 0 && vals.every((v) => /^[1-5]$/.test(v));

export function summarizeSurvey(rows, columns = Object.keys(rows[0] || {})) {
  const questions = [];
  const dropped = [];
  for (const col of columns) {
    if (IDENTITY_COLUMN.test(col)) {
      dropped.push(col);
      continue;
    }
    const vals = rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean);
    const q = { question: col, answered: vals.length };
    const whole = new Set(vals);
    const parts = vals.flatMap((v) => v.split(/,\s+/).map((s) => s.trim()).filter(Boolean));
    const partSet = new Set(parts);

    if (isScale(vals)) {
      q.type = 'scale';
      q.options = ['1', '2', '3', '4', '5'].map((o) => count(o, vals.filter((v) => v === o).length, vals.length));
      q.mean = Math.round((vals.reduce((a, v) => a + Number(v), 0) / vals.length) * 10) / 10;
      q.top2_pct = pct(vals.filter((v) => Number(v) >= 4).length, vals.length);
    } else if (vals.some((v) => v.includes(', ')) && !looksWritten(vals, new Set()) && partSet.size <= 15 && partSet.size < parts.length) {
      q.type = 'multi'; // "tick all that apply": % of people who ticked each option
      q.options = [...partSet].map((o) => count(o, vals.filter((v) => v.split(/,\s+/).map((s) => s.trim()).includes(o)).length, vals.length));
    } else if (whole.size <= 12 && !looksWritten(vals, whole)) {
      q.type = 'single';
      q.options = [...whole].map((o) => count(o, vals.filter((v) => v === o).length, vals.length));
    } else {
      q.type = 'open'; // written answers: theme them by hand, don't publish them raw
    }
    if (q.options && q.type !== 'scale') q.options.sort((a, b) => b.count - a.count); // scales stay in 1-5 order
    questions.push(q);
  }
  return { respondents: rows.length, questions, dropped_columns: dropped };
}

// Written answers are usually long and all different. When unsure, treat a column as written
// (counted, not copied): losing a breakdown is better than publishing someone's words.
function looksWritten(vals, whole) {
  const avg = vals.reduce((a, v) => a + v.length, 0) / (vals.length || 1);
  const longest = Math.max(0, ...vals.map((v) => v.length));
  return avg > 40 || (vals.length >= 3 && whole.size === vals.length && longest > 20);
}

function pct(n, d) {
  return d ? Math.round((n / d) * 100) : null;
}
function count(option, n, d) {
  return { option, count: n, pct: pct(n, d) };
}

export function surveyToMarkdown(s, generatedAt = new Date().toISOString().slice(0, 10)) {
  const lines = [
    '# Online survey: summary (anonymous)',
    '',
    `Generated ${generatedAt} by \`npm run survey\` from the raw export (kept out of GitHub). Respondents: **${s.respondents}**.`,
  ];
  if (s.respondents < 30) lines.push('', `> Small sample (n = ${s.respondents}). Report it as an early signal, not as representative of all young women in Mongolia.`);
  if (s.dropped_columns.length) lines.push('', `Identity columns removed: ${s.dropped_columns.join(', ')}.`);
  s.questions.forEach((q, i) => {
    lines.push('', `## ${i + 1}. ${q.question}`, '', `Answered: ${q.answered} of ${s.respondents}`);
    if (q.type === 'open') {
      lines.push('', `${q.answered} written answers. Theme them by hand; don't publish them raw. Pick 1-2 short anonymous quotes for the findings.`);
      return;
    }
    if (q.type === 'multi') lines.push('', '_Tick-all question: percentages are of people who answered, so they add up to more than 100%._');
    if (q.type === 'scale') lines.push('', `Average ${q.mean} out of 5; ${q.top2_pct}% chose 4 or 5.`);
    lines.push('', '| Answer | Count | % |', '| --- | ---: | ---: |');
    for (const o of q.options) lines.push(`| ${o.option.replace(/\|/g, '/')} | ${o.count} | ${o.pct ?? ''}% |`);
  });
  return lines.join('\n') + '\n';
}
