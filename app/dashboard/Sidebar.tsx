"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ICON_MAP, StaffIconByKey } from "./components/DashboardIcons";
import { useSalon } from "./context/SalonContext";

// ─────────────────────────────────────────────────────────────────
// Section colors — gradient + glow per group
// ─────────────────────────────────────────────────────────────────
const SECTION: Record<string, {
  grad: string;   // active icon bg gradient (Tailwind)
  dimBg: string;  // inactive icon bg (inline rgba)
  glow: string;   // box-shadow glow color
  border: string; // active row left border color
}> = {
  MAIN:       { grad: "from-violet-600 to-violet-400",  dimBg: "rgba(201,162,75,0.18)", glow: "rgba(201,162,75,0.55)",  border: "rgba(201,162,75,0.9)" },
  FINANCE:    { grad: "from-emerald-600 to-emerald-400",dimBg: "rgba(5,150,105,0.18)",  glow: "rgba(5,150,105,0.55)",   border: "rgba(52,211,153,0.9)" },
  ENGAGEMENT: { grad: "from-blue-600 to-blue-400",      dimBg: "rgba(37,99,235,0.18)",  glow: "rgba(37,99,235,0.55)",   border: "rgba(96,165,250,0.9)" },
  CONTENT:    { grad: "from-pink-600 to-pink-400",      dimBg: "rgba(219,39,119,0.18)", glow: "rgba(219,39,119,0.55)",  border: "rgba(244,114,182,0.9)" },
  SYSTEM:     { grad: "from-slate-500 to-slate-400",    dimBg: "rgba(71,85,105,0.18)",  glow: "rgba(71,85,105,0.45)",   border: "rgba(148,163,184,0.9)" },
};

// ─────────────────────────────────────────────────────────────────
// Nav structure
// ─────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  { group: "MAIN", items: [
    { label: "Dashboard",      path: "/dashboard" },
    { label: "Calendar",       path: "/dashboard/calendar" },
    { label: "Bookings",       path: "/dashboard/bookings" },
    { label: "Waitlist",       path: "/dashboard/waitlist" },
    { label: "Clients",        path: "/dashboard/clients" },
    { label: "Staff",          path: "/dashboard/staff" },
  ]},
  { group: "FINANCE", items: [
    { label: "Payments",       path: "/dashboard/payments" },
    { label: "Earnings",       path: "/dashboard/earnings" },
    { label: "Tips",           path: "/dashboard/tips" },
    { label: "Invoices",       path: "/dashboard/invoices" },
    { label: "Reports",        path: "/dashboard/reports" },
    { label: "Gift Cards",     path: "/dashboard/gift-cards" },
  ]},
  { group: "ENGAGEMENT", items: [
    { label: "Reviews",        path: "/dashboard/reviews" },
    { label: "Loyalty",        path: "/dashboard/loyalty" },
    { label: "Referrals",      path: "/dashboard/referrals" },
    { label: "Broadcast",      path: "/dashboard/broadcast" },
    { label: "Automations",    path: "/dashboard/automations" },
    { label: "Client Portal",  path: "/dashboard/client-portal" },
  ]},
  { group: "CONTENT", items: [
    { label: "Gallery",        path: "/dashboard/gallery" },
  ]},
  { group: "SYSTEM", items: [
    { label: "Closed Dates",   path: "/dashboard/closed-dates" },
    { label: "Settings",       path: "/dashboard/settings" },
  ]},
];

const MOBILE_NAV = [
  { label: "Dashboard",  path: "/dashboard",           group: "MAIN" },
  { label: "Calendar",   path: "/dashboard/calendar",  group: "MAIN" },
  { label: "Bookings",   path: "/dashboard/bookings",  group: "MAIN" },
  { label: "Clients",    path: "/dashboard/clients",   group: "MAIN" },
  { label: "Staff",      path: "/dashboard/staff",     group: "MAIN" },
  { label: "Settings",   path: "/dashboard/settings",  group: "SYSTEM" },
];

