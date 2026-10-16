import { MoonsError } from "@moonsjs/core";
import type { FnRegistryEntry } from "./types";

/** Registry global serverFn (PRD §7.2). Terisi saat modul `.server.ts` dievaluasi. */
export const __moons_registry = new Map<string, FnRegistryEntry>();

export function __moons_lookup(hash: string): FnRegistryEntry | undefined {
  return __moons_registry.get(hash);
}

/**
 * Jalan in-process (§7.4): lookup → validasi input → handler → validasi output.
 * `ctx` opsional; jika tidak diberikan, memakai konteks request aktif (ALS).
 */
export async function __moons_callInProcess<I = unknown, O = unknown>(
  hash: string,
  input: I,
  ctx?: Ctx,
): Promise<O> {
  const { validateSchema } = await import("./validate");
  const { invalidInputError, invalidOutputError } = await import("./validation-errors");
  const { getCurrentContext } = await import("./context");

  const entry = __moons_lookup(hash);
  if (entry === undefined) {
    throw new MoonsError({
      code: "E_INTERNAL",
      message: `server function \`${hash}\` not found in the registry`,
      details: "The hash is not registered; the .server.ts module may be missing from the server build.",
      suggestions: ["Make sure the .server.ts module is imported by the loader/server entry", "Re-run the build"],
    });
  }

  const validated = await validateSchema(entry.input, input);
  if (!validated.ok) {
    throw invalidInputError(validated.issues, hash, undefined);
  }

  const callCtx = ctx ?? getCurrentContext();
  const output = await entry.handler({ input: validated.value, ctx: callCtx as Ctx });

  const validatedOutput = await validateSchema(entry.output, output);
  if (!validatedOutput.ok) {
    throw invalidOutputError(validatedOutput.issues, entry);
  }

  return validatedOutput.value as O;
}
