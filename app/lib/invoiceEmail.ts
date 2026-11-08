/**
 * Invoice emails (POST /api/send-invoice): who may receive one, how many a
 * day, and cleaning the stored invoice values used in the email.
 *
 * The route sends only a SAVED invoice of the signed-in owner's own salon, to
 * the email address saved on that invoice — never an address, name or amount
 * taken from the request. No imports, so the unit tests run it directly.
 */

/** Per salon, rolling 24 hours (all invoices together). */
export const MAX_INVOICE_EMAILS_PER_DAY = 50;
/** Per invoice, rolling 24 hours — stops one client being emailed over and over. */
export const MAX_EMAILS_PER_INVOICE_PER_DAY = 3;

/** The invoice's own saved email, when it is ONE usable address; otherwise null. */
export function invoiceRecipient(saved: unknown): string | null {
  if (typeof saved !== "string") return null;
  const email = saved.trim();
  if (!email || email.length > 254) return null;
  return /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+$/.test(email) ? email : null;
}

/**
 * Both counts INCLUDE this send (the route records it first, then counts, so
 * two clicks at the same moment can't both slip under the limit).
 * Returns the message to show, or null when the email may go.
 */
export function invoiceLimitError(salonSendsLast24h: number, invoiceSendsLast24h: number): string | null {
  if (invoiceSendsLast24h > MAX_EMAILS_PER_INVOICE_PER_DAY) {
    return `This invoice has already been emailed ${MAX_EMAILS_PER_INVOICE_PER_DAY} times in the last 24 hours. Please try again tomorrow.`;
  }
  if (salonSendsLast24h > MAX_INVOICE_EMAILS_PER_DAY) {
    return `Daily limit reached: ${MAX_INVOICE_EMAILS_PER_DAY} invoice emails per 24 hours. Please try again tomorrow.`;
  }
  return null;
}

/** A saved amount as a finite number (anything else = 0). */
export function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface InvoiceLine { name: string; qty: number; price: number }

/** Saved invoice items → clean lines (at most 100). */
export function invoiceLines(items: unknown): InvoiceLine[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .slice(0, 100)
    .map(i => ({ name: String(i.name ?? "").slice(0, 200), qty: money(i.qty), price: money(i.price) }));
}

/** A due date only when it is a real YYYY-MM-DD date. */
export function invoiceDueDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(value + "T00:00:00Z")) ? null : value;
}

/** Subject line: plain text on one line. */
export function invoiceSubject(invoiceNumber: unknown, salonName: unknown, total: unknown): string {
  const oneLine = (v: unknown) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 80);
  return `Invoice ${oneLine(invoiceNumber)} from ${oneLine(salonName)} — £${money(total).toFixed(2)}`;
}
