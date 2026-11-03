// Calls the language model. The model may only answer from the knowledge base.
// No names, phone numbers or Facebook IDs are ever sent to the model.

export function systemPrompt(kbText) {
  return `You are Naiz, a sexual and reproductive health information assistant for young women in Mongolia.

Rules:
1. Answer ONLY using the knowledge base entries below. If they don't cover the question, say you don't have a doctor-reviewed answer for that yet, and suggest the private check or a clinic visit.
2. Never diagnose. Never name specific medicines, brands or doses.
3. Reply in the language the user writes in: Mongolian Cyrillic, Mongolian written in Latin letters, or English.
4. Be warm, calm and non-judgmental. No moralising. Keep it under 120 words.
5. If a matching entry has urgency "today", tell the user clearly to see a doctor today.
6. Never ask for a name, phone number, address or any identifying detail.
7. End with the ids of the entries you used, in this exact form: [ref: entry-id, entry-id]

<knowledge_base>
${kbText}
</knowledge_base>`;
}

export async function askLLM({ question, kbText, apiKey, model }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: [{ type: 'text', text: systemPrompt(kbText), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const data = await res.json();
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export function extractRefs(text) {
  const refs = [];
  const clean = String(text)
    .replace(/\[ref:\s*([^\]]*)\]/gi, (_, ids) => {
      refs.push(...ids.split(',').map((s) => s.trim()).filter(Boolean));
      return '';
    })
    .trim();
  return { clean, refs };
}

// Feedback analyzer for the team dashboard: groups real tester comments and interview notes
// into themes. It only reorganises what was collected; it must never add data.
export async function analyzeFeedback({ items, apiKey, model }) {
  const system = `You help a small health-tech team analyse user-testing feedback for "Naiz", an anonymous sexual-health information service for young women in Mongolia.

You receive anonymised items: tester comments (with their 1-5 ratings) and interview key points. Items may be in Mongolian or English.

Write a short report in English:
1. Themes: group the items into 3-6 themes. For each: a name, how many items mention it (count them, e.g. "5 of 18 items"), and 1-2 short quotes copied word for word from the items (translate Mongolian quotes to English in brackets after them).
2. Issues to triage: list concrete problems. For each give a category (bug, usability, missing feature, enhancement) and a suggested priority (P0 = blocks the core journey, P1 = major pain with a workaround, P2 = minor, P3 = cosmetic), with one line of reasoning based on severity and frequency.
3. What is working: 1-3 points.
4. Caution: note the sample size and anything the data cannot show.

Rules: use only the items given. Never invent numbers, quotes or participants. If there are fewer than 5 items, say the sample is too small for themes and just list the points. Never guess anyone's identity or health status. These are suggestions; the team decides.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: `<items>\n${items.join('\n')}\n</items>` }],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}
