import { expect, test } from "bun:test";
import { createRateLimiter } from "../src/rate-limit";

test("rate limiter: limit terlampaui → ditolak dengan retryAfter", () => {
  let clock = 0;
  const limiter = createRateLimiter({ limit: 3, windowMs: 10_000, now: () => clock });

  expect(limiter.check("ip-1")).toEqual({ ok: true, remaining: 2, retryAfterMs: 0 });
  expect(limiter.check("ip-1").remaining).toBe(1);
  expect(limiter.check("ip-1").remaining).toBe(0);

  const blocked = limiter.check("ip-1");
  expect(blocked.ok).toBe(false);
  expect(blocked.retryAfterMs).toBeGreaterThan(0);

  // Kunci lain tidak terpengaruh.
  expect(limiter.check("ip-2").ok).toBe(true);
});

test("rate limiter: jendela bergeser (sliding window)", () => {
  let clock = 0;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => clock });

  expect(limiter.check("k").ok).toBe(true);
  expect(limiter.check("k").ok).toBe(true);
  expect(limiter.check("k").ok).toBe(false);

  clock += 1_001;
  expect(limiter.check("k").ok).toBe(true);
});

test("rate limiter: reset per kunci dan menyeluruh", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
  expect(limiter.check("a").ok).toBe(true);
  expect(limiter.check("a").ok).toBe(false);
  limiter.reset("a");
  expect(limiter.check("a").ok).toBe(true);
  limiter.reset();
  expect(limiter.check("b").ok).toBe(true);
});

test("rate limiter: opsi invalid ditolak", () => {
  expect(() => createRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
  expect(() => createRateLimiter({ limit: 1, windowMs: -5 })).toThrow();
});
