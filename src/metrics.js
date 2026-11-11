// Anonymous usage log. Stores NO message text, names or Facebook IDs:
// only the event type, channel, which knowledge-base entries were used,
// red-flag type, answer mode, check result level and thumbs up/down.

const FIELDS = ['ev', 'ch', 'refs', 'flag', 'mode', 'level', 'helpful'];

export function createMetrics(store) {
  return {
    log(event) {
      const row = {};
      for (const f of FIELDS) if (event[f] !== undefined && event[f] !== null) row[f] = event[f];
      store.insert(row).catch((err) => console.error('metrics write failed:', err.message));
    },
    async summary(kb) {
      return summarizeEvents(await store.list(), kb);
    },
  };
}

export function summarizeEvents(rows, kb = []) {
  const topicOf = new Map(kb.map((e) => [e.id, e.topic]));
  const out = { questions: 0, checks: 0, red_flags: {}, topics: {}, check_levels: {}, feedback: { helpful: 0, not_helpful: 0 }, modes: {} };
  const inc = (obj, k) => (obj[k] = (obj[k] || 0) + 1);
  for (const e of rows) {
    if (e.ev === 'question') {
      out.questions++;
      if (e.mode) inc(out.modes, e.mode);
      if (e.flag) inc(out.red_flags, e.flag);
      for (const r of e.refs || []) inc(out.topics, topicOf.get(r) || 'unknown');
    } else if (e.ev === 'check') {
      out.checks++;
      inc(out.check_levels, e.level);
    } else if (e.ev === 'feedback') {
      out.feedback[e.helpful ? 'helpful' : 'not_helpful']++;
    }
  }
  return out;
}
