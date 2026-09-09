"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { NAV_ICON_MAP, StaffIconByKey, LogOutIcon } from "./DashboardIcons";
import type { LucideProps } from "lucide-react";
import { useSalon } from "../context/SalonContext";

const SUPER_ADMIN_EMAIL = "adilgill2008@gmail.com";

// ─────────────────────────────────────────────────────────────────
// Section color themes per nav group
// ─────────────────────────────────────────────────────────────────
const SECTION_COLORS: Record<string, {
  grad: string;
  dimBg: string;
  glow: string;
  border: string;
  labelColor: string;
}> = {
  Main:       { grad: "linear-gradient(135deg,#7C3AED,#6D28D9)",  dimBg: "rgba(124,58,237,0.10)",  glow: "rgba(124,58,237,0.35)", border: "#7C3AED", labelColor: "#6B6577" },
  Finance:    { grad: "linear-gradient(135deg,#7C3AED,#6D28D9)",  dimBg: "rgba(124,58,237,0.10)",  glow: "rgba(124,58,237,0.35)", border: "#7C3AED", labelColor: "#6B6577" },
  Engagement: { grad: "linear-gradient(135deg,#7C3AED,#6D28D9)",  dimBg: "rgba(124,58,237,0.10)",  glow: "rgba(124,58,237,0.35)", border: "#7C3AED", labelColor: "#6B6577" },
  Content:    { grad: "linear-gradient(135deg,#7C3AED,#6D28D9)",  dimBg: "rgba(124,58,237,0.10)",  glow: "rgba(124,58,237,0.35)", border: "#7C3AED", labelColor: "#6B6577" },
  System:     { grad: "linear-gradient(135deg,#7C3AED,#6D28D9)",  dimBg: "rgba(124,58,237,0.10)",  glow: "rgba(124,58,237,0.35)", border: "#7C3AED", labelColor: "#6B6577" },
};

// ─────────────────────────────────────────────────────────────────
// Nav structure
// ─────────────────────────────────────────────────────────────────
const NAV = [
  {
    group: "Main",
    items: [
      { label: "Dashboard",    path: "/dashboard" },
      { label: "Calendar",     path: "/dashboard/calendar" },
      { label: "Bookings",     path: "/dashboard/bookings" },
      { label: "Waitlist",     path: "/dashboard/waitlist" },
      { label: "Clients",      path: "/dashboard/clients" },
      { label: "Import Clients", path: "/dashboard/clients/import" },
      { label: "Staff",        path: "/dashboard/staff" },
      { label: "Services",     path: "/dashboard/services" },
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Payments",     path: "/dashboard/payments" },
      { label: "Earnings",     path: "/dashboard/earnings" },
      { label: "Tips",         path: "/dashboard/tips" },
      { label: "Invoices",     path: "/dashboard/invoices" },
      { label: "Reports",      path: "/dashboard/reports" },
      { label: "Gift Cards",   path: "/dashboard/gift-cards" },
    ],
  },
  {
    group: "Engagement",
    items: [
      { label: "Reviews",      path: "/dashboard/reviews" },
      { label: "Loyalty",      path: "/dashboard/loyalty" },
      { label: "Referrals",    path: "/dashboard/referrals" },
      { label: "Broadcast",    path: "/dashboard/broadcast" },
      { label: "Automations",  path: "/dashboard/automations" },
      { label: "Client Portal",path: "/dashboard/client-portal" },
    ],
  },
  {
    group: "Content",
    items: [
      { label: "Gallery",      path: "/dashboard/gallery" },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Closed Dates", path: "/dashboard/closed-dates" },
      { label: "Partners",     path: "/dashboard/partners" },
      { label: "Settings",     path: "/dashboard/settings" },
    ],
  },
];

interface SidebarProps {
  salonName?: string;
  onClose?: () => void;
  onLogout: () => void;
  onMenuClick?: () => void;
}

type IconComp = React.FC<{ size?: number; className?: string; strokeWidth?: number }>;

