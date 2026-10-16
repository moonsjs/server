import { DEFAULT_BODY_LIMIT_BYTES, MoonsError, type MoonsErrorCode } from "@moonsjs/core";
import { parse, stringify } from "devalue";
import { __moons_lookup } from "./registry";
import { validateSchema } from "./validate";
import { invalidInputError, invalidOutputError } from "./validation-errors";

export interface RpcSecurityConfig {
  originWhitelist?: string[];
  bodyLimitBytes?: number;
}

export interface RpcHandlerOptions {
  security?: RpcSecurityConfig;
}



/**
 * Handler RPC HTTP (PRD §7.3). Dipanggil runtime (@moonsjs/vite/server) setelah
 * `context(req)` + middleware global, dengan `ctx` yang sama.
 */
export function createRpcHandler(options: RpcHandlerOptions = {}) {
  const bodyLimit = options.security?.bodyLimitBytes ?? DEFAULT_BODY_LIMIT_BYTES;
  const whitelist = options.security?.originWhitelist ?? [];

  return async function rpcHandler(
    request: Request,
    hash: string,
    ctx: Ctx,
  ): Promise<Response> {
    const location = `POST /_moons/fn/${hash}`;

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    if (request.headers.get("x-moons") !== "1") {
      return errorResponse(
        new MoonsError({
          code: "E_RPC_MISSING_HEADER",
          location,
          message: "missing `x-moons: 1` header",
          details: "All RPC requests must include this header.",
          suggestions: [
            "Use `serverFn()` from the client instead of manual fetch",
          ],
        }),
        400,
      );
    }

    const origin = request.headers.get("origin");
    if (origin !== null && !isOriginAllowed(origin, request.url, whitelist)) {
      return errorResponse(
        new MoonsError({
          code: "E_RPC_BAD_ORIGIN",
          location,
          message: `Origin: ${origin} does not match`,
          details:
            "The request origin does not match the host and is not listed in `security.originWhitelist`.",
          suggestions: [
            "Add the origin to security.originWhitelist if it is legitimate",
          ],
        }),
        403,
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > bodyLimit) {
      return errorResponse(bodyTooLargeError(contentLength, bodyLimit, location), 413);
    }

    const body = await request.text();
    const bodyBytes = new TextEncoder().encode(body).length;
    if (bodyBytes > bodyLimit) {
      return errorResponse(bodyTooLargeError(bodyBytes, bodyLimit, location), 413);
    }

    let input: unknown;
    try {
      input = parse(body);
    } catch (error) {
      const isProduction = process.env["NODE_ENV"] === "production";
      const detail = isProduction
        ? ""
        : `: ${error instanceof Error ? error.message : String(error)}`;
      return errorResponse(
        new MoonsError({
          code: "E_RPC_INVALID_INPUT",
          location,
          message: `invalid devalue payload${detail}`,
          details: "The request body must be the result of `devalue.stringify(input)`.",
          suggestions: [
            "Use `serverFn()` from the client instead of a manual fetch",
            "Make sure `Content-Type: application/x-moons`",
          ],
        }),
        400,
      );
    }

    const entry = __moons_lookup(hash);
    if (entry === undefined) {
      return errorResponse(
        new MoonsError({
          code: "E_INTERNAL",
          location,
          message: `server function \`${hash}\` not found`,
          details: "The hash is not registered in the server registry.",
          suggestions: [
            "Make sure the `.server.ts` module is bundled into the server build",
            "Re-run the build",
          ],
        }),
        404,
      );
    }

    const validated = await validateSchema(entry.input, input);
    if (!validated.ok) {
      return errorResponse(invalidInputError(validated.issues, hash, location), 400);
    }

    let output: unknown;
    try {
      output = await entry.handler({ input: validated.value, ctx });
    } catch (error) {
      return errorResponse(handlerError(error, location), 500);
    }

    const validatedOutput = await validateSchema(entry.output, output);
    if (!validatedOutput.ok) {
      return errorResponse(invalidOutputError(validatedOutput.issues, entry), 500);
    }

    return new Response(stringify(validatedOutput.value), {
      status: 200,
      headers: { "content-type": "application/x-moons" },
    });
  };
}

function handlerError(error: unknown, location: string): MoonsError {
  const isProduction = process.env["NODE_ENV"] === "production";
  const message = error instanceof Error ? error.message : String(error);
  return new MoonsError({
    code: "E_INTERNAL",
    location,
    message: isProduction ? "Internal server error." : `handler error: ${message}`,
    details: isProduction
      ? "Details are hidden in production; check the server logs."
      : "The handler threw an error while executing.",
    suggestions: ["Check the server logs for details", "Report it if this is a framework bug"],
  });
}

function bodyTooLargeError(size: number, limit: number, location: string): MoonsError {
  return new MoonsError({
    code: "E_RPC_BODY_TOO_LARGE",
    location,
    message: `body ${toMegabytes(size)} MB exceeds the ${toMegabytes(limit)} MB limit`,
    details: "The body exceeds `security.bodyLimitBytes`.",
    suggestions: [
      "Reduce the payload size, or",
      "Raise `security.bodyLimitBytes` if you really need to",
    ],
  });
}

function toMegabytes(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}

function errorResponse(error: MoonsError, status: number): Response {
  return new Response(error.format(), {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function isOriginAllowed(origin: string, requestUrl: string, whitelist: string[]): boolean {
  if (whitelist.includes(origin)) {
    return true;
  }
  try {
    const url = new URL(requestUrl);
    if (origin === `${url.protocol}//${url.host}`) {
      return true;
    }
  } catch {
    // URL tidak valid → jatuh ke penolakan di bawah.
  }
  if (
    process.env["NODE_ENV"] !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return true;
  }
  return false;
}

export type { MoonsErrorCode };
