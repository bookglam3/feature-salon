"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";

type Payment = {
  id: string;
  created_at: string;
  client_name?: string;
  service_name?: string;
  staff_name?: string;
  amount: number;
  status: "paid" | "pending" | "refunded" | "cancelled";
  method?: string;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  paid:      { bg: "#ECFDF5", color: "#166534" },
  pending:   { bg: "#FFFBEB", color: "#92400E" },
  refunded:  { bg: "#EEF2FF", color: "#4338CA" },
  cancelled: { bg: "#FEF2F2", color: "#DC2626" },
};

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "refunded" | "cancelled">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) { router.push("/login"); return; }
        setSalon(profile.salon);

        // Load payments — try "payments" table first, fallback to bookings
        const { data: paymentData } = await supabase
          .from("payments")
          .select("*")
          .eq("salon_id", profile.salon.id)
          .order("created_at", { ascending: false });

        if (paymentData && paymentData.length > 0) {
          setPayments(paymentData);
        } else {
          // Fallback: load from bookings table
          const { data: bookingData } = await supabase
            .from("bookings")
            .select("*")
            .eq("salon_id", profile.salon.id)
            .order("created_at", { ascending: false });

          const mapped: Payment[] = (bookingData || []).map((b: any) => ({
            id: b.id,
            created_at: b.created_at,
            client_name: b.client_name,
            service_name: b.service_name,
            staff_name: b.staff_name,
            amount: b.price || 0,
            status: b.status === "completed" ? "paid" : b.status === "cancelled" ? "cancelled" : "pending",
            method: b.payment_method || "—",
          }));
          setPayments(mapped);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const filtered = payments.filter((p) => {
    const matchStatus = filter === "all" || p.status === filter;
    const matchSearch =
      !searchTerm ||
      p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.staff_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Summary stats
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter(p => p.status === "refunded").reduce((s, p) => s + p.amount, 0);
  const countPending = payments.filter(p => p.status === "pending").length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>

      {/* Sidebar */}
      <div style={{ width: "220px", background: "#fff", borderRight: "0.5px solid #E8EAF0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A", letterSpacing: "-0.5px" }}>feature</div>
        </div>
        <div style={{ padding: "8px 0", flex: 1 }}>
          {[
            { label: "Dashboard", path: "/dashboard" },
            { label: "Bookings", path: "/dashboard/bookings" },
            { label: "Clients", path: "/dashboard/clients" },
            { label: "Staff", path: "/dashboard/staff" },
          ].map((item) => (
            <div key={item.label} onClick={() => router.push(item.path)}
              style={{ padding: "9px 20px", fontSize: "13px", color: pathname === item.path ? "#4F6EF7" : "#64748B", background: pathname === item.path ? "#EEF2FF" : "transparent", borderRight: pathname === item.path ? "2px solid #4F6EF7" : "none", cursor: "pointer" }}>
              {item.label}
            </div>
          ))}

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
          <div onClick={() => router.push("/dashboard/payments")}
            style={{ padding: "9px 20px", fontSize: "13px", color: "#4F6EF7", background: "#EEF2FF", borderRight: "2px solid #4F6EF7", cursor: "pointer" }}>
            Payments
          </div>
          <div onClick={() => router.push("/dashboard/reports")}
            style={{ padding: "9px 20px", fontSize: "13px", color: pathname === "/dashboard/reports" ? "#4F6EF7" : "#64748B", cursor: "pointer" }}>
            Reports
          </div>

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div onClick={() => router.push("/dashboard/settings")}
            style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Settings</div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name || "My Salon"}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Payments</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Payment activity & invoices</div>
          </div>
        </div>

        <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "Total Collected", value: `$${totalPaid.toLocaleString()}`, sub: `${payments.filter(p => p.status === "paid").length} payments`, color: "#166534", bg: "#ECFDF5" },
              { label: "Pending", value: `$${totalPending.toLocaleString()}`, sub: `${countPending} unpaid`, color: "#92400E", bg: "#FFFBEB" },
              { label: "Refunded", value: `$${totalRefunded.toLocaleString()}`, sub: `${payments.filter(p => p.status === "refunded").length} refunds`, color: "#4338CA", bg: "#EEF2FF" },
              { label: "All Transactions", value: payments.length, sub: "total records", color: "#0F172A", bg: "#F8F9FC" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "16px 18px" }}>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>{s.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "#0F172A" }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "4px", background: "#F2F4F7", borderRadius: "8px", padding: "3px" }}>
              {(["all", "paid", "pending", "refunded", "cancelled"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: "5px 12px", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer", background: filter === f ? "#fff" : "transparent", color: filter === f ? "#0F172A" : "#64748B", fontWeight: filter === f ? 500 : 400, boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none", textTransform: "capitalize" }}>
                  {f}
                </button>
              ))}
            </div>
            <input
              type="text" placeholder="Search client, service..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "8px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", width: "220px", fontFamily: "inherit" }}
            />
          </div>

          {/* Transactions Table */}
          <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                {payments.length === 0 ? "No payments yet" : "No results found"}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {["Date", "Client", "Service", "Staff", "Method", "Amount", "Status"].map((h) => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const sc = STATUS_COLORS[p.status] || STATUS_COLORS.pending;
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: "11px 18px", fontSize: "12px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9", whiteSpace: "nowrap" }}>
                          {formatDate(p.created_at)}
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>
                          {p.client_name || "—"}
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>
                          {p.service_name || "—"}
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>
                          {p.staff_name || "—"}
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "12px", color: "#94A3B8", borderBottom: "0.5px solid #F1F5F9" }}>
                          {p.method || "—"}
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", fontWeight: 500, color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>
                          ${p.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                          <span style={{ background: sc.bg, color: sc.color, fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textTransform: "capitalize" }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}