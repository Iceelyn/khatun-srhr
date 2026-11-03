// One question in, one safe answer out.
// Order: red flags (fixed reply) -> AI model grounded in the knowledge base -> keyword fallback.

import { checkRedFlags } from './safety.js';
import { kbForPrompt, keywordMatch } from './kb.js';
import { askLLM, extractRefs } from './llm.js';

const NO_ANSWER =
  'Энэ асуултад эмчийн хянасан хариулт одоогоор алга. Нууц шалгалтыг бөглөх эсвэл эмчид үзүүлэхийг зөвлөж байна.\n\n' +
  "I don't have a doctor-reviewed answer for that yet. Try the private check, or ask a doctor at a clinic.";

export function createAnswerer({ kb, apiKey, model }) {
  const kbText = kbForPrompt(kb);
  const byId = new Map(kb.map((e) => [e.id, e]));

  return async function answer(question) {
    const q = String(question || '').slice(0, 1000);

    const flag = checkRedFlags(q);
    if (flag) return { text: flag.reply, refs: [], flag: flag.id, mode: 'red_flag' };

    if (apiKey) {
      try {
        const raw = await askLLM({ question: q, kbText, apiKey, model });
        const { clean, refs } = extractRefs(raw);
        return { text: clean, refs: refs.filter((r) => byId.has(r)), flag: null, mode: 'llm' };
      } catch (err) {
        console.error('LLM error, using keyword fallback:', err.message);
      }
    }

    const hit = keywordMatch(kb, q);
    if (!hit) return { text: NO_ANSWER, refs: [], flag: null, mode: 'no_match' };
    return { text: `${hit.answer}\n\n${hit.next_step}`, refs: [hit.id], flag: null, mode: 'keyword' };
  };
}
