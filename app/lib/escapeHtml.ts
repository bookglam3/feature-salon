/**
 * Escape a value for safe insertion into HTML (email templates).
 * Use for any owner- or user-provided text — salon names, addresses — so a
 * name like `<a href=…>` renders as text instead of becoming markup.
 * Not needed for email subjects (plain text) or values already passed
 * through encodeURIComponent.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
