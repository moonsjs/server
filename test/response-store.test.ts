import { expect, test } from "bun:test";
import { MoonsError } from "@moonsjs/core";
import {
  appendHeader,
  deleteCookie,
  setCookie,
  setHeader,
} from "@moonsjs/core/response";
import { runWithResponseCollector, takeResponseMutations } from "@moonsjs/server";

test("kolektor: setHeader/appendHeader/setCookie/deleteCookie terkumpul per request", () => {
  const seen = runWithResponseCollector(() => {
    setHeader("x-a", "1");
    appendHeader("x-a", "2");
    setCookie("session", "abc def", { httpOnly: true, sameSite: "lax", maxAge: 60 });
    deleteCookie("theme", { path: "/" });
    return takeResponseMutations();
  });

  expect(seen).toHaveLength(4);
  expect(seen[0]).toEqual({ kind: "header", name: "x-a", value: "1", append: false });
  expect(seen[1]).toEqual({ kind: "header", name: "x-a", value: "2", append: true });
  const cookie = seen[2]!;
  expect(cookie.kind).toBe("cookie");
  if (cookie.kind === "cookie") {
    expect(cookie.value).toContain("session=abc%20def");
    expect(cookie.value).toContain("HttpOnly");
    expect(cookie.value).toContain("SameSite=Lax");
    expect(cookie.value).toContain("Max-Age=60");
    expect(cookie.value).toContain("Path=/");
  }
  const deleted = seen[3]!;
  if (deleted.kind === "cookie") {
    expect(deleted.value).toContain("Max-Age=0");
    expect(deleted.value).toContain("Expires=Thu, 01 Jan 1970");
  }
});

test("store terpisah antar request (tidak bocor)", () => {
  runWithResponseCollector(() => setHeader("x-first", "1"));
  const second = runWithResponseCollector(() => {
    setHeader("x-second", "2");
    return takeResponseMutations();
  });
  expect(second).toHaveLength(1);
  expect(second[0]).toMatchObject({ name: "x-second" });
});

test("di luar request → E_RESPONSE_OUTSIDE_REQUEST", () => {
  for (const call of [
    () => setHeader("x-a", "1"),
    () => appendHeader("x-a", "1"),
    () => setCookie("a", "1"),
    () => deleteCookie("a"),
  ]) {
    let thrown: unknown;
    try {
      call();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MoonsError);
    expect((thrown as MoonsError).code).toBe("E_RESPONSE_OUTSIDE_REQUEST");
    expect((thrown as MoonsError).format()).toContain("Suggestion:");
  }
});

test("validasi: CRLF, header terlarang, nama cookie, maxAge → E_RESPONSE_HEADER_INVALID", () => {
  runWithResponseCollector(() => {
    expect(() => setHeader("x-a", "a\r\nx: b")).toThrow(MoonsError);
    expect(() => setHeader("bad name", "1")).toThrow(MoonsError);
    expect(() => setHeader("content-length", "10")).toThrow(MoonsError);
    expect(() => setCookie("bad name", "1")).toThrow(MoonsError);
    expect(() => setCookie("a", "1", { maxAge: -1 })).toThrow(MoonsError);
    try {
      setHeader("x-a", "a\r\nb");
    } catch (error) {
      expect((error as MoonsError).code).toBe("E_RESPONSE_HEADER_INVALID");
    }
  });
});
