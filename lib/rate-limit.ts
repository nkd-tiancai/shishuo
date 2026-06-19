import { db } from "./db";

// ── Memory implementation ──

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterOptions {
  capacity: number;
  refillPerMinute: number;
}

export function rateLimiter({ capacity, refillPerMinute }: RateLimiterOptions) {
  const store = new Map<string, Bucket>();
  const refillRate = refillPerMinute / 60_000;
  const STALE_MS = 5 * 60_000;

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (now - bucket.lastRefill > STALE_MS) store.delete(key);
    }
  }, 60_000);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    (cleanupTimer as unknown as NodeJS.Timeout).unref();
  }

  return {
    async check(key: string): Promise<boolean> {
      const now = Date.now();
      let bucket = store.get(key);
      if (!bucket) { bucket = { tokens: capacity, lastRefill: now }; store.set(key, bucket); }
      const refill = (now - bucket.lastRefill) * refillRate;
      bucket.tokens = Math.min(capacity, bucket.tokens + refill);
      bucket.lastRefill = now;
      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
  };
}

// ── SQLite persistent implementation ──

class PersistentRateLimiter {
  private capacity: number;
  private refillRate: number;

  constructor(opts: RateLimiterOptions) {
    this.capacity = opts.capacity;
    this.refillRate = opts.refillPerMinute / 60_000;
  }

  async check(key: string): Promise<boolean> {
    const row = await db.rateLimitBucket.findUnique({ where: { key } });
    const now = Date.now();

    let tokens = this.capacity;
    let lastRefill = now;

    if (row) {
      const elapsed = now - row.lastRefill.getTime();
      tokens = Math.min(this.capacity, row.tokens + elapsed * this.refillRate);
      lastRefill = now;
    }

    if (tokens < 1) return false;
    tokens -= 1;

    await db.rateLimitBucket.upsert({
      where: { key },
      create: { key, tokens, lastRefill: new Date(lastRefill) },
      update: { tokens, lastRefill: new Date(lastRefill) },
    });
    return true;
  }
}

// ── Factory ──

const STORE = process.env.RATE_LIMIT_STORE === "sqlite" ? "sqlite" : "memory";

function makeLimiter(opts: RateLimiterOptions) {
  if (STORE === "sqlite") return new PersistentRateLimiter(opts);
  return rateLimiter(opts);
}

export const authLimiter = makeLimiter({ capacity: 5, refillPerMinute: 5 });
export const llmLimiter = makeLimiter({ capacity: 10, refillPerMinute: 10 });
export const configLimiter = makeLimiter({ capacity: 20, refillPerMinute: 20 });
