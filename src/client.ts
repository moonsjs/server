import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parse, stringify } from "devalue";
import type { ServerFn } from "./types";
import { validateSchema } from "./validate";

/**
 * Stub RPC yang menggantikan `serverFn` di bundle client (PRD §7.1, §7.4).
 * Input dan output divalidasi di sisi client (§11.3.4).
 */
export function __moons_createStub<
  I extends StandardSchemaV1,
  O extends StandardSchemaV1,
>(args: { hash: string; input: I; output: O }): ServerFn<I, O> {
  const call = async (callArgs: {
    input: StandardSchemaV1.InferInput<I>;
  }): Promise<StandardSchemaV1.InferOutput<O>> => {
    const inputCheck = await validateSchema(args.input, callArgs.input);
    if (!inputCheck.ok) {
      throw clientError("E_RPC_INVALID_INPUT", [
        `input tidak sesuai schema: ${inputCheck.issues[0] ?? "tidak valid"}`,
      ]);
    }

    // §7.4: deteksi SSR — jalur in-process bila runtime server menyediakan hook.
    const hook = globalThis.__moons_callInProcess;
    if (globalThis.__moons_ssr === true && typeof hook === "function") {
      return (await hook(args.hash, inputCheck.value)) as StandardSchemaV1.InferOutput<O>;
    }

    const response = await fetch(`/_moons/fn/${args.hash}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-moons",
        "x-moons": "1",
      },
      body: stringify(inputCheck.value),
    });
    const text = await response.text();

    if (!response.ok) {
      const code = /^\[moons\]\s+(\S+)/.exec(text)?.[1] ?? "E_INTERNAL";
      throw clientError(code, [text]);
    }

    const outputCheck = await validateSchema(args.output, parse(text));
    if (!outputCheck.ok) {
      throw clientError("E_RPC_INVALID_OUTPUT", [
        `output tidak sesuai schema: ${outputCheck.issues[0] ?? "tidak valid"}`,
      ]);
    }

    return outputCheck.value;
  };

  Object.defineProperties(call, {
    __moons_server_fn: { value: true },
    hash: { value: args.hash },
  });

  return call as ServerFn<I, O>;
}

function clientError(code: string, lines: string[]): Error {
  return new Error(`[moons] ${code}\n\n${lines.join("\n")}`);
}
