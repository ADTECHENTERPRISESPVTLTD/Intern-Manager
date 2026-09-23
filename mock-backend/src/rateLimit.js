/** Small in-memory sliding-window limiter, keyed by whatever the caller passes (e.g. an email + IP). */
export function createRateLimiter({ limit, windowMs }) {
  const hits = new Map(); // key -> timestamps[]

  return {
    /** Records an attempt for `key`. Returns { allowed, retryAfterSeconds }. */
    hit(key) {
      const now = Date.now();
      const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (list.length >= limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - list[0])) / 1000));
        hits.set(key, list);
        return { allowed: false, retryAfterSeconds };
      }
      list.push(now);
      hits.set(key, list);
      return { allowed: true };
    },
    /** Call after a *successful* attempt so a genuine login isn't penalised by earlier typos. */
    reset(key) {
      hits.delete(key);
    },
  };
}
