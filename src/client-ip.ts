import { CLIENT_IP_HEADER } from "@moonsjs/core";

export { CLIENT_IP_HEADER };

/**
 * IP klien tepercaya dari request yang masuk lewat server Moons (Addendum J.1).
 * Diisi transport: entri pertama `x-forwarded-for` bila `security.trustProxy`
 * aktif, selain itu alamat socket. `null` bila tidak tersedia (mis. request
 * dibuat manual di luar server — jangan pakai header mentah sebagai gantinya).
 */
export function getClientIp(request: Request): string | null {
  const value = request.headers.get(CLIENT_IP_HEADER);
  return value === null || value.length === 0 ? null : value;
}