export default function Sidebar({ salonName, onClose, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const { salons, activeSalon, switchSalon, vc } = useSalon();

  const displayLabel = (key: string) => {
    if (key === "Staff")         return vc.staffPlural;
    if (key === "Bookings")      return vc.bookingPlural;
    if (key === "Clients")       return vc.clientPlural;
    if (key === "Client Portal") return vc.portalName;
    return key;
  };
  const hasMultiBranch = salons.length > 1;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email ?? null);
      setAdminLoaded(true);
    });
  }, []);

  // Partners is only visible to super admin — hide until check resolves
  const isAdmin = adminLoaded && userEmail === SUPER_ADMIN_EMAIL;

  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path);

  const initials = (salonName || "S")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <style>{`
        .sb-wrap {
          width: 100%;
          max-width: var(--sidebar-w);
          background: linear-gradient(180deg,#FFFFFF,#FBFAFD);
          border-right: 1px solid #ECE9F1;
          display: flex; flex-direction: column;
          height: 100%; overflow: hidden;
          position: relative;
        }
        /* Ambient glow behind sidebar */
        .sb-wrap::before {
          content: "";
          position: absolute;
          top: 60px; left: -40px;
          width: 160px; height: 160px;
          background: radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }
        /* Glass nav link base */
        .sb-link {
          display: flex; align-items: center; gap: 10px;
          padding: 5px 8px; border-radius: 11px;
          font-size: 13px; font-weight: 500;
          color: #524D60;
          background: transparent;
          text-decoration: none; margin-bottom: 1px;
          transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
          position: relative;
          border: 1px solid transparent;
        }
        .sb-link:hover {
          background: #F5F3FF;
          color: #12101A;
          transform: translateX(2px);
          border-color: #ECE9F1;
        }
        .sb-link.active {
          background: #EDE9FF;
          color: #6D28D9;
          font-weight: 700;
          border-color: transparent;
        }
        /* Icon box inside link */
        .sb-icon-box {
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
        }
        .sb-link:hover .sb-icon-box {
          transform: scale(1.1);
        }
        /* Active dot */
        .sb-active-dot {
          width: 4px; height: 4px; border-radius: 50%;
          flex-shrink: 0; margin-left: auto;
          animation: sbDotPulse 2.4s ease-in-out infinite;
        }
        @keyframes sbDotPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
        /* Group label */
        .sb-group-label {
          font-size: 9px; font-weight: 800;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          padding: 14px 10px 5px;
          display: flex; align-items: center; gap: 8px;
        }
        .sb-group-label::after {
          content: ""; flex: 1; height: 1px;
          background: #ECE9F1;
        }
        /* Scroll area */
        .sb-nav-scroll {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 2px 8px;
          scrollbar-width: none;
          animation: sbSlideIn 0.24s cubic-bezier(0.4,0,0.2,1) both;
        }
        .sb-nav-scroll::-webkit-scrollbar { display: none; }
        @keyframes sbSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        /* Footer signout button */
        .sb-signout-btn {
          width: 100%; padding: 8px 12px; border-radius: 9px;
          border: 1px solid #ECE9F1;
          background: #F5F3FF;
          color: #524D60;
          font-size: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.18s;
          font-family: var(--font);
          display: flex; align-items: center; justify-content: center; gap: 7px;
        }
        .sb-signout-btn:hover {
          background: rgba(239,68,68,0.1);
          color: #FCA5A5;
          border-color: rgba(239,68,68,0.2);
        }
      `}</style>

      <aside className="sb-wrap">

        {/* ── Logo ── */}
        <div style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid #ECE9F1",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <img
                src="/brand/logo-light-no-tagline.svg"
                alt="Feature"
                style={{ height: 28, width: "auto", display: "block" }}
              />
              <div style={{ fontSize: 8.5, fontWeight: 600, color: "#6B6577", letterSpacing: "2.5px", textTransform: "uppercase", marginTop: 5 }}>{vc.productName}</div>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              background: "#F5F3FF", border: "1px solid #ECE9F1",
              cursor: "pointer", width: 28, height: 28, borderRadius: 8,
              fontSize: 12, color: "#524D60",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EDE9FF"; e.currentTarget.style.color = "#6D28D9"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F5F3FF"; e.currentTarget.style.color = "#524D60"; }}
            >✕</button>
          )}
        </div>

        {/* ── Branch Switcher (only if owner has 2+ salons) ── */}
        {hasMultiBranch && (
          <div style={{ padding: "0 12px 10px", position: "relative" }}>
            <button
              onClick={() => setBranchOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                background: "#F5F3FF",
                border: "1px solid #ECE9F1",
                borderRadius: 11, padding: "8px 11px",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EDE9FF"; e.currentTarget.style.borderColor = "#7C3AED"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F5F3FF"; e.currentTarget.style.borderColor = "#ECE9F1"; }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900, color: "#fff",
              }}>
                {(activeSalon?.name || "S").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#12101A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeSalon?.name || "Select Branch"}
                </div>
                <div style={{ fontSize: 9.5, color: "#6B6577", marginTop: 1 }}>Branch</div>
              </div>
              <div style={{ fontSize: 10, color: "#6B6577", transition: "transform 0.2s", transform: branchOpen ? "rotate(180deg)" : "none", flexShrink: 0 }}>▼</div>
            </button>

            {/* Dropdown */}
            {branchOpen && (
              <div style={{
                position: "absolute", top: "calc(100% - 2px)", left: 12, right: 12,
                background: "#FFFFFF",
                border: "1px solid #ECE9F1",
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 16px 40px rgba(18,16,26,0.12)",
                zIndex: 200, backdropFilter: "blur(16px)",
              }}>
                {salons.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setBranchOpen(false); if (s.id !== activeSalon?.id) switchSalon(s.id); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 9,
                      padding: "9px 12px",
                      background: s.id === activeSalon?.id ? "#EDE9FF" : "transparent",
                      border: "none", cursor: "pointer",
                      borderBottom: "1px solid #F5F3FF",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => { if (s.id !== activeSalon?.id) e.currentTarget.style.background = "#F5F3FF"; }}
                    onMouseLeave={e => { if (s.id !== activeSalon?.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: s.id === activeSalon?.id ? "linear-gradient(135deg,#7C3AED,#6D28D9)" : "#ECE9F1",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 900, color: s.id === activeSalon?.id ? "#fff" : "#524D60",
                    }}>{s.name.slice(0, 1).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: s.id === activeSalon?.id ? 700 : 500, color: s.id === activeSalon?.id ? "#6D28D9" : "#524D60", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    </div>
                    {s.id === activeSalon?.id && <div style={{ fontSize: 10, color: "#7C3AED" }}>✓</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Nav ── */}
        <nav className="sb-nav-scroll">
          {NAV.map(group => {
            const s = SECTION_COLORS[group.group] || SECTION_COLORS.System;
            return (
              <div key={group.group}>
                <div className="sb-group-label" style={{ color: s.labelColor }}>
                  {group.group}
                </div>
                {group.items
                  .filter(item => {
                    // Partners is admin-only
                    // If auth hasn't loaded yet → always hide (no flash)
                    if (item.path === "/dashboard/partners" || item.label === "Partners") {
                      return adminLoaded && userEmail === SUPER_ADMIN_EMAIL;
                    }
                    return true;
                  })
                  .map(item => {
                  const active = isActive(item.path);
                  const Icon = (item.label === "Staff"
                    ? (StaffIconByKey[vc.staffIcon] ?? NAV_ICON_MAP[item.label])
                    : NAV_ICON_MAP[item.label]) as IconComp | undefined;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={onClose}
                      className={`sb-link${active ? " active" : ""}`}
                      style={{
                        borderLeftColor: active ? s.border : "transparent",
                        borderLeft: `2px solid ${active ? s.border : "transparent"}`,
                      }}
                    >
                      {/* Icon box */}
                      <div
                        className="sb-icon-box"
                        style={{
                          background: active ? s.grad : s.dimBg,
                          boxShadow: active ? `0 0 12px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` : "none",
                          border: `1px solid ${active ? "rgba(124,58,237,0.25)" : "#ECE9F1"}`,
                          color: active ? "#fff" : "#6B6577",
                        }}
                      >
                        {Icon && (
                          <Icon
                            size={15}
                            strokeWidth={active ? 2 : 1.6}
                          />
                        )}
                      </div>

                      {/* Label */}
                      <span style={{ flex: 1, fontSize: 13, letterSpacing: "-0.1px" }}>{displayLabel(item.label)}</span>

                      {/* Active indicator dot */}
                      {active && (
                        <div
                          className="sb-active-dot"
                          style={{
                            background: s.border,
                            boxShadow: `0 0 6px ${s.glow}`,
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div style={{
          padding: "12px 14px",
          borderTop: "1px solid #ECE9F1",
          background: "#FBFAFD",
          backdropFilter: "blur(20px)",
          flexShrink: 0,
        }}>
          {/* Salon info card */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
            padding: "9px 10px", borderRadius: 11,
            background: "#F5F3FF",
            border: "1px solid #ECE9F1",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#fff",
              boxShadow: "0 2px 10px rgba(124,58,237,0.25)",
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 700, color: "#12101A",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: "-0.2px",
              }}>{salonName || `Your ${vc.productName.replace(" OS","")}`}</div>
              <div style={{
                fontSize: 10, color: "#10B981", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4, marginTop: 1,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#10B981", display: "inline-block",
                  boxShadow: "0 0 6px rgba(16,185,129,0.7)",
                  animation: "logoPulse 2s ease-in-out infinite",
                }} />
                Active
              </div>
            </div>
          </div>

          <button onClick={onLogout} className="sb-signout-btn">
            <LogOutIcon size={13} strokeWidth={2} />
            Sign out
          </button>
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes logoPulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50%       { opacity: 1;   transform: scale(1.06); }
          }
        `}</style>
      </aside>
    </>
  );
}
