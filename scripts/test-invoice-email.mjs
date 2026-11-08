/**
 * Unit tests for app/lib/invoiceEmail.ts — who may receive an invoice email,
 * the daily limits, and cleaning the saved invoice values used in the email.
 * Run: npm test   (or: node scripts/test-invoice-email.mjs)
 */

import {
  MAX_INVOICE_EMAILS_PER_DAY, MAX_EMAILS_PER_INVOICE_PER_DAY,
  invoiceRecipient, invoiceLimitError, money, invoiceLines, invoiceDueDate, invoiceSubject,
} from "../app/lib/invoiceEmail.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

console.log("\nRecipient — the invoice's own saved address, one address only");
check("a normal address", invoiceRecipient("jo@example.com"), "jo@example.com");
check("spaces around it are trimmed", invoiceRecipient("  jo@example.com "), "jo@example.com");
check("empty / missing → none", [invoiceRecipient(""), invoiceRecipient(null), invoiceRecipient(undefined), invoiceRecipient(42)], [null, null, null, null]);
check("not an address → none", [invoiceRecipient("jo"), invoiceRecipient("jo@example"), invoiceRecipient("@example.com")], [null, null, null]);
check("two addresses in one (comma, semicolon, space) → none", [
  invoiceRecipient("a@x.com,b@y.com"), invoiceRecipient("a@x.com;b@y.com"), invoiceRecipient("a@x.com b@y.com"),
], [null, null, null]);
check("a display name / angle brackets → none", invoiceRecipient("Jo <jo@example.com>"), null);
check("too long → none", invoiceRecipient("a".repeat(250) + "@x.com"), null);

console.log("\nDaily limits (counts include this send)");
check("limits are 50 per salon and 3 per invoice", [MAX_INVOICE_EMAILS_PER_DAY, MAX_EMAILS_PER_INVOICE_PER_DAY], [50, 3]);
check("first send → ok", invoiceLimitError(1, 1), null);
check("3rd send of the same invoice → ok", invoiceLimitError(3, 3), null);
check("4th send of the same invoice → refused", invoiceLimitError(4, 4), "This invoice has already been emailed 3 times in the last 24 hours. Please try again tomorrow.");
check("50th invoice email of the salon → ok", invoiceLimitError(50, 1), null);
check("51st invoice email of the salon → refused", invoiceLimitError(51, 1), "Daily limit reached: 50 invoice emails per 24 hours. Please try again tomorrow.");

console.log("\nSaved values used in the email");
check("money: numbers and number strings", [money(12.5), money("7.25"), money(0)], [12.5, 7.25, 0]);
check("money: anything else is 0", [money(null), money("abc"), money(Infinity), money(undefined)], [0, 0, 0, 0]);
check("items: cleaned", invoiceLines([{ name: "Cut", qty: "2", price: "15" }, null, "x", { name: 5 }]), [
  { name: "Cut", qty: 2, price: 15 }, { name: "5", qty: 0, price: 0 },
]);
check("items: not a list → none", [invoiceLines(null), invoiceLines("Cut")], [[], []]);
check("items: at most 100, names at most 200 characters", [
  invoiceLines(Array.from({ length: 150 }, () => ({ name: "a", qty: 1, price: 1 }))).length,
  invoiceLines([{ name: "b".repeat(300), qty: 1, price: 1 }])[0].name.length,
], [100, 200]);
check("due date: a real date", invoiceDueDate("2026-12-01"), "2026-12-01");
check("due date: anything else → none", [invoiceDueDate(""), invoiceDueDate(null), invoiceDueDate("01/12/2026"), invoiceDueDate("2026-13-45")], [null, null, null, null]);
check("subject", invoiceSubject("INV-123456", "Jo's Salon", 42), "Invoice INV-123456 from Jo's Salon — £42.00");
check("subject: one line, even if a name has line breaks", invoiceSubject("INV-1\r\nBcc: x@y.com", "A\nB", "x"), "Invoice INV-1 Bcc: x@y.com from A B — £0.00");
check("subject: long names are cut", invoiceSubject("INV-1", "S".repeat(200), 1).length, "Invoice INV-1 from ".length + 80 + " — £1.00".length);

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
