// Per-IP rate limits, counted separately for each endpoint ("bucket").
//
// Each bucket has its own counter. Before v0.3 all endpoints shared one counter per IP, so a tester
// who asked a few chat questions and did the check was then blocked from sending feedback. Testers
// on the same Wi-Fi share one IP, so a group session hit the limit within minutes (P0 found in
// internal QA, see research/04-internal-qa.md).

export function createRateLimiter({ windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return function limited(ip, bucket, max) {
    const key = `${bucket}|${ip}`;
    const t = now();
    const h = hits.get(key);
    if (!h || t > h.reset) {
      hits.set(key, { count: 1, reset: t + windowMs });
      if (hits.size > 50_000) for (const [k, v] of hits) if (t > v.reset) hits.delete(k); // keep memory bounded
      return false;
    }
    h.count++;
    return h.count > max;
  };
}

// Limits per IP per 10 minutes. Raise them for an in-person test where everyone shares one Wi-Fi.
export function rateLimits(env = process.env) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    ask: n(env.RATE_LIMIT_ASK, 60),
    check: n(env.RATE_LIMIT_CHECK, 120),
    feedback: n(env.RATE_LIMIT_FEEDBACK, 40),
  };
}
