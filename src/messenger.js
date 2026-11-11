// Facebook Messenger Platform helpers.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = header.slice('sha256='.length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export function createMessenger({ pageToken, graphVersion }) {
  const url = `https://graph.facebook.com/${graphVersion}/me/messages?access_token=${encodeURIComponent(pageToken)}`;

  async function send(psid, message) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message }),
    });
    if (!res.ok) console.error('Messenger send failed:', res.status);
  }

  return {
    sendText: (psid, text) => send(psid, { text: String(text).slice(0, 2000) }),
    sendButtons: (psid, text, buttons) =>
      send(psid, {
        attachment: {
          type: 'template',
          payload: { template_type: 'button', text: String(text).slice(0, 640), buttons: buttons.slice(0, 3) },
        },
      }),
  };
}

// Pulls simple {psid, text, postback} events out of a webhook body.
export function parseEvents(body) {
  const events = [];
  for (const entry of body?.entry || []) {
    for (const m of entry.messaging || []) {
      const psid = m.sender?.id;
      if (!psid) continue;
      if (m.message?.text && !m.message.is_echo) events.push({ psid, text: m.message.text });
      else if (m.postback?.payload) events.push({ psid, postback: m.postback.payload });
    }
  }
  return events;
}
