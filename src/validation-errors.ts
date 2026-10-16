import { MoonsError } from "@moonsjs/core";
import type { FnRegistryEntry } from "./types";

export function invalidInputError(
  issues: string[],
  hash: string,
  location: string | undefined,
): MoonsError {
  const detail = issues.length > 0 ? issues[0] : "input does not match the schema";
  return new MoonsError({
    code: "E_RPC_INVALID_INPUT",
    ...(location === undefined ? {} : { location }),
    message: `input does not match the schema: ${detail}`,
    details: "Server function input must pass `input` schema validation.",
    suggestions: [
      "Check the argument types at the call site, or",
      "Update the `input` schema",
    ],
  });
}

export function invalidOutputError(issues: string[], entry: FnRegistryEntry): MoonsError {
  const detail = issues.length > 0 ? issues[0] : "output does not match the schema";
  return new MoonsError({
    code: "E_RPC_INVALID_OUTPUT",
    file: entry.file,
    line: entry.line,
    annotation: entry.exportName,
    message: `output does not match the schema: ${detail}`,
    details: "Handler return values must pass `output` schema validation.",
    suggestions: [
      "Fix the handler return value, or",
      "Update the `output` schema",
    ],
  });
}
