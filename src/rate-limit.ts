export interface RateLimitResult {
  /** true bila request masih di bawah limit. */
  ok: boolean;
  /** Sisa kuota pada jendela saat ini (0 bila ditolak). */
  remaining: number;
  /** Waktu tunggu (ms) sampai slot berikutnya tersedia (0 bila ok). */
  retryAfterMs: number;
}

export interface RateLimiterOptions {
  /** Jumlah maksimum request per jendela. */
  limit: number;
  /** Panjang jendela dalam milidetik. */
  windowMs: number;
  /** Sumber waktu (untuk test). Default: `Date.now`. */
  now?: () => number;
}

export interface RateLimiter {
  /**
   * Catat satu request untuk `key` dan kembalikan status kuota.
   * Sliding window in-memory — satu instance proses; untuk multi-instance,
   * simpan status di store bersama (mis. Redis) dan pakai hasil `check` ini
   * sebagai kontrak bentuk.
   */
  check(key: string): RateLimitResult;
  /** Hapus riwayat `key` (mis. setelah login sukses), atau semua tanpa argumen. */
  reset(key?: string): void;
}

/**
 * Rate limiter sliding-window sederhana (in-memory).
 * Dipakai untuk membatasi `serverFn`/endpoint per kunci (IP, user, route).
 * Jalan di Bun & Node; tanpa dependency.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  if (
    !Number.isFinite(options.limit) ||
    options.limit <= 0 ||
    !Number.isFinite(options.windowMs) ||
    options.windowMs <= 0
  ) {
    throw new Error("[moons] createRateLimiter: `limit` dan `windowMs` harus angka positif");
  }
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const time = now();
      const windowStart = time - options.windowMs;
      let timestamps = hits.get(key);
      if (timestamps === undefined) {
        timestamps = [];
        hits.set(key, timestamps);
      }
      // Buang timestamp di luar jendela (array selalu terurut naik).
      let drop = 0;
      while (drop < timestamps.length && (timestamps[drop] as number) <= windowStart) {
        drop += 1;
      }
      if (drop > 0) {
        timestamps.splice(0, drop);
      }

      if (timestamps.length >= options.limit) {
        const oldest = timestamps[0] as number;
        return {
          ok: false,
          remaining: 0,
          retryAfterMs: Math.max(1, oldest + options.windowMs - time),
        };
      }

      timestamps.push(time);
      return { ok: true, remaining: options.limit - timestamps.length, retryAfterMs: 0 };
    },
    reset(key?: string): void {
      if (key === undefined) {
        hits.clear();
        return;
      }
      hits.delete(key);
    },
  };
}
