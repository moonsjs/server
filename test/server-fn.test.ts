import { expect, test } from "bun:test";
import { MoonsError } from "@moonsjs/core";
import { __moons_callInProcess, __moons_lookup, runWithContext, serverFn } from "@moonsjs/server";
import { z } from "zod";

const getUser = serverFn({
  input: z.object({ id: z.string() }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.date(),
    tags: z.map(z.string(), z.string()),
  }),
  handler: async ({ input }) => ({
    id: input.id,
    name: "Alice",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    tags: new Map([["role", "admin"]]),
  }),
  __hash: "aaaa0000aaaa0000",
  __file: "src/server/users.server.ts",
  __line: 14,
  __exportName: "getUser",
});

const badOutput = serverFn({
  input: z.object({}),
  output: z.object({ name: z.string() }),
  handler: (async () => ({})) as unknown as () => Promise<{ name: string }>,
  __hash: "bbbb0000bbbb0000",
  __file: "src/server/bad.server.ts",
  __line: 3,
  __exportName: "badOutput",
});

test("serverFn terdaftar di registry dengan meta §7.2", () => {
  const entry = __moons_lookup("aaaa0000aaaa0000");
  expect(entry).toBeDefined();
  expect(entry?.file).toBe("src/server/users.server.ts");
  expect(entry?.exportName).toBe("getUser");
  expect(entry?.line).toBe(14);
  expect(getUser.__moons_server_fn).toBe(true);
  expect(getUser.hash).toBe("aaaa0000aaaa0000");
});

test("panggilan in-process lewat ctx ALS: Date dan Map utuh", async () => {
  const result = await runWithContext({ requestId: "r1" }, () =>
    getUser({ input: { id: "u1" } }),
  );
  expect(result.id).toBe("u1");
  expect(result.createdAt).toBeInstanceOf(Date);
  expect(result.tags.get("role")).toBe("admin");
});

test("serverFn tanpa konteks request → E_INTERNAL", async () => {
  let thrown: unknown;
  try {
    await getUser({ input: { id: "u1" } });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(MoonsError);
  expect((thrown as MoonsError).code).toBe("E_INTERNAL");
  expect((thrown as MoonsError).format()).toContain("Suggestion:");
});

test("input tidak sesuai schema → E_RPC_INVALID_INPUT dengan format §15", async () => {
  let thrown: unknown;
  try {
    await runWithContext({}, () => getUser({ input: { id: 42 } as unknown as { id: string } }));
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(MoonsError);
  const error = thrown as MoonsError;
  expect(error.code).toBe("E_RPC_INVALID_INPUT");
  expect(error.format()).toContain("[moons] E_RPC_INVALID_INPUT");
  expect(error.format()).toContain("input does not match the schema");
  expect(error.format()).toContain("Suggestion:");
});

test("output tidak sesuai schema → E_RPC_INVALID_OUTPUT file:line (exportName)", async () => {
  let thrown: unknown;
  try {
    await runWithContext({}, () => badOutput({ input: {} }));
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(MoonsError);
  const error = thrown as MoonsError;
  expect(error.code).toBe("E_RPC_INVALID_OUTPUT");
  expect(error.format()).toContain("src/server/bad.server.ts:3 (badOutput)");
});

test("__moons_callInProcess §7.4 memvalidasi dan memanggil handler", async () => {
  const result = await __moons_callInProcess<{ id: string }, { name: string }>(
    "aaaa0000aaaa0000",
    { id: "u9" },
    {},
  );
  expect(result.name).toBe("Alice");

  expect(__moons_callInProcess("ffffffffffffffff", {}, {})).rejects.toThrow(MoonsError);
});
