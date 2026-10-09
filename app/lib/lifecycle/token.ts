// Signed unsubscribe tokens for lifecycle emails: "<salonId>.<hmac>".
// HMAC-SHA256 with LIFECYCLE_UNSUBSCRIBE_SECRET; no fallback secret, so a
// missing env var fails closed. Tokens don't expire (unsubscribe links must
// keep working). Only node:crypto, so the tests import it directly.

import { createHmac, timingSafeEqual } from "node:crypto";

const SCOPE = "lifecycle-unsubscribe:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mac(salonId: string, secret: string): string {
  return createHmac("sha256", secret).update(SCOPE + salonId).digest("base64url");
}

export function signUnsubscribeToken(salonId: string, secret: string): string {
  if (!secret) throw new Error("LIFECYCLE_UNSUBSCRIBE_SECRET is not set");
  return `${salonId}.${mac(salonId, secret)}`;
}

/** Returns the salon id if the token is genuine, otherwise null. */
export function verifyUnsubscribeToken(token: unknown, secret: string): string | null {
  if (!secret || typeof token !== "string" || token.length > 200) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const salonId = token.slice(0, dot);
  if (!UUID.test(salonId)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(salonId, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return salonId;
}