// ─────────────────────────────────────────────────────────────────
// IconBox component
// ─────────────────────────────────────────────────────────────────
function IconBox({ label, group, active, staffIconKey }: { label: string; group: string; active: boolean; staffIconKey?: string }) {
  const s = SECTION[group];
  const Icon = label === "Staff" && staffIconKey
    ? (StaffIconByKey[staffIconKey] ?? NAV_ICON_MAP[label])
    : NAV_ICON_MAP[label];

  return (
    <div
      className={[
        // base layout
        "flex items-center justify-center",
        "w-9 h-9 rounded-[10px] shrink-0",
        // transition — scale + brightness
        "transition-all duration-200 ease-out",
        // hover: brighter bg + scale 1.1 (handled by parent group)
        "group-hover/item:scale-110",
        // active: full gradient
        active
          ? `bg-gradient-to-br ${s.grad}`
          : "",
      ].join(" ")}
      style={{
        background: active ? undefined : s.dimBg,
        border: `1px solid ${active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)"}`,
        boxShadow: active
          ? `0 0 14px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`
          : "none",
        transform: active ? "scale(1.05)" : undefined,
      }}
    >
      {Icon && (
        <Icon
          size={18}
          strokeWidth={1.6}
          className={[
            "transition-all duration-200 ease-out",
            "group-hover/item:scale-110",
            active ? "text-white" : "text-white/55",
          ].join(" ")}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────────────────────────
export default function DashboardSidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { vc } = useSalon();
  const [isMobile, setIsMobile] = useState(false);

  const displayLabel = (key: string) => {
    if (key === "Staff")         return vc.staffPlural;
    if (key === "Bookings")      return vc.bookingPlural;
    if (key === "Clients")       return vc.clientPlural;
    if (key === "Client Portal") return vc.portalName;
    return key;
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path);

  // ── Mobile bottom nav ────────────────────────────────────────
  if (isMobile) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center overflow-x-auto"
        style={{
          height: 64,
          background: "rgba(15,11,45,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.09)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {MOBILE_NAV.map((item) => {
          const active = isActive(item.path);
          const s = SECTION[item.group];
          const Icon = NAV_ICON_MAP[item.label];
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.path)}
              className="group/mob flex flex-col items-center justify-center gap-1 flex-1 min-w-[52px] shrink-0 border-none bg-transparent cursor-pointer"
            >
              <div
                className={[
                  "flex items-center justify-center w-9 h-9 rounded-[10px]",
                  "transition-all duration-200 ease-out",
                  "group-hover/mob:scale-110",
                  active ? `bg-gradient-to-br ${s.grad}` : "",
                ].join(" ")}
                style={{
                  background: active ? undefined : "rgba(255,255,255,0.05)",
                  boxShadow: active ? `0 0 12px ${s.glow}` : "none",
                }}
              >
                {Icon && (
                  <Icon
                    size={18}
                    strokeWidth={1.6}
                    className={[
                      "transition-all duration-200 ease-out",
                      "group-hover/mob:scale-110",
                      active ? "text-white" : "text-white/38",
                    ].join(" ")}
                  />
                )}
              </div>
              <span
                className={[
                  "text-[9px] tracking-[0.3px] whitespace-nowrap transition-colors duration-200",
                  active ? "text-white font-semibold" : "text-white/38 font-normal",
                ].join(" ")}
              >
                {displayLabel(item.label)}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  // ── Desktop sidebar ──────────────────────────────────────────
  return (
    <aside
      className="flex flex-col sticky top-0 overflow-y-auto overflow-x-hidden"
      style={{
        width: 248, minWidth: 248, height: "100vh",
        background: "linear-gradient(180deg,#0F0B2D 0%,#1a1040 45%,#F7F5EF 100%)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Logo */}
      <div
        className="shrink-0 px-5 pt-6 pb-[18px]"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="font-serif text-[22px] text-white tracking-[-0.5px]"
          style={{ textShadow: "0 0 24px rgba(167,139,250,0.55)" }}
        >
          feature
        </div>
        <div className="text-[10px] text-white/25 mt-[2px] tracking-[0.6px] uppercase">
          {vc.productName}
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 flex flex-col px-[10px] py-[10px]">
        {NAV_GROUPS.map((group, gi) => {
          const s = SECTION[group.group];
          return (
            <div key={group.group} className={gi > 0 ? "mt-3" : ""}>
              {/* Group label */}
              <div className="text-[9px] font-bold tracking-[1.2px] text-white/18 px-[10px] pb-[7px] pt-[2px] uppercase">
                {group.group}
              </div>

              {/* Nav items */}
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.path)}
                    // group/item enables group-hover on children
                    className={[
                      "group/item w-full border-none cursor-pointer",
                      "flex items-center gap-3",
                      "px-2 py-[5px] rounded-xl mb-[2px]",
                      "transition-all duration-200 ease-out",
                      // hover: brightened background
                      active
                        ? "bg-white/[0.07]"
                        : "bg-transparent hover:bg-white/[0.05]",
                    ].join(" ")}
                    style={{
                      borderLeft: `2px solid ${active ? s.border : "transparent"}`,
                      boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.07)" : "none",
                    }}
                  >
                    <IconBox label={item.label} group={group.group} active={active} staffIconKey={item.label === "Staff" ? vc.staffIcon : undefined} />

                    <span
                      className={[
                        "text-[13px] tracking-[0.1px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left",
                        "transition-colors duration-200",
                        active ? "text-white font-semibold" : "text-white/48 font-normal",
                      ].join(" ")}
                    >
                      {displayLabel(item.label)}
                    </span>

                    {/* Active dot indicator */}
                    {active && (
                      <div
                        className="w-[5px] h-[5px] rounded-full shrink-0"
                        style={{
                          background: `linear-gradient(135deg,${s.grad.includes("violet") ? "#C9A24B,#C9A24B" : s.grad.includes("emerald") ? "#059669,#34D399" : s.grad.includes("blue") ? "#2563EB,#60A5FA" : s.grad.includes("pink") ? "#DB2777,#F472B6" : "#475569,#64748B"})`,
                          boxShadow: `0 0 7px ${s.glow}`,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer glass card */}
      <div
        className="mx-[10px] mb-[14px] rounded-xl px-[14px] py-[11px] shrink-0"
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="text-[10px] font-bold text-white/30 mb-1 tracking-[0.5px]">
          {vc.footerBrand}
        </div>
        <div className="text-[10px] text-white/20 leading-relaxed">
          v2.0 · {vc.footerTagline}
        </div>
      </div>
    </aside>
  );
}