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
  Menu,
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

/* The bar exposes four routes plus "More", which opens the sidebar sheet.
   Settings moved into the sheet: the bar has five slots, and the ~19
   routes that aren't on it had no mobile entry point at all once the
   menu button was inert. path: null marks the action item — it renders
   as a <button>, not a <Link>. */
const NAV_BASE: {
  key: string; path: string | null; Icon: LucideIcon;
  activeColor: string; activeGlow: string; activeBg: string;
}[] = [
  { key: "home",     path: "/dashboard",          Icon: LayoutDashboard, activeColor: "#7C3AED", activeGlow: "rgba(124,58,237,0.4)", activeBg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
  { key: "bookings", path: "/dashboard/bookings", Icon: BookOpenCheck,   activeColor: "#7C3AED", activeGlow: "rgba(124,58,237,0.4)", activeBg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
  { key: "clients",  path: "/dashboard/clients",  Icon: Users,           activeColor: "#7C3AED", activeGlow: "rgba(124,58,237,0.4)", activeBg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
  { key: "staff",    path: "/dashboard/staff",    Icon: Scissors,        activeColor: "#7C3AED", activeGlow: "rgba(124,58,237,0.4)", activeBg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
  { key: "more",     path: null,                  Icon: Menu,            activeColor: "#7C3AED", activeGlow: "rgba(124,58,237,0.4)", activeBg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
];

/* The four routes the bar links to directly. Anything else means the user
   got there through the sheet, so "More" shows as the active section. */
const BAR_PATHS = ["/dashboard", "/dashboard/bookings", "/dashboard/clients", "/dashboard/staff"];

export default function MobileNav() {
  const pathname = usePathname();
  const { vc } = useSalon();

  const labelFor = (key: string) => {
    if (key === "home")     return "Home";
    if (key === "bookings") return vc.bookingPlural;
    if (key === "clients")  return vc.clientPlural;
    if (key === "staff")    return vc.staffPlural;
    return "More";
  };
  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path);

  // On a route the bar doesn't link to, "More" is the active section —
  // otherwise nothing in the bar is highlighted and the user has no
  // indication of where they are.
  const onBarRoute = BAR_PATHS.some(isActive);

  // Same event the topbar menu button dispatches; DashboardShell listens.
  const openSidebar = () => document.dispatchEvent(new CustomEvent("open-sidebar"));

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
          background: #FFFFFF;
          border-top: 1px solid #ECE9F1;
          box-shadow: 0 -2px 12px rgba(18,16,26,0.06);
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
          color: #6B6577;
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
          const active = item.path ? isActive(item.path) : !onBarRoute;
          const { activeColor, activeGlow, activeBg } = item;
          const Icon = item.key === "staff" ? (STAFF_ICON_MAP[vc.staffIcon] ?? Scissors) : item.Icon;

          /* Identical markup for the link and the action item, so "More"
             matches the other four exactly — same accent bar, icon pill,
             label and active treatment. */
          const inner = (
            <>
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
                  color={active ? "#fff" : "#6B6577"}
                />
              </div>

              {/* Label */}
              <span className="mnav-label" style={{ color: active ? activeColor : "#6B6577" }}>
                {labelFor(item.key)}
              </span>
            </>
          );

          const className = `mnav-item${active ? " active" : ""}`;
          const style = { color: active ? activeColor : "#6B6577" };

          // .mnav-item already resets background/border and sets
          // cursor:pointer, so the button needs no extra styling.
          return item.path ? (
            <Link key={item.key} href={item.path} className={className} style={style}>
              {inner}
            </Link>
          ) : (
            <button
              key={item.key}
              type="button"
              onClick={openSidebar}
              aria-label="Open menu"
              className={className}
              style={style}
            >
              {inner}
            </button>
          );
        })}
      </nav>
    </>
  );
}
