import { expect, test } from "bun:test";
import { cache, runWithRequestCache } from "@moonsjs/server";

test("cache(): sekali per request-store; request baru → dieksekusi ulang; tanpa store langsung", async () => {
  let calls = 0;
  const loadUser = cache(async (id: string) => {
    calls += 1;
    return { id, name: `user-${id}` };
  });

  await runWithRequestCache(async () => {
    const [a, b] = await Promise.all([loadUser("u1"), loadUser("u1")]);
    expect(a).toBe(b);
    expect(calls).toBe(1);

    // Argumen berbeda → eksekusi terpisah.
    await loadUser("u2");
    expect(calls).toBe(2);
  });

  // Request (store) baru → dieksekusi lagi.
  await runWithRequestCache(() => loadUser("u1"));
  expect(calls).toBe(3);

  // Tanpa store: jalan langsung tanpa memo.
  await loadUser("u1");
  await loadUser("u1");
  expect(calls).toBe(5);
});
