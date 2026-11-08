import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/app/lib/escapeHtml";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";
import {
  invoiceDueDate, invoiceLimitError, invoiceLines, invoiceRecipient, invoiceSubject, money,
  type InvoiceLine,
} from "@/app/lib/invoiceEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";
const DAY_MS = 24 * 60 * 60 * 1000;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type InvoiceItem = InvoiceLine;

// Every value comes from the saved invoice and salon (never the request) and
// every piece of text is escaped, so nobody can put links or markup in it.
function buildInvoiceEmail({
  invoiceNumber,
  clientName,
  salonName,
  items,
  subtotal,
  taxRate,
  taxAmount,
  total,
  dueDate,
  notes,
  status,
}: {
  invoiceNumber: string;
  clientName: string;
  salonName: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  dueDate: string | null;
  notes: string | null;
  status: string;
}) {
  const safeSalonName = escapeHtml(salonName); // owner-provided
  const safeNumber = escapeHtml(invoiceNumber);
  const safeClientName = escapeHtml(clientName);
  const safeNotes = notes ? escapeHtml(notes).replace(/\r?\n/g, "<br/>") : "";
  const dueDateFormatted = dueDate
    ? new Date(dueDate + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#1e1e2e;">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#64748B;text-align:center;">${item.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#64748B;text-align:right;">£${item.price.toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;font-weight:700;color:#1e1e2e;text-align:right;">£${(item.price * item.qty).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 100%);padding:36px 32px;text-align:center;">
      <p style="color:rgba(255,255,255,0.7);margin:0 0 4px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;">${safeSalonName}</p>
      <h1 style="color:#fff;margin:8px 0 4px;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Invoice</h1>
      <p style="color:rgba(255,255,255,0.85);margin:0;font-size:16px;font-weight:600;letter-spacing:1px;">${safeNumber}</p>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:32px;">

      <p style="font-size:15px;margin:0 0 6px;color:#111;">Hi <strong>${safeClientName}</strong>,</p>
      <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px;">
        Please find your invoice from <strong>${safeSalonName}</strong> below. 
        ${dueDateFormatted ? `Payment is due by <strong>${dueDateFormatted}</strong>.` : ""}
      </p>

      <!-- Invoice meta -->
      <div style="background:#F8F5FF;border:1.5px solid #DDD6FE;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#7C3AED;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Invoice Number</div>
          <div style="font-size:15px;font-weight:800;color:#1e1e2e;font-family:monospace;">${safeNumber}</div>
        </div>
        ${dueDateFormatted ? `
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:700;color:#7C3AED;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Due Date</div>
          <div style="font-size:15px;font-weight:700;color:#1e1e2e;">${dueDateFormatted}</div>
        </div>` : ""}
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#64748B;text-align:left;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid #E2E8F0;">Service / Item</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#64748B;text-align:center;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid #E2E8F0;">Qty</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#64748B;text-align:right;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid #E2E8F0;">Price</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#64748B;text-align:right;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid #E2E8F0;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="background:#F8FAFC;border-radius:12px;padding:16px 20px;text-align:right;margin-bottom:24px;">
        <div style="font-size:13px;color:#64748B;margin-bottom:6px;">Subtotal: <strong style="color:#1e1e2e;">£${subtotal.toFixed(2)}</strong></div>
        <div style="font-size:13px;color:#64748B;margin-bottom:10px;">VAT (${taxRate}%): <strong style="color:#1e1e2e;">£${taxAmount.toFixed(2)}</strong></div>
        <div style="font-size:22px;font-weight:900;color:#7C3AED;">Total: £${total.toFixed(2)}</div>
      </div>

      ${safeNotes ? `
      <!-- Notes -->
      <div style="background:#FFFBF0;border:1px solid #FDE68A;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;color:#92400E;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Notes</div>
        <div style="font-size:14px;color:#78350F;line-height:1.6;">${safeNotes}</div>
      </div>` : ""}

      <!-- Status badge -->
      <div style="text-align:center;margin-bottom:8px;">
        <span style="display:inline-block;background:${status === "paid" ? "#D1FAE5" : "#EEF2FF"};color:${status === "paid" ? "#059669" : "#4F46E5"};font-size:13px;font-weight:700;padding:6px 20px;border-radius:999px;border:1.5px solid ${status === "paid" ? "#A7F3D0" : "#C7D2FE"};">
          ${status === "paid" ? "✓ Paid" : status === "sent" ? "Payment Due" : "Draft"}
        </span>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:18px 32px;text-align:center;">
      <p style="font-size:12px;color:#bbb;margin:0;line-height:1.8;">
        ${safeSalonName} &bull; Powered by Feature &bull; United Kingdom<br/>
        This is an automated invoice — please do not reply directly to this email.
      </p>
    </div>

  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  const locked = await dashboardLockedResponse(request); // the dashboard lock, on the server
  if (locked) return locked;
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only the invoice's id is read from the request. The address, names and
    // amounts all come from the saved invoice.
    const body = await request.json().catch(() => null);
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId.trim() : "";
    if (!invoiceId || invoiceId.length > 100) {
      return NextResponse.json({ error: "Missing invoice" }, { status: 400 });
    }
    const notFound = () => NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, salon_id, invoice_number, client_name, client_email, items, subtotal, tax_rate, tax_amount, total, due_date, notes, status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) {
      if (invErr.code === "22P02") return notFound(); // not a valid id
      console.error("[invoice email] invoice lookup failed:", invErr.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!invoice) return notFound();

    // Only the owner of the invoice's salon (any of their branches).
    const { data: salon, error: salonErr } = await supabaseAdmin
      .from("salons").select("id, name, owner_id").eq("id", invoice.salon_id).maybeSingle();
    if (salonErr) {
      console.error("[invoice email] salon lookup failed:", salonErr.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!salon || salon.owner_id !== user.id) return notFound();

    const to = invoiceRecipient(invoice.client_email);
    if (!to) {
      return NextResponse.json({ error: "Add a valid client email to this invoice first." }, { status: 400 });
    }

    // Daily limit: record this send first, then count the last 24 hours
    // (including it). The log is server-only — owners can't read or edit it.
    const { data: claim, error: claimErr } = await supabaseAdmin
      .from("invoice_email_log")
      .insert({ salon_id: salon.id, invoice_id: String(invoice.id), status: "sending" })
      .select("id").single();
    if (claimErr || !claim) {
      console.error("[invoice email] couldn't record the send:", claimErr?.message);
      return NextResponse.json({ error: "Invoice emails are unavailable right now. Please try again later." }, { status: 503 });
    }
    const mark = (fields: Record<string, unknown>) =>
      supabaseAdmin.from("invoice_email_log").update(fields).eq("id", claim.id);

    const since = new Date(Date.now() - DAY_MS).toISOString();
    const countSends = (invoiceOnly: boolean) => {
      let q = supabaseAdmin.from("invoice_email_log")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id).in("status", ["sending", "sent"]).gte("created_at", since);
      if (invoiceOnly) q = q.eq("invoice_id", String(invoice.id));
      return q;
    };
    const [salonSends, invoiceSends] = await Promise.all([countSends(false), countSends(true)]);
    if (salonSends.error || invoiceSends.error || salonSends.count === null || invoiceSends.count === null) {
      console.error("[invoice email] couldn't count sends:", salonSends.error?.message ?? invoiceSends.error?.message);
      await mark({ status: "failed", error: "count failed" });
      return NextResponse.json({ error: "Invoice emails are unavailable right now. Please try again later." }, { status: 503 });
    }
    const limitError = invoiceLimitError(salonSends.count, invoiceSends.count);
    if (limitError) {
      await mark({ status: "refused" });
      return NextResponse.json({ error: limitError, code: "invoice_email_limit" }, { status: 429 });
    }

    const html = buildInvoiceEmail({
      invoiceNumber: String(invoice.invoice_number ?? ""),
      clientName: String(invoice.client_name ?? ""),
      salonName: String(salon.name ?? ""),
      items: invoiceLines(invoice.items),
      subtotal: money(invoice.subtotal),
      taxRate: money(invoice.tax_rate),
      taxAmount: money(invoice.tax_amount),
      total: money(invoice.total),
      dueDate: invoiceDueDate(invoice.due_date),
      notes: typeof invoice.notes === "string" ? invoice.notes : null,
      status: String(invoice.status ?? "draft"),
    });

    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: invoiceSubject(invoice.invoice_number, salon.name, invoice.total),
      html,
    }, { idempotencyKey: `invoice-email:${claim.id}` });

    if (error) {
      console.error("[invoice email] Resend error:", error);
      await mark({ status: "failed", error: String(error.message ?? error).slice(0, 500) });
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    await mark({ status: "sent", resend_id: data?.id ?? null });
    console.log(`[invoice email] ✅ Sent invoice ${invoice.id} (log ${claim.id}, id=${data?.id})`);
    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("[invoice email] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
