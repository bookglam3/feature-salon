"use client";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Bookings", path: "/dashboard/bookings" },
  { label: "Clients", path: "/dashboard/clients" },
  { label: "Staff", path: "/dashboard/staff" },
  { label: "Payments", path: "/dashboard/payments" },
  { label: "Reports", path: "/dashboard/reports" },
  { label: "Settings", path: "/dashboard/settings" },
];

export default function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside style={{
      width: "220px",
      backgroundColor: "#ffffff",
      borderRight: "0.5px solid #E8EAF0",
      padding: "24px 0",
    }}>
      <div style={{ padding: "0 24px", marginBottom: "28px" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "#0F172A", letterSpacing: "-0.5px" }}>feature</div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "0 6px" }}>
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.path)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "12px 24px",
                border: "none",
                backgroundColor: active ? "#EEF2FF" : "transparent",
                color: active ? "#4F6EF7" : "#475569",
                fontSize: "14px",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                borderLeft: active ? "4px solid #4F6EF7" : "4px solid transparent",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}