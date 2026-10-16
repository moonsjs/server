import { AsyncLocalStorage } from "node:async_hooks";
import { stringify } from "devalue";

/** `ctx` per-request untuk panggilan loader → serverFn tanpa HTTP (§7.4). */
const storage = new AsyncLocalStorage<Ctx>();

export function getCurrentContext(): Ctx | undefined {
  return storage.getStore();
}

/** Jalankan `fn` dengan `ctx` aktif; dipakai runtime SSR (@moonsjs/vite/server). */
export function runWithContext<T>(ctx: Ctx, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Store memo per-request untuk `cache()` (Addendum B.5). */
const cacheStorage = new AsyncLocalStorage<Map<unknown, Map<string, Promise<unknown>>>>();

/** Jalankan `fn` dengan store cache request aktif (dipanggil runtime SSR). */
export function runWithRequestCache<T>(fn: () => T): T {
  return cacheStorage.run(new Map(), fn);
}

/**
 * Memo request-scoped (Addendum B.5): loader layout dan page yang memanggil
 * fungsi sama dengan argumen sama hanya mengeksekusi sekali per request.
 * Di luar request (tanpa store) → eksekusi langsung tanpa memo.
 */
export function cache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args: A): Promise<R> => {
    const store = cacheStorage.getStore();
    if (store === undefined) {
      return fn(...args);
    }
    let byKey = store.get(fn);
    if (byKey === undefined) {
      byKey = new Map();
      store.set(fn, byKey);
    }
    const key = stringify(args);
    const existing = byKey.get(key);
    if (existing !== undefined) {
      return existing as Promise<R>;
    }
    const result = fn(...args);
    byKey.set(key, result);
    return result;
  };
}
