import { MoonsError } from "@moonsjs/core";
import type { FnRegistryEntry } from "./types";

export function invalidInputError(
  issues: string[],
  hash: string,
  location: string | undefined,
): MoonsError {
  const detail = issues.length > 0 ? issues[0] : "input tidak sesuai schema";
  return new MoonsError({
    code: "E_RPC_INVALID_INPUT",
    ...(location === undefined ? {} : { location }),
    message: `input tidak sesuai schema: ${detail}`,
    details: "Input server function harus lolos validasi schema `input`.",
    suggestions: [
      "Periksa tipe argumen di pemanggil, atau",
      "Perbarui schema `input`",
    ],
  });
}

export function invalidOutputError(issues: string[], entry: FnRegistryEntry): MoonsError {
  const detail = issues.length > 0 ? issues[0] : "output tidak sesuai schema";
  return new MoonsError({
    code: "E_RPC_INVALID_OUTPUT",
    file: entry.file,
    line: entry.line,
    annotation: entry.exportName,
    message: `output tidak sesuai schema: ${detail}`,
    details: "Return value handler harus lolos validasi schema `output`.",
    suggestions: [
      "Perbaiki return value handler, atau",
      "Perbarui schema `output`",
    ],
  });
}
