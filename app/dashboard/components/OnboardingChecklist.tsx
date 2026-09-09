"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ChecklistProps {
  services: number;
  staff: number;
  bookingLink: string;
  salonSlug: string;
  businessType?: string;
}

function getOnboardingTerms(bt?: string) {
  switch (bt) {
    case "gym":     return { icon:"🏋️", example:"e.g. PT Session – £40, Group Class – £15" };
    case "yoga":    return { icon:"🧘", example:"e.g. Yoga Class – £12, Private Session – £35" };
    case "physio":  return { icon:"🤸", example:"e.g. Initial Assessment – £60, Follow-up – £40" };
    case "dental":  return { icon:"🦷", example:"e.g. Consultation – £50, Cleaning – £80" };
    case "spa":     return { icon:"🌿", example:"e.g. Swedish Massage – £60, Facial – £45" };
    case "massage": return { icon:"💆", example:"e.g. Deep Tissue – £55, Hot Stone – £70" };
    case "nail":    return { icon:"💅", example:"e.g. Gel Nails – £35, Nail Art – £45" };
    case "beauty":  return { icon:"✨", example:"e.g. Lash Extensions – £60, Facial – £45" };
    case "barber":  return { icon:"💈", example:"e.g. Haircut – £15, Beard Trim – £10" };
    case "pt":      return { icon:"🏃", example:"e.g. PT Session – £50, 10-pack – £450" };
    default:        return { icon:"✂️", example:"e.g. Haircut – £25, Colour – £60" };
  }
}

const C = {
  indigo: "#C9A24B", indigoDark: "#0E1320", indigoSoft: "rgba(201,162,75,0.10)",
  green: "#10B981", greenSoft: "rgba(16,185,129,0.10)", greenBorder: "rgba(16,185,129,0.25)",
  text: "#F7F5EF", text2: "#aab1c4", text3: "#64748B",
  border: "#2a3350", surface: "#FFFFFF",
};

export default function OnboardingChecklist({ services, staff, bookingLink, salonSlug, businessType }: ChecklistProps) {
  const router = useRouter();
  const terms = getOnboardingTerms(businessType);
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Persist dismiss in localStorage
  useEffect(() => {
    const v = localStorage.getItem("ob_dismissed");
    if (v === "1") setDismissed(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("ob_dismissed", "1");
    setDismissed(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const steps = [
    {
      id: "services",
      done: services > 0,
      icon: terms.icon,
      title: "Add your first service",
      desc: terms.example,
      cta: "Add Services",
      action: () => router.push("/dashboard/settings"),
    },
    {
      id: "staff",
      done: staff > 0,
      icon: "👤",
      title: "Add a staff member",
      desc: "Assign bookings to your team",
      cta: "Add Staff",
      action: () => router.push("/dashboard/staff"),
    },
    {
      id: "link",
      done: false,
      icon: "🔗",
      title: "Share your booking link",
      desc: `featuresalon.co.uk/book/${salonSlug}`,
      cta: copied ? "✓ Copied!" : "Copy Link",
      action: copyLink,
    },
    {
      id: "preview",
      done: false,
      icon: "👁",
      title: "Preview your booking page",
      desc: "See what your clients see",
      cta: "Open Preview",
      action: () => window.open(`/book/${salonSlug}`, "_blank"),
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  if (dismissed || allDone) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 400,
      width: open ? 320 : "auto",
      transition: "width 0.3s",
    }}>
      {/* Collapsed state */}
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          display: "flex", alignItems: "center", gap: 10,
          background: `linear-gradient(135deg,${C.indigo},${C.indigoDark})`,
          color: "#fff", border: "none", borderRadius: 14, padding: "12px 18px",
          cursor: "pointer", boxShadow: "0 8px 24px rgba(201,162,75,0.4)",
          fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
        }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          Setup {doneCount}/{steps.length}
          <div style={{
            width: 32, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.2)", overflow: "hidden",
          }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#1C2438", borderRadius: 99, transition: "width 0.4s" }} />
          </div>
        </button>
      )}

      {/* Expanded state */}
      {open && (
        <div style={{
          background: C.surface, borderRadius: 20, overflow: "hidden",
          boxShadow: "0 16px 48px rgba(15,23,42,0.16), 0 4px 16px rgba(15,23,42,0.08)",
          border: "1px solid #E0E7FF",
          animation: "slideUp 0.25s ease",
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg,${C.indigo},${C.indigoDark})`,
            padding: "16px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px" }}>
                🚀 Get started
              </div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {doneCount} of {steps.length} steps complete
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setOpen(false)} title="Minimise" style={{
                background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>−</button>
              <button onClick={dismiss} title="Dismiss forever" style={{
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
                width: 28, height: 28, cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "#E0E7FF" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: C.green, transition: "width 0.5s ease" }} />
          </div>

          {/* Steps */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((s, i) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 12,
                border: `1.5px solid ${s.done ? C.greenBorder : C.border}`,
                background: s.done ? C.greenSoft : "#F8FAFF",
                transition: "all 0.2s",
              }}>
                {/* Step icon / check */}
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: s.done ? C.green : C.indigoSoft,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: s.done ? 14 : 16,
                  color: s.done ? "#fff" : C.indigo,
                  fontWeight: 800,
                  boxShadow: s.done ? `0 4px 10px ${C.green}40` : "none",
                }}>
                  {s.done ? "✓" : s.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 700,
                    color: s.done ? "#10B981" : C.text,
                    textDecoration: s.done ? "line-through" : "none",
                    textDecorationColor: "rgba(16,185,129,0.25)",
                  }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.text3, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.desc}</div>
                </div>

                {!s.done && (
                  <button onClick={s.action} style={{
                    flexShrink: 0, padding: "5px 10px", borderRadius: 8, border: "none",
                    background: C.indigo, color: "#fff", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                  }}>
                    {s.cta}
                  </button>
                )}
                {s.done && (
                  <div style={{ fontSize: 11, color: "#10B981", fontWeight: 800, flexShrink: 0 }}>Done</div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ fontSize: 11.5, color: C.text3, textAlign: "center" }}>
              Need help?{" "}
              <a href={`https://wa.me/17633461492?text=Hi, I need help setting up my salon on Feature.`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: "#25D366", fontWeight: 700, textDecoration: "none" }}>
                WhatsApp us →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
