import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "__Host-wheelhouse-manager";
const sessionSeconds = 12 * 60 * 60;

export function matches(value: unknown, expected: string) {
  if (typeof value !== "string" || value.length !== expected.length) return false;
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function sign(expiry: string, secret: string) {
  return createHmac("sha256", secret).update("wheelhouse-manager:" + expiry).digest("base64url");
}

export function managerCookie(secret?: string) {
  const expiry = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  const value = secret ? expiry + "." + sign(expiry, secret) : "";
  return cookieName + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + (secret ? sessionSeconds : 0);
}

export function hasManagerSession(request: Request, secret?: string) {
  if (!secret) return false;
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-wheelhouse-manager=([^;]+)/)?.[1];
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  return /^\d{10}$/.test(expiry) && Number(expiry) > Date.now() / 1000 && matches(signature, sign(expiry, secret));
}
