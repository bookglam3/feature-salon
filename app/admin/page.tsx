"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "adilgill2k25@gmail.com";
const planOptions = ["starter", "pro", "premium"];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAdmin = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push("/dashboard");
        return;
      }

      const [{ data: salonData, error: salonError }, { data: appointmentData, error: appointmentError }] = await Promise.all([
        supabase
          .from("salons")
          .select(`
            id, name, plan, created_at, owner_id,
            profiles!inner(role),
            appointments(id)
          `)
          .eq("profiles.role", "owner")
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("id, services(price)"),
      ]);

      if (salonError || appointmentError) {
        setError(salonError?.message || appointmentError?.message || "Unable to load admin data.");
        setLoading(false);
        return;
      }

      const salonsWithCounts = (salonData || []).map((salon: any) => ({
        ...salon,
        appointmentCount: salon.appointments?.length || 0,
      }));

      const revenue = (appointmentData || []).reduce((sum: number, appointment: any) => {
        return sum + (appointment.services?.price || 0);
      }, 0);

      setSalons(salonsWithCounts);
      setTotalRevenue(revenue);
      setTotalBookings((appointmentData || []).length);
      setLoading(false);
    };

    loadAdmin();
  }, [router]);

  const updateSalonPlan = async (salonId: string, plan: string) => {
    const { error: updateError } = await supabase
      .from("salons")
      .update({ plan })
      .eq("id", salonId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSalons((prev) => prev.map((salon) => salon.id === salonId ? { ...salon, plan } : salon));
  };

  const deleteSalon = async (salonId: string) => {
    if (!confirm("Delete this salon and all its records?")) return;

    const { error: deleteError } = await supabase
      .from("salons")
      .delete()
      .eq("id", salonId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSalons((prev) => prev.filter((salon) => salon.id !== salonId));
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature admin</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F2F4F7", padding: "28px 32px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "center", marginBottom: "24px", "@media (max-width: 767px)": { marginBottom: "20px" } }}>
        <div>
          <div style={{ fontSize: "14px", color: "#64748B", marginBottom: "6px" }}>Super admin dashboard</div>
          <h1 style={{ margin: 0, fontSize: "32px", color: "#0F172A", "@media (max-width: 767px)": { fontSize: "24px" } }}>Platform overview</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginBottom: "24px", "@media (max-width: 767px)": { gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" } }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0", "@media (max-width: 767px)": { padding: "16px" } }}>
          <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Total salons</div>
          <div style={{ fontSize: "36px", color: "#0F172A", fontWeight: 700, "@media (max-width: 767px)": { fontSize: "28px" } }}>{salons.length}</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0", "@media (max-width: 767px)": { padding: "16px" } }}>
          <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Total bookings</div>
          <div style={{ fontSize: "36px", color: "#0F172A", fontWeight: 700, "@media (max-width: 767px)": { fontSize: "28px" } }}>{totalBookings}</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0", "@media (max-width: 767px)": { padding: "16px" } }}>
          <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Total revenue</div>
          <div style={{ fontSize: "36px", color: "#0F172A", fontWeight: 700, "@media (max-width: 767px)": { fontSize: "28px" } }}>£{totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "18px", padding: "16px", backgroundColor: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: "16px", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: "#ffffff", borderRadius: "24px", border: "0.5px solid #E8EAF0", overflow: "hidden", "@media (max-width: 767px)": { borderRadius: "16px" } }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 28px", borderBottom: "0.5px solid #E8EAF0", "@media (max-width: 767px)": { padding: "20px", flexDirection: "column", alignItems: "flex-start", gap: "12px" } }}>
          <div>
            <div style={{ fontSize: "14px", color: "#64748B", marginBottom: "6px" }}>Salons</div>
            <h2 style={{ margin: 0, fontSize: "20px", color: "#0F172A", "@media (max-width: 767px)": { fontSize: "18px" } }}>Registered salons</h2>
          </div>
        </div>

        {/* Desktop Table */}
        <div style={{ overflowX: "auto", "@media (max-width: 767px)": { display: "none" } }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "0.5px solid #E8EAF0" }}>
                <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Salon</th>
                <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Owner email</th>
                <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Plan</th>
                <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Bookings</th>
                <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Created</th>
                <th style={{ padding: "16px 18px", textAlign: "center", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {salons.map((salon) => (
                <tr key={salon.id} style={{ borderBottom: "0.5px solid #F1F5F9" }}>
                  <td style={{ padding: "16px 18px", fontSize: "14px", color: "#0F172A" }}>{salon.name}</td>
                  <td style={{ padding: "16px 18px", fontSize: "14px", color: "#64748B" }}>{salon.owner_id}</td>
                  <td style={{ padding: "16px 18px", fontSize: "14px", color: "#0F172A" }}>
                    <select
                      value={salon.plan}
                      onChange={(event) => updateSalonPlan(salon.id, event.target.value)}
                      style={{ padding: "10px 12px", borderRadius: "12px", border: "0.5px solid #E8EAF0", color: "#0F172A", fontSize: "14px", backgroundColor: "#ffffff", cursor: "pointer" }}
                    >
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>{plan}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "16px 18px", fontSize: "14px", color: "#0F172A" }}>{salon.appointmentCount}</td>
                  <td style={{ padding: "16px 18px", fontSize: "14px", color: "#64748B" }}>{new Date(salon.created_at).toLocaleDateString("en-GB")}</td>
                  <td style={{ padding: "16px 18px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => deleteSalon(salon.id)}
                      style={{ border: "none", backgroundColor: "#FEE2E2", color: "#B91C1C", borderRadius: "12px", padding: "10px 14px", cursor: "pointer", fontSize: "14px" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div style={{ "@media (min-width: 768px)": { display: "none" } }}>
          {salons.map((salon) => (
            <div key={salon.id} style={{ padding: "20px", borderBottom: "0.5px solid #F1F5F9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 500, color: "#0F172A", marginBottom: "4px" }}>{salon.name}</div>
                  <div style={{ fontSize: "13px", color: "#64748B" }}>{salon.owner_id}</div>
                </div>
                <select
                  value={salon.plan}
                  onChange={(event) => updateSalonPlan(salon.id, event.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "8px", border: "0.5px solid #E8EAF0", color: "#0F172A", fontSize: "13px", backgroundColor: "#ffffff", cursor: "pointer" }}
                >
                  {planOptions.map((plan) => (
                    <option key={plan} value={plan}>{plan}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "#64748B" }}>
                  {salon.appointmentCount} bookings • Created {new Date(salon.created_at).toLocaleDateString("en-GB")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteSalon(salon.id)}
                style={{ border: "none", backgroundColor: "#FEE2E2", color: "#B91C1C", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "13px", width: "100%" }}
              >
                Delete Salon
              </button>
            </div>
          ))}
        </div>
    </div>
  );
}
}
