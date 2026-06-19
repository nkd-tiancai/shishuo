import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimiter } from "../rate-limit";

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows requests up to capacity", async () => {
    const limiter = rateLimiter({ capacity: 5, refillPerMinute: 5 });
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("user-1")).toBe(true);
    }
    expect(await limiter.check("user-1")).toBe(false);
  });

  it("refills tokens over time", async () => {
    const limiter = rateLimiter({ capacity: 5, refillPerMinute: 5 });
    for (let i = 0; i < 5; i++) await limiter.check("user-1");
    expect(await limiter.check("user-1")).toBe(false);
    vi.advanceTimersByTime(60_000);
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("user-1")).toBe(true);
    }
    expect(await limiter.check("user-1")).toBe(false);
  });

  it("refills partially over time", async () => {
    const limiter = rateLimiter({ capacity: 10, refillPerMinute: 10 });
    for (let i = 0; i < 10; i++) await limiter.check("user-1");
    expect(await limiter.check("user-1")).toBe(false);
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("user-1")).toBe(true);
    }
    expect(await limiter.check("user-1")).toBe(false);
  });

  it("does not exceed capacity on refill", async () => {
    const limiter = rateLimiter({ capacity: 5, refillPerMinute: 5 });
    vi.advanceTimersByTime(10 * 60_000);
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check("user-1")).toBe(true);
    }
    expect(await limiter.check("user-1")).toBe(false);
  });

  it("independent keys have independent buckets", async () => {
    const limiter = rateLimiter({ capacity: 3, refillPerMinute: 3 });
    for (let i = 0; i < 3; i++) await limiter.check("user-1");
    expect(await limiter.check("user-1")).toBe(false);
    for (let i = 0; i < 3; i++) {
      expect(await limiter.check("user-2")).toBe(true);
    }
    expect(await limiter.check("user-2")).toBe(false);
  });
});
