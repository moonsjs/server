import type { StandardSchemaV1 } from "@standard-schema/spec";

/** PRD §7.1. */
export interface ServerFnConfig<
  I extends StandardSchemaV1,
  O extends StandardSchemaV1,
> {
  input: I;
  output: O;
  handler: (args: {
    input: StandardSchemaV1.InferOutput<I>;
    ctx: Ctx;
  }) => Promise<StandardSchemaV1.InferOutput<O>>;
  /** Di-inject plugin saat transform server (§7.2). */
  __hash?: string;
  /** Di-inject plugin: path relatif project root (posix). */
  __file?: string;
  /** Di-inject plugin: baris deklarasi serverFn. */
  __line?: number;
  /** Di-inject plugin: nama export asli. */
  __exportName?: string;
}

/** PRD §7.1. */
export interface ServerFn<
  I extends StandardSchemaV1,
  O extends StandardSchemaV1,
> {
  (args: { input: StandardSchemaV1.InferInput<I> }): Promise<
    StandardSchemaV1.InferOutput<O>
  >;
  readonly __moons_server_fn: true;
  readonly hash: string;
}

/** PRD §7.2, dengan meta tambahan untuk format error §15.2. */
export interface FnRegistryEntry {
  hash: string;
  file: string;
  exportName: string;
  line: number;
  handler: (args: { input: unknown; ctx: Ctx }) => Promise<unknown>;
  input: StandardSchemaV1;
  output: StandardSchemaV1;
}

declare global {
  // Dipakai stub client untuk deteksi SSR in-process (§7.4).
  // eslint-disable-next-line no-var
  var __moons_ssr: boolean | undefined;
  // eslint-disable-next-line no-var
  var __moons_callInProcess:
    | ((hash: string, input: unknown) => Promise<unknown>)
    | undefined;
}
