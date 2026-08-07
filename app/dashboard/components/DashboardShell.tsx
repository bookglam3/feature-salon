"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { ToastProvider } from "./Toast";
import { Search, Bell, ChevronDown, Menu } from "lucide-react";
import { useSalon } from "../context/SalonContext";

interface DashboardShellProps {
  children: React.ReactNode;
  salonName?: string;
  topbar?: React.ReactNode;
}

export default function DashboardShell({ children, salonName, topbar }: DashboardShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState<string | null>(null);
  const [resolvedSalonName, setResolvedSalonName] = useState(salonName || "");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [annDismissed, setAnnDismissed] = useState(false);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const handler = () => setSidebarOpen(true);
    document.addEventListener("open-sidebar", handler);
    return () => document.removeEventListener("open-sidebar", handler);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: salon } = await supabase.from("salons")
        .select("subscription_status,subscription_plan,name,announcement")
        .eq("owner_id", user.id)
        .single();
      if (salon) {
        setSubStatus(salon.subscription_status);
        setSubPlan(salon.subscription_plan);
        if (!salonName && salon.name) setResolvedSalonName(salon.name);
        // Show announcement if set and not yet dismissed this session
        const ann = (salon as any).announcement as string | null;
        if (ann && ann.trim()) {
          const dismissKey = `ann_dismissed_${btoa(ann).slice(0, 16)}`;
          const wasDismissed = typeof window !== "undefined" && localStorage.getItem(dismissKey) === "1";
          setAnnouncement(ann.trim());
          setAnnDismissed(wasDismissed);
        }
      }
    })();
  }, [salonName]);

  return (
    <ToastProvider>
      <style>{`
        :root { --sidebar-w: 256px; }

        /* ══ Layout ══ */
        .ds-layout {
          display: flex; min-height: 100vh;
          background: #141A2E;
          position: relative;
        }

        /* Subtle noise texture overlay */
        .ds-layout::after {
          content: "";
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: 0.4;
        }

        /* ══ Sidebar wrapper ══ */
        .ds-sidebar-wrap {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 100vw; max-width: 100vw; z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          will-change: transform;
        }
        .ds-sidebar-wrap.open { transform: translateX(0); }

        /* ══ Overlay ══ */
        .ds-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 49;
        }
        .ds-overlay.open { display: block; animation: fadeOverlay 0.22s ease; }
        @keyframes fadeOverlay { from { opacity: 0; } to { opacity: 1; } }

        /* ══ Main content area ══ */
        .ds-main {
          flex: 1; display: flex; flex-direction: column;
          min-width: 0; overflow: hidden;
          position: relative; z-index: 1;
        }
        .ds-content {
          flex: 1; overflow-y: auto; background: #141A2E;
          padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px));
          -webkit-overflow-scrolling: touch;
        }

        /* ══ Desktop ══ */
        @media (min-width: 768px) {
          .ds-sidebar-wrap {
            width: var(--sidebar-w);
            position: sticky; top: 0; height: 100vh;
            transform: none !important; flex-shrink: 0;
          }
          .ds-overlay { display: none !important; }
          .ds-content { padding-bottom: 0; }
        }

        /* ══ Premium Topbar ══ */
        .ds-topbar {
          background: rgba(14,19,32,0.97);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 20px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 30;
          gap: 12px;
          /* Subtle shimmer line at very bottom */
          box-shadow: 0 1px 0 rgba(201,162,75,0.08), 0 4px 20px rgba(0,0,0,0.25);
        }

        /* Search bar */
        .ds-topbar-search {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 7px 12px;
          flex: 1; max-width: 260px;
          transition: all 0.18s ease;
        }
        .ds-topbar-search:focus-within {
          border-color: rgba(201,162,75,0.5);
          background: rgba(201,162,75,0.06);
          box-shadow: 0 0 0 3px rgba(201,162,75,0.12);
        }
        .ds-topbar-search input {
          background: none; border: none; outline: none;
          font-size: 13px; color: #2a3350;
          font-family: var(--font); width: 100%;
        }
        .ds-topbar-search input::placeholder { color: rgba(255,255,255,0.2); }
        @media (max-width: 480px) { .ds-topbar-search { display: none; } }

        /* Notification button */
        .ds-notif-btn {
          width: 36px; height: 36px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.04);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; transition: all 0.18s;
          flex-shrink: 0; color: rgba(255,255,255,0.45);
        }
        .ds-notif-btn:hover {
          border-color: rgba(201,162,75,0.35);
          background: rgba(201,162,75,0.1);
          color: rgba(255,255,255,0.75);
        }
        .ds-notif-dot {
          position: absolute; top: 7px; right: 7px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #EF4444; border: 1.5px solid #141A2E;
          box-shadow: 0 0 6px rgba(239,68,68,0.7);
          animation: notifPulse 2s ease-in-out infinite;
        }
        @keyframes notifPulse {
          0%, 100% { box-shadow: 0 0 4px rgba(239,68,68,0.6); }
          50%       { box-shadow: 0 0 10px rgba(239,68,68,0.9); }
        }

        /* Avatar chip */
        .ds-avatar-chip {
          display: flex; align-items: center; gap: 7px;
          padding: 4px 10px 4px 5px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 11px;
          background: rgba(255,255,255,0.04);
          cursor: pointer; transition: all 0.18s; flex-shrink: 0;
        }
        .ds-avatar-chip:hover {
          border-color: rgba(201,162,75,0.3);
          background: rgba(201,162,75,0.07);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }

        /* Plan badge */
        .ds-plan-badge {
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.8px;
          text-transform: uppercase; padding: 3px 9px;
          border-radius: 99px; white-space: nowrap;
          background: rgba(201,162,75,0.12);
          color: #C9A24B;
          border: 1px solid rgba(201,162,75,0.25);
        }
        /* Responsive audit fix — same breakpoint (767px) and same technique
           (hide secondary badge) already proven on the dashboard-home
           page's own custom topbar (.dash-topbar-badge). The page title
           truncating (below) is what actually prevents overflow; this just
           frees up room so the title has more space before it needs to. */
        @media (max-width: 767px) { .ds-plan-badge { display: none !important; } }

        /* Hamburger */
        .hbtn { display: flex; }
        @media(min-width:768px){ .hbtn { display: none !important; } }

        /* Subscription warning banners */
        .ds-sub-warning {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
          padding: 10px 20px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .ds-sub-warning-link {
          font-size: 12px; font-weight: 700; color: #fff;
          padding: 6px 16px; border-radius: 8px;
          text-decoration: none; white-space: nowrap;
          transition: all 0.15s;
        }
        .ds-sub-warning-link:hover { transform: translateY(-1px); }
      `}</style>

      <div className="ds-layout">
        {/* Overlay */}
        <div className={`ds-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        <div className={`ds-sidebar-wrap ${sidebarOpen ? "open" : ""}`}>
          <Sidebar
            salonName={resolvedSalonName || salonName}
            onClose={() => setSidebarOpen(false)}
            onLogout={handleLogout}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </div>

        {/* Main area */}
        <div className="ds-main">
          {topbar ? topbar : (
            <PremiumTopBar
              onMenuClick={() => setSidebarOpen(true)}
              salonName={resolvedSalonName || salonName || ""}
              plan={subPlan}
            />
          )}

          {/* Subscription warning */}
          {(subStatus === "past_due" || subStatus === "cancelled") && (
            <div
              className="ds-sub-warning"
              style={{
                background: subStatus === "cancelled"
                  ? "linear-gradient(90deg, rgba(127,29,29,0.85), rgba(185,28,28,0.85))"
                  : "linear-gradient(90deg, rgba(120,53,15,0.85), rgba(161,98,7,0.85))",
                borderBottom: `1px solid ${subStatus === "cancelled" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: subStatus === "cancelled" ? "#FCA5A5" : "#FCD34D",
              }}>
                {subStatus === "cancelled"
                  ? "❌ Your subscription is cancelled — renew to keep accepting bookings."
                  : "⚠️ Payment failed — update billing to avoid interruption."}
              </span>
              <a
                href="/subscribe"
                className="ds-sub-warning-link"
                style={{
                  background: subStatus === "cancelled"
                    ? "linear-gradient(135deg,#DC2626,#991B1B)"
                    : "linear-gradient(135deg,#D97706,#F59E0B)",
                  boxShadow: subStatus === "cancelled"
                    ? "0 4px 12px rgba(239,68,68,0.35)"
                    : "0 4px 12px rgba(245,158,11,0.35)",
                }}
              >Renew Now →</a>
            </div>
          )}

          <div className="ds-content fade-in">
            {/* ── Announcement Banner ── */}
            {announcement && !annDismissed && (
              <div style={{
                margin: "16px 20px 0",
                background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(217,119,6,0.1))",
                border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 14,
                padding: "13px 16px",
                display: "flex", alignItems: "flex-start", gap: 12,
                backdropFilter: "blur(8px)",
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📢</span>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#FCD34D", lineHeight: 1.5 }}>
                  {announcement}
                </div>
                <button
                  onClick={() => {
                    const dismissKey = `ann_dismissed_${btoa(announcement).slice(0, 16)}`;
                    localStorage.setItem(dismissKey, "1");
                    setAnnDismissed(true);
                  }}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 18, cursor: "pointer", flexShrink: 0, lineHeight: 1, padding: 0 }}
                  title="Dismiss"
                >×</button>
              </div>
            )}
            {children}
          </div>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </ToastProvider>
  );
}

