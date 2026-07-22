/**
 * Verifies that NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are a
 * matching EC (P-256) key pair, without needing the `web-push` package or
 * a real push subscription to test against.
 *
 * A mismatched pair fails SILENTLY at send time (webpush.sendNotification
 * just throws a signing error per-subscription) — this catches that before
 * a real booking depends on it.
 *
 * Run:
 *   node scripts/verify-vapid.mjs
 *
 * Reads from process.env first. Local .env.local has these blank (VAPID_*
 * are marked "Sensitive" in Vercel, so `vercel env pull` can never recover
 * their values — that's by design, not a bug). To check the values actually
 * deployed in production, run this with the values injected inline, e.g.:
 *
 *   VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_EMAIL="..." node scripts/verify-vapid.mjs
 *
 * If you no longer have the original values (they were never saved outside
 * Vercel), there is no way to recover them — Sensitive vars are write-only
 * forever, even in the Vercel dashboard UI. The only fix at that point is to
 * generate a new pair (`npx web-push generate-vapid-keys`), set both in
 * Vercel, and have every owner click "Enable Notifications" again — the old
 * subscriptions will silently fail once the private key no longer matches.
 */
import { createECDH } from "crypto";

function base64UrlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function bufferToBase64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const publicKey =
  process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const email = process.env.VAPID_EMAIL;

let failed = false;

if (!publicKey || !privateKey) {
  console.error("❌ Missing VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY) / VAPID_PRIVATE_KEY in env.");
  console.error("   Pass them inline — see the header comment in this script for why they can't be pulled from Vercel.");
  process.exit(1);
}

if (!email) {
  console.warn("⚠️  VAPID_EMAIL is not set — web-push requires a mailto: subject or sends will fail.");
  failed = true;
} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.warn(`⚠️  VAPID_EMAIL ("${email}") doesn't look like a valid email address.`);
  failed = true;
} else {
  console.log(`✅ VAPID_EMAIL looks valid: mailto:${email}`);
}

const publicBuf = base64UrlToBuffer(publicKey);
const privateBuf = base64UrlToBuffer(privateKey);

if (publicBuf.length !== 65 || publicBuf[0] !== 0x04) {
  console.error(`❌ Public key is malformed — expected a 65-byte uncompressed P-256 point (0x04 prefix), got ${publicBuf.length} bytes, prefix 0x${publicBuf[0]?.toString(16)}.`);
  process.exit(1);
}
console.log("✅ Public key is a well-formed 65-byte uncompressed P-256 point.");

if (privateBuf.length !== 32) {
  console.error(`❌ Private key is malformed — expected a 32-byte scalar, got ${privateBuf.length} bytes.`);
  process.exit(1);
}
console.log("✅ Private key is a well-formed 32-byte scalar.");

// Derive the public key from the private key on the P-256 curve and compare
// to the given public key — this is the only real way to confirm they're
// actually a matching pair, not just individually well-formed.
const ecdh = createECDH("prime256v1");
ecdh.setPrivateKey(privateBuf);
const derivedPublicBuf = ecdh.getPublicKey(null, "uncompressed");
const derivedPublicKey = bufferToBase64Url(derivedPublicBuf);

if (derivedPublicKey === publicKey) {
  console.log("✅ Public/private key pair MATCHES — this pair is valid for signing pushes.");
} else {
  console.error("❌ Public/private key pair DOES NOT MATCH.");
  console.error(`   Given public key:   ${publicKey}`);
  console.error(`   Derived from private: ${derivedPublicKey}`);
  failed = true;
}

process.exit(failed ? 1 : 0);
