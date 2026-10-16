import { __moons_callInProcess as callInProcessImpl } from "./registry";

export { serverFn } from "./server-fn";
export { __moons_callInProcess, __moons_lookup, __moons_registry } from "./registry";
export { cache, getCurrentContext, runWithContext, runWithRequestCache } from "./context";
export {
  runWithResponseCollector,
  takeResponseMutations,
} from "./response-store";
export { env, isClientRuntime } from "./env";
export { appendHeader, deleteCookie, setCookie, setHeader } from "@moonsjs/core/response";
export type { CookieOptions } from "@moonsjs/core/response";
export type { ApiHandlerArgs, ApiMethod, ApiRouteDefinition } from "@moonsjs/core";
export { createRpcHandler } from "./rpc";
export type { RpcHandlerOptions, RpcSecurityConfig } from "./rpc";
export type { FnRegistryEntry, ServerFn, ServerFnConfig } from "./types";
export { validateSchema } from "./validate";

// Hook global untuk stub client (§7.4). Package ini hanya dimuat di server.
globalThis.__moons_ssr = true;
globalThis.__moons_callInProcess = (hash, input) => callInProcessImpl(hash, input);