/* ══ Premium Dark Topbar ══ */
function PremiumTopBar({ onMenuClick, salonName, plan }: {
  onMenuClick: () => void;
  salonName: string;
  plan: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchVal, setSearchVal] = useState("");
  const { vc } = useSalon();

  const pageTitle = (() => {
    const seg = pathname?.split("/").filter(Boolean).at(-1) || "dashboard";
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
  })();

  const initials = salonName
    ? salonName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "S";

  const planLabel = plan || "Starter";

  return (
    <header className="ds-topbar">
      {/* Left: hamburger + page title. minWidth:0 replaces flexShrink:0 on
          both this row and the title itself — the title must be able to
          shrink and ellipsis rather than force the row wider than the
          viewport. Every level between the flex row and the truncating
          text needs its own minWidth:0, or a flex item's default
          min-width:auto blocks the shrink before it ever reaches the text. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <HamburgerBtn onClick={onMenuClick} />
        <div style={{
          fontSize: 14.5, fontWeight: 800, color: "#F7F5EF",
          letterSpacing: "-0.4px", lineHeight: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
        }}>
          {pageTitle}
        </div>
      </div>

      {/* Center: Search */}
      <div className="ds-topbar-search">
        <Search size={13} strokeWidth={2} color="rgba(255,255,255,0.22)" />
        <input
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          placeholder="Search anything…"
        />
        {searchVal && (
          <button
            onClick={() => setSearchVal("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, padding: 0, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Right: plan + notif + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div className="ds-plan-badge">{planLabel}</div>

        {/* Notification bell — links to Bookings; no unread badge (that's a separate phase) */}
        <button className="ds-notif-btn" title="View bookings" onClick={() => router.push("/dashboard/bookings")}>
          <Bell size={15} strokeWidth={1.8} />
        </button>

        {/* Avatar chip */}
        <div className="ds-avatar-chip" onClick={onMenuClick}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: "linear-gradient(135deg,#1C2438,#0E1320)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "#C9A24B", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(201,162,75,0.25)",
          }}>{initials}</div>
          <span style={{
            fontSize: 12.5, fontWeight: 700, color: "#F7F5EF",
            maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {salonName || vc.productName.replace(" OS","")}
          </span>
          <ChevronDown size={11} strokeWidth={2} color="rgba(255,255,255,0.3)" />
        </div>
      </div>
    </header>
  );
}

/* ══ Hamburger Button ══ */
export function HamburgerBtn({ onClick }: { onClick?: () => void }) {
  const handleClick = () => {
    if (onClick) { onClick(); return; }
    document.dispatchEvent(new CustomEvent("open-sidebar"));
  };
  return (
    <button
      className="hbtn"
      onClick={handleClick}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.07)",
        cursor: "pointer", padding: "7px 8px", borderRadius: 9,
        display: "flex", flexDirection: "column", gap: 4,
        transition: "all 0.18s", alignItems: "center",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,162,75,0.12)"; e.currentTarget.style.borderColor = "rgba(201,162,75,0.25)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      <span style={{ display: "block", width: 16, height: 1.5, background: "rgba(255,255,255,0.55)", borderRadius: 2 }} />
      <span style={{ display: "block", width: 11, height: 1.5, background: "rgba(255,255,255,0.55)", borderRadius: 2 }} />
      <span style={{ display: "block", width: 16, height: 1.5, background: "rgba(255,255,255,0.55)", borderRadius: 2 }} />
    </button>
  );
}
