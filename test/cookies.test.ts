import { expect, test } from "bun:test";
import { MoonsError } from "@moonsjs/core";
import { signCookie, verifyCookie } from "../src/cookies";

const SECRET = "test-secret-0123456789abcdef";

test("signCookie → verifyCookie: roundtrip objek & unicode", async () => {
  const token = await signCookie({ userId: "u_1", hop: "naik–turun ✨" }, SECRET);
  expect(token.startsWith("v1.")).toBe(true);
  const data = await verifyCookie<{ userId: string; hop: string }>(token, SECRET);
  expect(data).toEqual({ userId: "u_1", hop: "naik–turun ✨" });
});

test("verifyCookie: tanda tangan salah / token rusak / secret beda → null", async () => {
  const token = await signCookie({ userId: "u_1" }, SECRET);
  const [v, body, sig] = token.split(".") as [string, string, string];
  const tampered = `${v}.${body}.${sig.slice(0, -2)}xx`;
  expect(await verifyCookie(tampered, SECRET)).toBeNull();
  expect(await verifyCookie(token, "secret-lain-0123456789")).toBeNull();
  expect(await verifyCookie("bukan-token", SECRET)).toBeNull();
  expect(await verifyCookie("v2.abc.def", SECRET)).toBeNull();
  expect(await verifyCookie(null, SECRET)).toBeNull();
  expect(await verifyCookie(undefined, SECRET)).toBeNull();
});

test("verifyCookie: payload diubah tanpa tanda tangan baru → null", async () => {
  const token = await signCookie({ role: "user" }, SECRET);
  const [, , sig] = token.split(".") as [string, string, string];
  const forgedBody = Buffer.from(
    JSON.stringify({ d: { role: "admin" }, exp: Date.now() + 1000 }),
  )
    .toString("base64url");
  expect(await verifyCookie(`v1.${forgedBody}.${sig}`, SECRET)).toBeNull();
});

test("verifyCookie: kedaluwarsa → null (now dapat diinjeksi)", async () => {
  let clock = 1_000_000;
  const token = await signCookie({ userId: "u_1" }, SECRET, {
    expiresIn: 60,
    now: () => clock,
  });
  expect(await verifyCookie(token, SECRET, { now: () => clock + 30_000 })).toEqual({
    userId: "u_1",
  });
  expect(await verifyCookie(token, SECRET, { now: () => clock + 61_000 })).toBeNull();
});

test("signCookie: secret pendek / expiresIn invalid → E_CONFIG_INVALID", async () => {
  let short: unknown;
  try {
    await signCookie({}, "pendek");
  } catch (error) {
    short = error;
  }
  expect(short).toBeInstanceOf(MoonsError);
  expect((short as MoonsError).code).toBe("E_CONFIG_INVALID");

  let badExpiry: unknown;
  try {
    await signCookie({}, SECRET, { expiresIn: 0 });
  } catch (error) {
    badExpiry = error;
  }
  expect((badExpiry as MoonsError).code).toBe("E_CONFIG_INVALID");
});
