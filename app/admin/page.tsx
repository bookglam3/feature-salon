"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
      try {
        // ✅ AUTH CHECK
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user) {
          router.push("/login");
          return;
        }

        // ✅ ROLE CHECK (SECURE)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError || profile?.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        // ✅ FETCH DATA
        const [
          { data: salonData, error: salonError },
          { data: appointmentData, error: appointmentError },
        ] = await Promise.all([
          supabase
            .from("salons")
            .select(`
              id,
              name,
              plan,
              created_at,
              owner:profiles!salons_owner_id_fkey(email),
              appointments(id)
            `)
            .order("created_at", { ascending: false }),

          supabase
            .from("appointments")
            .select(`
              id,
              services(price)
            `),
        ]);

        if (salonError || appointmentError) {
          throw new Error(
            salonError?.message ||
              appointmentError?.message ||
              "Failed to load data"
          );
        }

        // ✅ MAP SALONS
        const mappedSalons = (salonData || []).map((salon: any) => ({
          ...salon,
          appointmentCount: salon.appointments?.length || 0,
        }));

        // ✅ CALCULATE REVENUE
        const revenue = (appointmentData || []).reduce(
          (sum: number, appt: any) =>
            sum + Number(appt.services?.price || 0),
          0
        );

        setSalons(mappedSalons);
        setTotalRevenue(revenue);
        setTotalBookings(appointmentData?.length || 0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAdmin();
  }, [router]);

  // ✅ UPDATE PLAN
  const updateSalonPlan = async (salonId: string, plan: string) => {
    const { error } = await supabase
      .from("salons")
      .update({ plan })
      .eq("id", salonId);

    if (error) {
      setError(error.message);
      return;
    }

    setSalons((prev) =>
      prev.map((s) => (s.id === salonId ? { ...s, plan } : s))
    );
  };

  // ✅ DELETE SALON
  const deleteSalon = async (salonId: string) => {
    if (!confirm("Delete this salon and all its data?")) return;

    const { error } = await supabase
      .from("salons")
      .delete()
      .eq("id", salonId);

    if (error) {
      setError(error.message);
      return;
    }

    setSalons((prev) => prev.filter((s) => s.id !== salonId));
  };

  // ✅ LOADING
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-xl">
        Loading admin...
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-2xl font-bold mb-6">Super Admin Dashboard</h1>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow">
          <p>Total Salons</p>
          <h2 className="text-3xl font-bold">{salons.length}</h2>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <p>Total Bookings</p>
          <h2 className="text-3xl font-bold">{totalBookings}</h2>
        </div>

        <div className="bg-white p-4 rounded-xl shadow">
          <p>Total Revenue</p>
          <h2 className="text-3xl font-bold">
            £{totalRevenue.toFixed(2)}
          </h2>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">
          {error}
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow overflow-auto">
        <table className="w-full text-left">
          <thead className="border-b">
            <tr>
              <th className="p-3">Salon</th>
              <th className="p-3">Owner Email</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Bookings</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {salons.map((salon) => (
              <tr key={salon.id} className="border-b">
                <td className="p-3">{salon.name}</td>

                <td className="p-3">
                  {salon.owner?.email || "N/A"}
                </td>

                <td className="p-3">
                  <select
                    value={salon.plan}
                    onChange={(e) =>
                      updateSalonPlan(salon.id, e.target.value)
                    }
                    className="border p-2 rounded"
                  >
                    {planOptions.map((plan) => (
                      <option key={plan}>{plan}</option>
                    ))}
                  </select>
                </td>

                <td className="p-3">
                  {salon.appointmentCount}
                </td>

                <td className="p-3">
                  {new Date(salon.created_at).toLocaleDateString("en-GB")}
                </td>

                <td className="p-3 text-center">
                  <button
                    onClick={() => deleteSalon(salon.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}