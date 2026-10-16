import { MoonsError } from "@moonsjs/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { getCurrentContext } from "./context";
import { __moons_registry, __moons_lookup } from "./registry";
import type { ServerFn, ServerFnConfig } from "./types";
import { validateSchema } from "./validate";
import { invalidInputError, invalidOutputError } from "./validation-errors";

/**
 * Deklarasi server function (PRD §7.1). Hanya boleh dipakai di `*.server.ts`;
 * plugin @moonsjs/vite meng-inject meta (hash/file/line/exportName) saat build.
 */
export function serverFn<
  I extends StandardSchemaV1,
  O extends StandardSchemaV1,
>(config: ServerFnConfig<I, O>): ServerFn<I, O> {
  const hash = config.__hash;
  const file = config.__file;

  if (hash === undefined || file === undefined) {
    throw new MoonsError({
      code: "E_INTERNAL",
      message: "`serverFn` dipanggil tanpa meta hasil transform",
      details:
        "serverFn hanya boleh dideklarasikan di `*.server.ts` dan di-build dengan plugin `moons` (@moonsjs/vite), yang meng-inject `__hash`/`__file`.",
      suggestions: [
        "Pastikan file berekstensi `.server.ts` dan berada di dalam project",
        "Pastikan build memakai plugin `moons()` dari @moonsjs/vite",
      ],
    });
  }

  const exportName = config.__exportName ?? "?";
  const line = config.__line ?? 1;

  const call = async (args: {
    input: StandardSchemaV1.InferInput<I>;
  }): Promise<StandardSchemaV1.InferOutput<O>> => {
    const ctx = getCurrentContext();
    if (ctx === undefined) {
      throw new MoonsError({
        code: "E_INTERNAL",
        file,
        line,
        message: "serverFn dipanggil tanpa konteks request aktif",
        details:
          "Panggilan in-process membutuhkan `ctx`; runtime SSR menyediakannya per request.",
        suggestions: [
          "Panggil serverFn dari loader/middleware, bukan di top-level modul",
          "Atau gunakan `runWithContext(ctx, fn)` di tooling/test",
        ],
      });
    }

    const validated = await validateSchema(config.input, args.input);
    if (!validated.ok) {
      throw invalidInputError(validated.issues, hash, undefined);
    }

    const output = await config.handler({ input: validated.value, ctx });

    const validatedOutput = await validateSchema(config.output, output);
    if (!validatedOutput.ok) {
      throw invalidOutputError(validatedOutput.issues, {
        hash,
        file,
        exportName,
        line,
        handler: config.handler as unknown as (args: {
          input: unknown;
          ctx: Ctx;
        }) => Promise<unknown>,
        input: config.input,
        output: config.output,
      });
    }

    return validatedOutput.value;
  };

  Object.defineProperties(call, {
    __moons_server_fn: { value: true },
    hash: { value: hash },
  });

  __moons_registry.set(hash, {
    hash,
    file,
    exportName,
    line,
    handler: (args) =>
      config.handler({
        input: args.input as StandardSchemaV1.InferOutput<I>,
        ctx: args.ctx,
      }),
    input: config.input,
    output: config.output,
  });

  return call as ServerFn<I, O>;
}

export { __moons_lookup };
