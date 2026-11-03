// Knowledge base: doctor-approved Q&As loaded from knowledge-base/kb.csv.
// The bot may ONLY answer from these entries.

import { readFileSync } from 'node:fs';
import { parseCSV } from './csv.js';

export const REQUIRED_FIELDS = ['id', 'topic', 'question', 'answer', 'urgency', 'next_step', 'source', 'status'];
export const URGENCY_LEVELS = ['routine', 'soon', 'today'];

// allowDraft=false (for real users) loads only entries a doctor has set to 'approved'.
export function loadKB(path, { allowDraft = true } = {}) {
  const rows = parseCSV(readFileSync(path, 'utf8'));
  return rows.filter((r) => r.id && r.status !== 'retired' && (allowDraft || r.status === 'approved'));
}

// Text block placed in the model's system prompt.
export function kbForPrompt(entries) {
  return entries
    .map(
      (e) =>
        `<entry id="${e.id}" topic="${e.topic}" urgency="${e.urgency}">\n` +
        `Q: ${e.question}\nA: ${e.answer}\nNext step: ${e.next_step}\n</entry>`
    )
    .join('\n');
}

const STOP = new Set([
  'the', 'and', 'for', 'are', 'can', 'what', 'how', 'is', 'it', 'my', 'do', 'does', 'to', 'of', 'in',
  'a', 'an', 'i', 'me', 'you', 'be', 'if', 'or', 'with', 'have', 'has', 'should', 'this', 'that', 'on',
  'there', 'here', 'hello', 'hi', 'hey', 'best', 'buy', 'get', 'will',
  'юу', 'вэ', 'уу', 'үү', 'бэ', 'нь', 'би', 'та', 'миний', 'гэж', 'байна', 'болох', 'хэрхэн',
]);

export function tokenize(text) {
  return (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1 && !STOP.has(w));
}

// Fallback used when no LLM key is configured: picks the single best-matching entry.
export function keywordMatch(entries, text) {
  const words = tokenize(text);
  let best = null;
  let bestScore = 0;
  for (const e of entries) {
    const kw = new Set(tokenize(e.keywords || ''));
    const hay = new Set(tokenize(`${e.keywords || ''} ${e.question} ${e.topic}`));
    let score = 0;
    for (const w of words) {
      if (hay.has(w)) score += w.length > 3 || kw.has(w) ? 2 : 1; // short terms (HPV, STI, IUD) count fully only if listed as keywords
      else if (w.length > 4 && [...hay].some((h) => h.length > 4 && (h.startsWith(w.slice(0, 5)) || w.startsWith(h.slice(0, 5))))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return bestScore >= 2 ? best : null;
}
