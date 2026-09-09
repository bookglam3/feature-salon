"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  items: { name: string; price: number; qty: number }[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: "draft" | "sent" | "paid";
  due_date: string;
  notes: string;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "#ECE9F1", color: "#524D60", label: "Draft" },
    sent:  { bg: "rgba(124,58,237,0.10)", color: "#7C3AED", label: "Sent" },
    paid:  { bg: "rgba(16,185,129,0.10)", color: "#10B981", label: "✓ Paid" },
  };
  const s = map[status] || map.draft;
  return <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>{s.label}</span>;
}

export default function InvoicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [form, setForm] = useState({ client_name: "", client_email: "", due_date: "", notes: "", tax_rate: 20 });
  const [items, setItems] = useState([{ name: "", price: "", qty: 1 }]);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      const { data } = await supabase.from("invoices").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: false });
      setInvoices(data || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0);
  const taxAmount = subtotal * (form.tax_rate / 100);
  const total = subtotal + taxAmount;

  const handleCreate = async () => {
    if (!salonId || !form.client_name || items.every(i => !i.name)) { toast.error("Fill required fields"); return; }
    // eslint-disable-next-line react-hooks/purity
    const num = `INV-${Date.now().toString().slice(-6)}`;
    const parsedItems = items.filter(i => i.name).map(i => ({ name: i.name, price: parseFloat(i.price) || 0, qty: i.qty }));
    const { data, error } = await supabase.from("invoices").insert({
      salon_id: salonId, invoice_number: num, client_name: form.client_name,
      client_email: form.client_email, items: parsedItems, subtotal,
      tax_rate: form.tax_rate, tax_amount: taxAmount, total,
      status: "draft", due_date: form.due_date || null, notes: form.notes,
    }).select().single();
    if (error) { toast.error("Failed to create invoice"); return; }
    setInvoices(p => [data, ...p]);
    toast.success(`Invoice ${num} created!`);
    setShowNew(false);
    setForm({ client_name: "", client_email: "", due_date: "", notes: "", tax_rate: 20 });
    setItems([{ name: "", price: "", qty: 1 }]);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setForm({ client_name: inv.client_name, client_email: inv.client_email, due_date: inv.due_date || "", notes: inv.notes || "", tax_rate: inv.tax_rate });
    setItems(inv.items.map(i => ({ name: i.name, price: String(i.price), qty: i.qty })));
    setSelected(null);
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingId || !form.client_name || items.every(i => !i.name)) { toast.error("Fill required fields"); return; }
    const parsedItems = items.filter(i => i.name).map(i => ({ name: i.name, price: parseFloat(i.price) || 0, qty: i.qty }));
    const sub = parsedItems.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = sub * (form.tax_rate / 100);
    const tot = sub + tax;
    const { data, error } = await supabase.from("invoices").update({
      client_name: form.client_name, client_email: form.client_email,
      items: parsedItems, subtotal: sub, tax_rate: form.tax_rate,
      tax_amount: tax, total: tot, due_date: form.due_date || null, notes: form.notes,
    }).eq("id", editingId).select().single();
    if (error) { toast.error("Failed to update invoice"); return; }
    setInvoices(p => p.map(i => i.id === editingId ? data : i));
    toast.success("Invoice updated!");
    setShowEdit(false);
    setEditingId(null);
    setForm({ client_name: "", client_email: "", due_date: "", notes: "", tax_rate: 20 });
    setItems([{ name: "", price: "", qty: 1 }]);
  };

  const handleDelete = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    setDeletingId(inv.id);
    const { error } = await supabase.from("invoices").delete().eq("id", inv.id);
    if (error) { toast.error("Failed to delete invoice"); setDeletingId(null); return; }
    setInvoices(p => p.filter(i => i.id !== inv.id));
    setSelected(null);
    setDeletingId(null);
    toast.success(`Invoice ${inv.invoice_number} deleted`);
  };

  const updateStatus = async (id: string, status: "draft" | "sent" | "paid") => {
    await supabase.from("invoices").update({ status }).eq("id", id);
    setInvoices(p => p.map(i => i.id === id ? { ...i, status } : i));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    toast.success(`Invoice marked as ${status}`);
  };

  const sendInvoiceEmail = async (inv: Invoice) => {
    if (!inv.client_email) { toast.error("No email address for this client"); return; }
    setSendingEmail(inv.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          invoiceNumber: inv.invoice_number,
          clientName: inv.client_name,
          clientEmail: inv.client_email,
          salonName,
          items: inv.items,
          subtotal: inv.subtotal,
          taxRate: inv.tax_rate,
          taxAmount: inv.tax_amount,
          total: inv.total,
          dueDate: inv.due_date,
          notes: inv.notes,
          status: inv.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Invoice emailed to ${inv.client_email}!`);
      // Auto-mark as sent if still draft
      if (inv.status === "draft") await updateStatus(inv.id, "sent");
    } catch {
      toast.error("Failed to send email — check client email address");
    } finally {
      setSendingEmail(null);
    }
  };

  const printInvoice = (inv: Invoice) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice ${inv.invoice_number}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#12101A}h1{color:#7C3AED}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #ECE9F1}th{background:#F5F3FF;font-size:12px;text-transform:uppercase;color:#6B6577}.total{font-size:18px;font-weight:900;color:#10B981}.badge{padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;background:${inv.status==="paid"?"rgba(16,185,129,0.10)":"rgba(124,58,237,0.10)"};color:${inv.status==="paid"?"#10B981":"#7C3AED"}}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px">
        <div><h1>INVOICE</h1><div style="font-size:24px;font-weight:900">${inv.invoice_number}</div></div>
        <div style="text-align:right"><div style="font-size:13px;color:#6B6577">Issued: ${new Date(inv.created_at).toLocaleDateString("en-GB")}</div>${inv.due_date?`<div style="font-size:13px;color:#6B6577">Due: ${new Date(inv.due_date+"T00:00:00").toLocaleDateString("en-GB")}</div>`:""}<span class="badge">${inv.status.toUpperCase()}</span></div>
      </div>
      <div style="margin-bottom:30px"><div style="font-size:11px;color:#6B6577;text-transform:uppercase;letter-spacing:1px">Bill To</div><div style="font-size:16px;font-weight:700;margin-top:4px">${inv.client_name}</div><div style="color:#524D60">${inv.client_email||""}</div></div>
      <table><thead><tr><th>Service / Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
      ${inv.items.map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>£${i.price.toFixed(2)}</td><td>£${(i.price*i.qty).toFixed(2)}</td></tr>`).join("")}
      </tbody></table>
      <div style="text-align:right;margin-top:20px"><div style="color:#524D60">Subtotal: £${inv.subtotal.toFixed(2)}</div><div style="color:#524D60">VAT (${inv.tax_rate}%): £${inv.tax_amount.toFixed(2)}</div><div class="total" style="margin-top:8px">Total: £${inv.total.toFixed(2)}</div></div>
      ${inv.notes?`<div style="margin-top:30px;padding:16px;background:#F5F3FF;border-radius:8px;font-size:13px;color:#524D60">${inv.notes}</div>`:""}
      </body></html>`);
    w.document.close();
    w.print();
  };

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Invoices</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Create & manage client invoices</div>
        </div>
      </div>
      <button onClick={() => setShowNew(true)} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>+ New Invoice</button>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Invoices", value: invoices.length, color: "#7C3AED" },
            { label: "Paid", value: invoices.filter(i => i.status === "paid").length, color: "#10B981" },
            { label: "Pending", value: invoices.filter(i => i.status === "sent").length, color: "#F59E0B" },
            { label: "Revenue Collected", value: `£${totalRevenue.toFixed(2)}`, color: "#10B981" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
              <div style={{ fontSize: 10, fontWeight: 800, color: "#524D60", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Invoice List */}
        <div style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          {invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ fontWeight: 700 }}>No invoices yet</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#F5F3FF" }}>
                    {["Invoice #", "Client", "Items", "Total", "Status", "Due Date", "Actions"].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 900, color: "#524D60", textAlign: "left", padding: "11px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid #ECE9F1" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} style={{ transition: "background 0.1s", cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#F5F3FF"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      onClick={() => setSelected(inv)}>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: "#7C3AED" }}>{inv.invoice_number}</td>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A" }}>{inv.client_name}</div>
                        <div style={{ fontSize: 11.5, color: "#524D60" }}>{inv.client_email}</div>
                      </td>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>{inv.items.length} item{inv.items.length !== 1 ? "s" : ""}</td>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 14, fontWeight: 900, color: "#10B981" }}>£{inv.total.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}><StatusBadge status={inv.status} /></td>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>{inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-GB") : "—"}</td>
                      <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button onClick={() => printInvoice(inv)} style={{ padding: "5px 10px", background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#524D60" }}>🖨️</button>
                          <button
                            onClick={() => sendInvoiceEmail(inv)}
                            disabled={!inv.client_email || sendingEmail === inv.id}
                            style={{ padding: "5px 10px", background: inv.client_email ? "rgba(124,58,237,0.10)" : "#F5F3FF", border: `1.5px solid ${inv.client_email ? "rgba(124,58,237,0.25)" : "#ECE9F1"}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: inv.client_email ? "pointer" : "not-allowed", color: inv.client_email ? "#7C3AED" : "#524D60", opacity: sendingEmail === inv.id ? 0.6 : 1 }}
                          >{sendingEmail === inv.id ? "Sending…" : "Email"}</button>
                          {inv.status !== "paid" && <button onClick={() => updateStatus(inv.id, inv.status === "draft" ? "sent" : "paid")} style={{ padding: "5px 10px", background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#10B981" }}>{inv.status === "draft" ? "Sent" : "Mark Paid"}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 32px 80px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A" }}>{selected.invoice_number}</div>
                <StatusBadge status={selected.status} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => openEdit(selected)} style={{ background: "rgba(124,58,237,0.10)", border: "1px solid #ECE9F1", color: "#7C3AED", borderRadius: 10, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                <button
                  onClick={() => handleDelete(selected)}
                  disabled={deletingId === selected.id}
                  style={{ background: "#F5F3FF", border: "1.5px solid #FECACA", color: "#EF4444", borderRadius: 10, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: deletingId === selected.id ? 0.6 : 1 }}
                >{deletingId === selected.id ? "Deleting…" : "Delete"}</button>
                <button onClick={() => setSelected(null)} style={{ background: "#ECE9F1", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, color: "#524D60" }}>✕</button>
              </div>
            </div>
            <div style={{ padding: "14px 16px", background: "#F5F3FF", borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A" }}>{selected.client_name}</div>
              <div style={{ fontSize: 12, color: "#524D60" }}>{selected.client_email}</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
              <thead><tr style={{ background: "#F5F3FF" }}>
                {["Item", "Qty", "Price", "Total"].map(h => <th key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 800, color: "#524D60", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}
              </tr></thead>
              <tbody>{selected.items.map((item, i) => (
                <tr key={i}><td style={{ padding: "8px 12px", fontSize: 13, color: "#12101A", borderBottom: "1px solid #ECE9F1" }}>{item.name}</td><td style={{ padding: "8px 12px", fontSize: 13, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>{item.qty}</td><td style={{ padding: "8px 12px", fontSize: 13, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>£{item.price.toFixed(2)}</td><td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#12101A", borderBottom: "1px solid #ECE9F1" }}>£{(item.price*item.qty).toFixed(2)}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#524D60" }}>Subtotal: £{selected.subtotal.toFixed(2)}</div>
              <div style={{ fontSize: 13, color: "#524D60" }}>VAT ({selected.tax_rate}%): £{selected.tax_amount.toFixed(2)}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#10B981", marginTop: 4 }}>Total: £{selected.total.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => printInvoice(selected)} style={{ flex: 1, minWidth: 120, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Print / PDF</button>
              <button
                onClick={() => sendInvoiceEmail(selected)}
                disabled={!selected.client_email || sendingEmail === selected.id}
                style={{ flex: 1, minWidth: 120, padding: 12, background: selected.client_email ? "linear-gradient(135deg,#7C3AED,#6D28D9)" : "#ECE9F1", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: selected.client_email ? "#fff" : "#6B6577", cursor: selected.client_email ? "pointer" : "not-allowed", opacity: sendingEmail === selected.id ? 0.7 : 1 }}
              >{sendingEmail === selected.id ? "Sending…" : "Email to Client"}</button>
              {selected.status !== "paid" && <button onClick={() => updateStatus(selected.id, selected.status === "draft" ? "sent" : "paid")} style={{ flex: 1, minWidth: 120, padding: 12, background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{selected.status === "draft" ? "Mark as Sent" : "Mark as Paid"}</button>}
            </div>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 32px 80px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>New Invoice</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Client Name *</label>
                  <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Sarah Johnson" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Email</label>
                  <input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="sarah@email.com" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 8 }}>Items *</label>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 32px", gap: 8, marginBottom: 8 }}>
                    <input value={item.name} onChange={e => { const n = [...items]; n[idx].name = e.target.value; setItems(n); }} placeholder="Service name" style={{ padding: "9px 12px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    <input type="number" value={item.qty} onChange={e => { const n = [...items]; n[idx].qty = parseInt(e.target.value)||1; setItems(n); }} min={1} style={{ padding: "9px 8px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", textAlign: "center", fontFamily: "inherit" }} />
                    <input type="number" value={item.price} onChange={e => { const n = [...items]; n[idx].price = e.target.value; setItems(n); }} placeholder="£0" style={{ padding: "9px 10px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} style={{ background: "#F5F3FF", border: "1.5px solid #FECACA", borderRadius: 10, cursor: "pointer", fontSize: 14, color: "#EF4444" }}>×</button>
                  </div>
                ))}
                <button onClick={() => setItems(p => [...p, { name: "", price: "", qty: 1 }])} style={{ padding: "7px 14px", background: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>+ Add Item</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>VAT Rate (%)</label>
                  <input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ padding: "14px 16px", background: "#F5F3FF", borderRadius: 12, textAlign: "right" }}>
                <div style={{ fontSize: 12.5, color: "#524D60" }}>Subtotal: £{subtotal.toFixed(2)}</div>
                <div style={{ fontSize: 12.5, color: "#524D60" }}>VAT ({form.tax_rate}%): £{taxAmount.toFixed(2)}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981", marginTop: 4 }}>Total: £{total.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Create Invoice</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Invoice Modal */}
      {showEdit && (
        <div onClick={() => { setShowEdit(false); setEditingId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 32px 80px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>Edit Invoice</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Client Name *</label>
                  <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Sarah Johnson" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Email</label>
                  <input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="sarah@email.com" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 8 }}>Items *</label>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 32px", gap: 8, marginBottom: 8 }}>
                    <input value={item.name} onChange={e => { const n = [...items]; n[idx].name = e.target.value; setItems(n); }} placeholder="Service name" style={{ padding: "9px 12px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    <input type="number" value={item.qty} onChange={e => { const n = [...items]; n[idx].qty = parseInt(e.target.value)||1; setItems(n); }} min={1} style={{ padding: "9px 8px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", textAlign: "center", fontFamily: "inherit" }} />
                    <input type="number" value={item.price} onChange={e => { const n = [...items]; n[idx].price = e.target.value; setItems(n); }} placeholder="£0" style={{ padding: "9px 10px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} style={{ background: "#F5F3FF", border: "1.5px solid #FECACA", borderRadius: 10, cursor: "pointer", fontSize: 14, color: "#EF4444" }}>×</button>
                  </div>
                ))}
                <button onClick={() => setItems(p => [...p, { name: "", price: "", qty: 1 }])} style={{ padding: "7px 14px", background: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>+ Add Item</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>VAT Rate (%)</label>
                  <input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes…" rows={2} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
              </div>
              <div style={{ padding: "14px 16px", background: "#F5F3FF", borderRadius: 12, textAlign: "right" }}>
                <div style={{ fontSize: 12.5, color: "#524D60" }}>Subtotal: £{subtotal.toFixed(2)}</div>
                <div style={{ fontSize: 12.5, color: "#524D60" }}>VAT ({form.tax_rate}%): £{taxAmount.toFixed(2)}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#10B981", marginTop: 4 }}>Total: £{total.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowEdit(false); setEditingId(null); }} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleUpdate} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
