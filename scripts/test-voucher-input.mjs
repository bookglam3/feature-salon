/**
 * Unit tests for gift voucher input checks, money/date helpers, secure codes
 * and error messages (app/lib/vouchers/input.ts). Pure — no DB, no network.
 * Database rules (locking, balances, holds, other salons) are tested by
 * sql/2026-10-10-gift-vouchers-step2-test.sql and scripts/db-tests/.
 * Run: npm test   (or: node scripts/test-voucher-input.mjs)
 */

import {
  addMonths, defaultExpiry, formatPence, formatUkDate, generateVoucherCode, isUuid, parsePoundsToPence,
  ukToday, validateCancelReason, validateCreateInput, validateRedeemInput, voucherDisplayState, voucherErrorMessage,
} from "../app/lib/vouchers/input.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}
const SVC = "3f2b8c4e-1d2a-4b5c-8d9e-0a1b2c3d4e5f";
const SVC2 = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const NOW = new Date("2026-10-10T12:00:00Z");

console.log("\nMoney");
check("50 → 5000p", parsePoundsToPence("50"), 5000);
check("49.99 → 4999p", parsePoundsToPence("49.99"), 4999);
check("12.5 → 1250p", parsePoundsToPence("12.5"), 1250);
check("£1,250.00 → 125000p", parsePoundsToPence("£1,250.00"), 125000);
check("number 20 → 2000p", parsePoundsToPence(20), 2000);
check("0.01 → 1p", parsePoundsToPence("0.01"), 1);
check("three decimals rejected", parsePoundsToPence("1.005"), null);
check("negative rejected", parsePoundsToPence("-5"), null);
check("text rejected", parsePoundsToPence("ten"), null);
check("empty rejected", parsePoundsToPence(""), null);
check("1e3 rejected", parsePoundsToPence("1e3"), null);
check("format 125050 → £1,250.50", formatPence(125050), "£1,250.50");
check("format null → £0.00", formatPence(null), "£0.00");

console.log("\nDates (UK)");
check("UK today at 23:30 UTC in summer is the next day", ukToday(new Date("2026-07-01T23:30:00Z")), "2026-07-02");
check("UK today at 23:30 UTC in winter is the same day", ukToday(new Date("2026-12-01T23:30:00Z")), "2026-12-01");
check("+12 months", addMonths("2026-10-10", 12), "2027-10-10");
check("29 Feb + 12 months → 28 Feb", addMonths("2024-02-29", 12), "2025-02-28");
check("31 Jan + 1 month → 28 Feb", addMonths("2027-01-31", 1), "2027-02-28");
check("default expiry is 12 months from UK today", defaultExpiry(NOW), "2027-10-10");
check("format date", formatUkDate("2026-10-10"), "10 Oct 2026");

console.log("\nSecure codes");
const codes = new Set(Array.from({ length: 2000 }, () => generateVoucherCode()));
check("2000 codes, all different", codes.size, 2000);
check("format GV-XXXX-XXXX-XXXX with readable letters only", [...codes].every(c => /^GV-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(c)), true);
check("never 0, O, 1, I or L", [...codes].some(c => /[01OIL]/.test(c.slice(3))), false);
let calls = 0;
check("bytes ≥ 248 are rejected, not wrapped", generateVoucherCode(() => (calls++ === 0 ? new Uint8Array(16).fill(250) : new Uint8Array(16).fill(0))), "GV-AAAA-AAAA-AAAA");
check("uuid check", [isUuid(SVC), isUuid("nope"), isUuid(null)], [true, false, false]);

console.log("\nCreate — valid");
const money = validateCreateInput({ kind: "money", reference_mode: "generate", amount: "50", expires_on: "2027-10-10", buyer_name: "  Alice  ", buyer_email: "" }, NOW);
check("money voucher with generated code", money.ok && { kind: money.value.kind, paper: money.value.paperReference, amount: money.value.amountPence, buyer: money.value.buyerName, email: money.value.buyerEmail, exp: money.value.expiresOn },
  { kind: "money", paper: null, amount: 5000, buyer: "Alice", email: null, exp: "2027-10-10" });
