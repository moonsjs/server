import { expect, test } from "bun:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { validateSchema } from "@moonsjs/server";
import { __moons_createStub } from "@moonsjs/server/client";
import { parse, stringify } from "devalue";

/**
 * Bukti §25 (Standard Schema non-Zod): serverFn/validasi generik terhadap spec,
 * bukan terhadap Zod. Schema di bawah ditulis tangan tanpa library.
 */

interface UpperValue {
  tag: string;
}

const upperToken: StandardSchemaV1<unknown, string> = {
  "~standard": {
    version: 1,
    vendor: "moons-test",
    validate: (value: unknown): StandardSchemaV1.Result<string> => {
      if (typeof value === "string" && value.length > 0 && value === value.toUpperCase()) {
        return { value };
      }
      return { issues: [{ message: "harus string KAPITAL non-kosong" }] };
    },
  },
};

const upperPayload: StandardSchemaV1<unknown, UpperValue> = {
  "~standard": {
    version: 1,
    vendor: "moons-test",
    validate: (value: unknown): StandardSchemaV1.Result<UpperValue> => {
      if (typeof value === "object" && value !== null && "tag" in value) {
        const tag = (value as { tag: unknown }).tag;
        if (typeof tag === "string" && tag === tag.toUpperCase()) {
          return { value: { tag } };
        }
      }
      return { issues: [{ message: "tag harus KAPITAL" }] };
    },
  },
};

type Globals = {
  __moons_ssr?: boolean | undefined;
  __moons_callInProcess?: unknown;
  fetch: typeof fetch;
};

function setFetch(fn: () => Promise<Response>): void {
  (globalThis as unknown as Globals).fetch = fn as unknown as typeof fetch;
}

test("validateSchema: schema Standard Schema non-Zod (sync) valid & invalid", async () => {
  const ok = await validateSchema(upperToken, "MOONS");
  expect(ok).toEqual({ ok: true, value: "MOONS" });

  const bad = await validateSchema(upperToken, "moons");
  expect(bad.ok).toBe(false);
  if (!bad.ok) {
    expect(bad.issues[0]).toContain("KAPITAL");
  }
});

test("stub client: schema non-Zod divalidasi di kedua sisi (input sebelum fetch, output sesudah)", async () => {
  const stub = __moons_createStub({ hash: "cccc0000cccc0000", input: upperToken, output: upperPayload });

  // Package ini men-set `__moons_ssr` + hook in-process (PRD §7.4); matikan
  // sementara agar stub menempuh jalur HTTP yang diuji di sini.
  const g = globalThis as unknown as Globals;
  const previousSsr = g.__moons_ssr;
  const previousHook = g.__moons_callInProcess;
  const originalFetch = g.fetch;
  g.__moons_ssr = false;
  g.__moons_callInProcess = undefined;

  try {
    // Input invalid → ditolak sebelum menyentuh jaringan.
    let fetchCalled = false;
    setFetch(async () => {
      fetchCalled = true;
      return new Response("unreachable");
    });
    await expect(stub({ input: "lowercase" })).rejects.toThrow("E_RPC_INVALID_INPUT");
    expect(fetchCalled).toBe(false);

    // Jalur sukses: output divalidasi oleh schema non-Zod.
    setFetch(async () => new Response(stringify({ tag: "MOONS" })));
    const result = await stub({ input: "MOONS" });
    expect(result).toEqual({ tag: "MOONS" });

    // Output invalid → E_RPC_INVALID_OUTPUT.
    setFetch(async () => new Response(stringify({ tag: "lowercase" })));
    await expect(stub({ input: "MOONS" })).rejects.toThrow("E_RPC_INVALID_OUTPUT");
  } finally {
    g.__moons_ssr = previousSsr;
    g.__moons_callInProcess = previousHook;
    g.fetch = originalFetch;
  }
});

test("devalue roundtrip dipakai stub (sanity)", () => {
  expect(parse(stringify({ tag: "MOONS" }))).toEqual({ tag: "MOONS" });
});
