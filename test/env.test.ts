import { expect, test } from "bun:test";
import { MoonsError } from "@moonsjs/core";
import { env, isClientRuntime } from "@moonsjs/server";

test("env() membaca process.env di server", () => {
  process.env["MOONS_TEST_ENV_VALUE"] = "halo-dari-env";
  try {
    expect(env("MOONS_TEST_ENV_VALUE")).toBe("halo-dari-env");
    expect(env<string | undefined>("MOONS_TEST_ENV_MISSING")).toBeUndefined();
  } finally {
    delete process.env["MOONS_TEST_ENV_VALUE"];
  }
});

test("guard runtime client → E_ENV_IN_CLIENT", () => {
  const originalProcess = globalThis.process;

  try {
    // Simulasi runtime browser: tanpa `process`.
    (globalThis as { process?: unknown }).process = undefined;

    expect(isClientRuntime()).toBe(true);

    let thrown: unknown;
    try {
      env("API_KEY");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MoonsError);
    const error = thrown as MoonsError;
    expect(error.code).toBe("E_ENV_IN_CLIENT");
    expect(error.format()).toContain("[moons] E_ENV_IN_CLIENT");
    expect(error.format()).toContain('memanggil `env("API_KEY")` di modul yang masuk client');
    expect(error.format()).toContain("Saran:");
  } finally {
    (globalThis as { process?: unknown }).process = originalProcess;
  }

  expect(isClientRuntime()).toBe(false);
});