const paper = validateCreateInput({ kind: "money", reference_mode: "paper", reference: "  0457 ", amount: "20", expires_on: null }, NOW);
check("paper reference is trimmed, no expiry allowed", paper.ok && [paper.value.paperReference, paper.value.expiresOn], ["0457", null]);
const svc = validateCreateInput({ kind: "service", reference_mode: "generate", services: [{ service_id: SVC, quantity: 2 }, { service_id: SVC2 }], amount: "999" }, NOW);
check("service voucher keeps services, ignores amount", svc.ok && [svc.value.amountPence, svc.value.services], [null, [{ service_id: SVC, quantity: 2 }, { service_id: SVC2, quantity: 1 }]]);
check("expiry today is allowed", validateCreateInput({ kind: "money", reference_mode: "generate", amount: "5", expires_on: "2026-10-10" }, NOW).ok, true);

console.log("\nCreate — refused with a clear message");
const err = (body) => { const r = validateCreateInput(body, NOW); return r.ok ? "ACCEPTED" : r.error; };
const base = { kind: "money", reference_mode: "generate", amount: "50" };
check("no body", err(null), "Missing voucher details.");
check("unknown type", err({ ...base, kind: "points" }), "Choose a money or a service voucher.");
check("no code choice", err({ ...base, reference_mode: undefined }), "Choose to generate a code or enter the paper voucher's reference.");
check("paper reference too short", err({ ...base, reference_mode: "paper", reference: " ab " }), "The voucher reference must be 3 to 40 characters.");
check("paper reference too long", err({ ...base, reference_mode: "paper", reference: "x".repeat(41) }), "The voucher reference must be 3 to 40 characters.");
check("paper reference with a tab", err({ ...base, reference_mode: "paper", reference: "AB\tC" }), "The voucher reference contains characters that aren't allowed.");
check("£0", err({ ...base, amount: "0" }), "Enter an amount between £0.01 and £5,000, e.g. 50 or 49.99.");
check("over £5,000", err({ ...base, amount: "5000.01" }), "Enter an amount between £0.01 and £5,000, e.g. 50 or 49.99.");
check("exactly £5,000 ok", err({ ...base, amount: "5000" }), "ACCEPTED");
check("service voucher with no services", err({ kind: "service", reference_mode: "generate", services: [] }), "Choose at least one service.");
check("service id not a uuid", err({ kind: "service", reference_mode: "generate", services: [{ service_id: "abc" }] }), "One of the chosen services isn't valid.");
check("quantity 0", err({ kind: "service", reference_mode: "generate", services: [{ service_id: SVC, quantity: 0 }] }), "Each service quantity must be 1 to 50.");
check("quantity 51", err({ kind: "service", reference_mode: "generate", services: [{ service_id: SVC, quantity: 51 }] }), "Each service quantity must be 1 to 50.");
check("same service twice", err({ kind: "service", reference_mode: "generate", services: [{ service_id: SVC }, { service_id: SVC }] }), "Each service can only be added once — change its quantity instead.");
check("21 service lines", err({ kind: "service", reference_mode: "generate", services: Array.from({ length: 21 }, (_, i) => ({ service_id: `3f2b8c4e-1d2a-4b5c-8d9e-0a1b2c3d4e${String(i).padStart(2, "0")}` })) }), "Choose up to 20 services.");
check("bad email", err({ ...base, recipient_email: "sarah@" }), "Recipient email doesn't look like an email address.");
check("bad phone", err({ ...base, buyer_phone: "call me" }), "Buyer phone should only contain digits, spaces, + - ( ).");
check("name too long", err({ ...base, buyer_name: "x".repeat(101) }), "Buyer name must be 100 characters or fewer.");
check("notes may have line breaks", err({ ...base, notes: "line 1\nline 2" }), "ACCEPTED");
check("expiry in the past", err({ ...base, expires_on: "2026-10-09" }), "The expiry date can't be in the past.");
check("expiry not a real date", err({ ...base, expires_on: "2027-02-30" }), "The expiry date isn't valid.");
check("expiry typo far in the future", err({ ...base, expires_on: "2206-10-10" }), "The expiry date must be within 10 years.");

