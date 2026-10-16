import { expect, test } from "bun:test";
import { createRpcHandler, serverFn } from "@moonsjs/server";
import { parse, stringify } from "devalue";
import { z } from "zod";

const hash = "cccc2222cccc2222";
const errorHash = "dddd3333dddd3333";

serverFn({
  input: z.object({ id: z.string() }),
  output: z.object({ name: z.string(), at: z.date(), tags: z.map(z.string(), z.string()) }),
  handler: async ({ input }) => ({
    name: `User ${input.id}`,
    at: new Date("2024-01-01T00:00:00Z"),
    tags: new Map([["role", "admin"]]),
  }),
  __hash: hash,
  __file: "src/server/users.server.ts",
  __line: 21,
  __exportName: "getUser",
});

serverFn({
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  handler: async () => {
    throw new Error("boom-secret");
  },
  __hash: errorHash,
  __file: "src/server/boom.server.ts",
  __line: 5,
  __exportName: "boom",
});

const rpc = createRpcHandler();

function makeRequest(options: {
  targetHash?: string;
  method?: string;
  xMoons?: string | null;
  origin?: string | null;
  body?: string;
}): Request {
  const headers = new Headers({ "content-type": "application/x-moons" });
  if (options.xMoons !== null) {
    headers.set("x-moons", options.xMoons ?? "1");
  }
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "http://localhost:3000");
  }
  return new Request(`http://localhost:3000/_moons/fn/${options.targetHash ?? hash}`, {
    method: options.method ?? "POST",
    headers,
    ...(options.method === "GET" ? {} : { body: options.body ?? stringify({ id: "u1" }) }),
  });
}

test("RPC sukses: devalue in → handler → devalue out (+Date/Map)", async () => {
  const response = await rpc(makeRequest({}), hash, {});
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/x-moons");

  const data = parse(await response.text()) as {
    name: string;
    at: Date;
    tags: Map<string, string>;
  };
  expect(data.name).toBe("User u1");
  expect(data.at).toBeInstanceOf(Date);
  expect(data.tags).toBeInstanceOf(Map);
  expect(data.tags.get("role")).toBe("admin");
});

test("method selain POST → 405", async () => {
  const response = await rpc(makeRequest({ method: "GET" }), hash, {});
  expect(response.status).toBe(405);
});

test("tanpa x-moons → 400 E_RPC_MISSING_HEADER", async () => {
  const response = await rpc(makeRequest({ xMoons: null }), hash, {});
  expect(response.status).toBe(400);
  const body = await response.text();
  expect(body).toContain("[moons] E_RPC_MISSING_HEADER");
  expect(body).toContain("Suggestion:");
});

test("origin asing → 403 E_RPC_BAD_ORIGIN", async () => {
  const response = await rpc(makeRequest({ origin: "https://evil.example.com" }), hash, {});
  expect(response.status).toBe(403);
  expect(await response.text()).toContain("[moons] E_RPC_BAD_ORIGIN");
});

test("payload devalue invalid → 400 E_RPC_INVALID_INPUT", async () => {
  const response = await rpc(makeRequest({ body: "invalid-payload" }), hash, {});
  expect(response.status).toBe(400);
  expect(await response.text()).toContain("[moons] E_RPC_INVALID_INPUT");
});

test("input gagal schema → 400 E_RPC_INVALID_INPUT", async () => {
  const response = await rpc(makeRequest({ body: stringify({ id: 42 }) }), hash, {});
  expect(response.status).toBe(400);
  expect(await response.text()).toContain("[moons] E_RPC_INVALID_INPUT");
});

test("hash tidak terdaftar → 404 E_INTERNAL", async () => {
  const response = await rpc(
    makeRequest({ targetHash: "ffffffffffffffff" }),
    "ffffffffffffffff",
    {},
  );
  expect(response.status).toBe(404);
  expect(await response.text()).toContain("[moons] E_INTERNAL");
});

test("handler error → 500, produksi tidak membocorkan detail", async () => {
  const previous = process.env["NODE_ENV"];

  process.env["NODE_ENV"] = "production";
  try {
    const response = await rpc(makeRequest({ body: stringify({}) }), errorHash, {});
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("boom-secret");
    expect(body).not.toContain("\n    at ");
    expect(body).toContain("[moons] E_INTERNAL");
  } finally {
    if (previous === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = previous;
    }
  }

  const dev = await rpc(makeRequest({ body: stringify({}) }), errorHash, {});
  expect(await dev.text()).toContain("boom-secret");
});

test("body melebihi limit → 413 E_RPC_BODY_TOO_LARGE", async () => {
  const small = createRpcHandler({ security: { bodyLimitBytes: 32 } });
  const response = await small(makeRequest({ body: stringify({ id: "x".repeat(100) }) }), hash, {});
  expect(response.status).toBe(413);
  expect(await response.text()).toContain("[moons] E_RPC_BODY_TOO_LARGE");
});
