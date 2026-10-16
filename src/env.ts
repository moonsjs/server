import { MoonsError } from "@moonsjs/core";

/**
 * Baca environment variable (PRD §7.5). Hanya legal di server.
 * Node: `process.env`; Bun: `Bun.env`/`process.env`.
 */
export function env<T = string>(key: string): T {
  if (isClientRuntime()) {
    throw new MoonsError({
      code: "E_ENV_IN_CLIENT",
      message: `memanggil \`env(${JSON.stringify(key)})\` di modul yang masuk client`,
      details: "`env()` hanya legal di server.",
      suggestions: [
        "Pindahkan pemanggilan ke dalam serverFn, atau",
        "Gunakan import.meta.env untuk nilai publik",
      ],
    });
  }

  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  const fromBun = (globalThis as { Bun?: { env?: Record<string, string | undefined> } }).Bun?.env?.[key];
  const value = fromProcess ?? fromBun;

  return value as T;
}

/** Runtime client: tidak ada `process` (browser). Bun & Node selalu punya `process`. */
export function isClientRuntime(): boolean {
  return typeof globalThis.process === "undefined";
}
