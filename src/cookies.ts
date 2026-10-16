import { MoonsError } from "@moonsjs/core";

const encoder = new TextEncoder();

export interface SignCookieOptions {
  /** Umur token dalam detik; bila diisi, token kedaluwarsa setelahnya. */
  expiresIn?: number;
  /** Waktu acuan (ms) — untuk test. Default: `Date.now()`. */
  now?: () => number;
}

export interface VerifyCookieOptions {
  now?: () => number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).split("+").join("-").split("/").join("_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.split("-").join("+").split("_").join("/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signature(secret: string, value: string): Promise<string> {
  const key = await hmacKey(secret);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * Tanda tangani data arbitrer menjadi cookie value yang tahan manipulasi
 * (HMAC-SHA256, WebCrypto — jalan di Bun & Node, tanpa dependency).
 * Format: `v1.<payload-b64url>.<signature-b64url>`.
 */
export async function signCookie(
  data: unknown,
  secret: string,
  options: SignCookieOptions = {},
): Promise<string> {
  if (typeof secret !== "string" || secret.length < 16) {
    throw new MoonsError({
      code: "E_CONFIG_INVALID",
      message: "`secret` for `signCookie` must be at least 16 characters",
      details: "A short secret is easy to brute-force — use a random value from env().",
      suggestions: [
        'Load it from the environment: `signCookie(data, env("SESSION_SECRET"))`',
        "Generate one with `openssl rand -base64 32`",
      ],
    });
  }
  const now = options.now ?? Date.now;
  const payload: { d: unknown; exp?: number } = { d: data };
  if (options.expiresIn !== undefined) {
    if (!Number.isFinite(options.expiresIn) || options.expiresIn <= 0) {
      throw new MoonsError({
        code: "E_CONFIG_INVALID",
        message: "`expiresIn` must be a positive number of seconds",
        details: "The token lifetime is measured from the signing time.",
        suggestions: ["Use e.g. 60 * 60 * 24 for 24 hours"],
      });
    }
    payload.exp = now() + options.expiresIn * 1000;
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const value = `v1.${body}`;
  const sig = await signature(secret, value);
  return `${value}.${sig}`;
}

/**
 * Verifikasi cookie hasil `signCookie`. Mengembalikan `null` (tanpa lempar)
 * bila tanda tangan tidak cocok, format rusak, atau kedaluwarsa — sehingga
 * pemanggil bisa memperlakukannya sebagai "belum login".
 */
export async function verifyCookie<T = unknown>(
  token: string | null | undefined,
  secret: string,
  options: VerifyCookieOptions = {},
): Promise<T | null> {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return null;
  }
  const [, body, sig] = parts as [string, string, string];
  const expected = await signature(secret, `v1.${body}`);
  if (!timingSafeEqual(expected, sig)) {
    return null;
  }
  let payload: { d?: unknown; exp?: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as {
      d?: unknown;
      exp?: number;
    };
  } catch {
    return null;
  }
  const now = options.now ?? Date.now;
  if (typeof payload.exp === "number" && payload.exp <= now()) {
    return null;
  }
  return (payload.d ?? null) as T | null;
}
