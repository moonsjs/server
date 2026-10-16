import { AsyncLocalStorage } from "node:async_hooks";
import {
  __moons_registerResponseCollectorAccess,
  type ResponseMutation,
} from "@moonsjs/core/response";

/**
 * Kolektor mutasi respons per request (PRD Addendum D.2).
 * `setHeader`/`setCookie` (dari `@moonsjs/core/response`) menulis ke store ini;
 * runtime (`@moonsjs/vite/server`) menerapkannya ke `Response` akhir.
 */
const storage = new AsyncLocalStorage<ResponseMutation[]>();

__moons_registerResponseCollectorAccess(() => {
  const mutations = storage.getStore();
  if (mutations === undefined) {
    return null;
  }
  return { push: (mutation) => mutations.push(mutation) };
});

/** Jalankan `fn` dengan kolektor respons request aktif. */
export function runWithResponseCollector<T>(fn: () => T): T {
  return storage.run([], fn);
}

/** Mutasi terkumpul untuk request aktif (array kosong bila tidak ada). */
export function takeResponseMutations(): ReadonlyArray<ResponseMutation> {
  return storage.getStore() ?? [];
}