console.log("\nRedeem and cancel");
check("partial amount", validateRedeemInput({ type: "amount", amount: "12.50", note: " cut " }), { ok: true, value: { type: "amount", amountPence: 1250, note: "cut", expiredOverride: false } });
check("goodwill only when explicitly true", validateRedeemInput({ type: "amount", amount: "5", expired_override: "yes" }).value.expiredOverride, false);
check("goodwill true", validateRedeemInput({ type: "amount", amount: "5", expired_override: true }).value.expiredOverride, true);
check("£0 refused", validateRedeemInput({ type: "amount", amount: "0" }).error, "Enter the amount to take off, e.g. 25 or 12.50.");
check("service needs a line", validateRedeemInput({ type: "service", voucher_service_id: "x" }).error, "Choose which service was used.");
check("service default quantity 1", validateRedeemInput({ type: "service", voucher_service_id: SVC }).value.quantity, 1);
check("unknown redeem type", validateRedeemInput({ type: "points" }).error, "Choose money or a service to redeem.");
check("note too long", validateRedeemInput({ type: "amount", amount: "1", note: "x".repeat(501) }).error, "Note must be 500 characters or fewer.");
check("cancel needs a reason", validateCancelReason({ reason: "  " }).error, "Give a reason for cancelling (at least 3 characters).");
check("cancel reason trimmed", validateCancelReason({ reason: "  Refunded  " }), { ok: true, value: "Refunded" });

console.log("\nDatabase errors → messages");
check("over-redeem names what's left", voucherErrorMessage("insufficient_balance", "3750"), { status: 409, message: "Only £37.50 is available on this voucher." });
check("nothing left", voucherErrorMessage("insufficient_balance", "0").message, "There's nothing left to use on this voucher.");
check("expired names the date and the goodwill route", voucherErrorMessage("voucher_expired", "2020-12-31").message, "This voucher expired on 31 Dec 2020. To accept it anyway, confirm a goodwill redemption.");
check("services left", voucherErrorMessage("service_used_up", "1").message, "Only 1 of this service is left on this voucher.");
check("duplicate reference", voucherErrorMessage("reference_taken").status, 409);
check("other salon's voucher looks like not found", voucherErrorMessage("voucher_not_found"), { status: 404, message: "Voucher not found." });
check("unknown error is generic, status 500", voucherErrorMessage("something odd"), { status: 500, message: "Something went wrong. Please try again." });
const named = ["voucher_not_found", "voucher_cancelled", "voucher_expired", "insufficient_balance", "service_used_up", "service_not_on_voucher",
  "wrong_voucher_kind", "invalid_amount", "invalid_quantity", "reference_taken", "invalid_reference", "invalid_expiry", "services_required",
  "too_many_services", "duplicate_service", "service_not_found", "reason_required", "reason_too_long", "already_cancelled", "voucher_has_holds",
  "invalid_kind", "invalid_source"];
check("every error the SQL raises has its own message", named.filter(n => voucherErrorMessage(n).status === 500), []);

console.log("\nBadges");
check("cancelled beats expired", voucherDisplayState({ status: "cancelled", kind: "money", is_expired: true, remaining_pence: 100 }), "cancelled");
check("expired beats used up", voucherDisplayState({ status: "active", kind: "money", is_expired: true, remaining_pence: 0 }), "expired");
check("money at £0 is used up", voucherDisplayState({ status: "active", kind: "money", is_expired: false, remaining_pence: 0 }), "used");
check("services all used", voucherDisplayState({ status: "active", kind: "service", is_expired: false, services_total: 2, services_used: 2 }), "used");
check("services left", voucherDisplayState({ status: "active", kind: "service", is_expired: false, services_total: 2, services_used: 1 }), "active");

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
