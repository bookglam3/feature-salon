"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpenCheck,
  Users,
  Scissors,
  Sparkles,
  Leaf,
  Dumbbell,
  Stethoscope,
  Settings2,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

const STAFF_ICON_MAP: Record<string, LucideIcon> = {
  scissors:    Scissors,
  sparkles:    Sparkles,
  leaf:        Leaf,
  dumbbell:    Dumbbell,
  stethoscope: Stethoscope,
  users:       Users,
};
import { useSalon } from "../context/SalonContext";

const NAV_BASE = [
  { key: "home",     path: "/dashboard",          Icon: LayoutDashboard, activeColor: "#C9A24B", activeGlow: "rgba(201,162,75,0.4)",  activeBg: "linear-gradient(135deg,#C9A24B,#A07A30)" },
  { key: "bookings", path: "/dashboard/bookings", Icon: BookOpenCheck,   activeColor: "#60A5FA", activeGlow: "rgba(96,165,250,0.5)",   activeBg: "linear-gradient(135deg,#2563EB,#1E40AF)" },
  { key: "clients",  path: "/dashboard/clients",  Icon: Users,           activeColor: "#34D399", activeGlow: "rgba(52,211,153,0.5)",   activeBg: "linear-gradient(135deg,#059669,#10B981)" },
  { key: "staff",    path: "/dashboard/staff",    Icon: Scissors,        activeColor: "#C9A24B", activeGlow: "rgba(201,162,75,0.4)",  activeBg: "linear-gradient(135deg,#C9A24B,#A07A30)" },
  { key: "settings", path: "/dashboard/settings", Icon: Settings2,       activecolor: "#aab1c4", activeGlow: "rgba(148,163,184,0.4)", activeBg: "linear-gradient(135deg,#475569,#64748B)" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { vc } = useSalon();

  const labelFor = (key: string) => {
    if (key === "home")     return "Home";
    if (key === "bookings") return vc.bookingPlural;
    if (key === "clients")  return vc.clientPlural;
    if (key === "staff")    return vc.staffPlural;
    return "Settings";
  };
  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path);

  return (
    <>
      <style>{`
        @media (min-width: 768px) { .mobile-nav-bar { display: none !important; } }

        /* Wave 1 perf pass — was blur(28px) saturate(180%) unconditionally.
           This bar is mounted for the entire mobile session, permanently
           on screen, above whatever's scrolling underneath it — the
           highest-value single change in this pass. Base ships with no
           backdrop-filter (background bumped 0.96->0.98); html.gpu-capable
           (set in DashboardShell.tsx) restores a trimmed blur. */
        .mobile-nav-bar {
          background: rgba(14,19,32,0.98);
          border-top: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.45), 0 -1px 0 rgba(255,255,255,0.04);
        }
        html.gpu-capable .mobile-nav-bar {
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .mnav-item {
          position: relative; flex: 1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 3px; text-decoration: none;
          padding: 8px 4px 10px;
          transition: all 0.2s cubic-bezier(0.34,1.2,0.64,1);
          min-width: 0;
          -webkit-tap-highlight-color: transparent; outline: none;
          background: none; border: none; cursor: pointer;
        }
        .mnav-item:active { transform: scale(0.88); }

        /* Icon pill wrapper */
        .mnav-icon-wrap {
          width: 38px; height: 32px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.22s cubic-bezier(0.34,1.4,0.64,1);
          position: relative;
        }
        .mnav-item.active .mnav-icon-wrap {
          transform: translateY(-3px) scale(1.08);
        }

        /* Active top accent bar */
        .mnav-accent-bar {
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          width: 18px; height: 2px; border-radius: 0 0 2px 2px;
          opacity: 0;
          transition: opacity 0.2s ease, width 0.2s ease;
        }
        .mnav-item.active .mnav-accent-bar {
          opacity: 1; width: 24px;
        }

        /* Label */
        .mnav-label {
          font-size: 9.5px; letter-spacing: 0.1px;
          white-space: nowrap; font-weight: 500;
          transition: all 0.18s;
          color: rgba(255,255,255,0.3);
        }
        .mnav-item.active .mnav-label {
          font-weight: 800;
        }
      `}</style>

      <nav
        className="mobile-nav-bar"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: 66, display: "flex", alignItems: "stretch",
          zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {NAV_BASE.map(item => {
          const active = isActive(item.path);
          const { activeColor, activeGlow, activeBg } = item;
          const Icon = item.key === "staff" ? (STAFF_ICON_MAP[vc.staffIcon] ?? Scissors) : item.Icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`mnav-item${active ? " active" : ""}`}
              style={{ color: active ? activeColor : "rgba(255,255,255,0.3)" }}
            >
              {/* Accent bar at top */}
              <div
                className="mnav-accent-bar"
                style={{ background: activeColor, boxShadow: `0 0 8px ${activeGlow}` }}
              />

              {/* Icon */}
              <div
                className="mnav-icon-wrap"
                style={{
                  background: active ? activeBg : "transparent",
                  boxShadow: active ? `0 4px 16px ${activeGlow}` : "none",
                  border: active ? "1px solid rgba(255,255,255,0.12)" : "none",
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2 : 1.6}
                  color={active ? "#fff" : "rgba(255,255,255,0.3)"}
                />
              </div>

              {/* Label */}
              <span className="mnav-label" style={{ color: active ? activeColor : "rgba(255,255,255,0.3)" }}>
                {labelFor(item.key)}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
