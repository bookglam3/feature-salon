"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const phone = "17633461492"; // +1 (763) 346-1492
  const message = encodeURIComponent("Hi! I'd like to learn more about Feature Salon for my business.");

  // Detect mobile to raise widget above bottom nav
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isDashboard = pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin");
  const bottomPos = isMobile && isDashboard ? 80 : 24;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Chat on WhatsApp"
        style={{
          position: "fixed", bottom: bottomPos, right: 24, zIndex: 999,
          width: 56, height: 56, borderRadius: "50%",
          background: "#25D366", border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(37,211,102,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 32 32" fill="#fff">
            <path d="M16 2C8.268 2 2 8.268 2 16c0 2.48.654 4.806 1.8 6.82L2 30l7.39-1.776A13.93 13.93 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.6a11.56 11.56 0 01-5.89-1.604l-.42-.25-4.386 1.054 1.096-4.272-.274-.44A11.56 11.56 0 014.4 16C4.4 9.594 9.594 4.4 16 4.4S27.6 9.594 27.6 16 22.406 27.6 16 27.6zm6.33-8.674c-.346-.173-2.048-1.01-2.366-1.126-.318-.114-.55-.172-.78.173-.23.346-.89 1.126-1.09 1.358-.2.23-.4.26-.747.086-.347-.173-1.462-.538-2.785-1.717-1.03-.918-1.724-2.052-1.926-2.398-.2-.346-.022-.533.152-.706.156-.155.347-.403.52-.604.173-.202.23-.346.346-.577.115-.23.058-.432-.029-.604-.087-.173-.78-1.878-1.07-2.57-.28-.674-.565-.583-.78-.594l-.663-.012c-.23 0-.604.086-.92.432-.317.346-1.21 1.183-1.21 2.886 0 1.702 1.238 3.346 1.41 3.577.172.23 2.435 3.715 5.9 5.208.824.356 1.467.569 1.968.729.827.264 1.58.227 2.174.137.663-.1 2.048-.836 2.337-1.645.29-.808.29-1.5.203-1.645-.086-.145-.317-.23-.663-.403z"/>
          </svg>
        )}
      </button>

      {/* Popup card */}
      {open && (
        <div style={{
          position: "fixed", bottom: bottomPos + 66, right: 24, zIndex: 998,
          background: "#fff", borderRadius: 16, width: 300,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          overflow: "hidden", animation: "slideUp 0.2s ease",
        }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg,#25D366,#128C5E)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: "#fff",
                border: "2px solid rgba(255,255,255,0.5)",
              }}>AN</div>
              <span style={{
                position: "absolute", bottom: 1, right: 1,
                width: 10, height: 10, borderRadius: "50%",
                background: "#fff", border: "2px solid #25D366",
              }}/>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px" }}>Anitooi</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>Feature Salon · Customer Success</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#B7F5C8", display: "inline-block" }}/>
                Online · Replies in minutes
              </div>
            </div>
          </div>
          {/* Body */}
          <div style={{ padding: "16px 18px 18px" }}>
            <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13.5, color: "#0F172A", lineHeight: 1.6 }}>
              👋 Hi! Ready to see how Feature Salon can automate your bookings and grow your revenue?
            </div>
            <a
              href={`https://wa.me/${phone}?text=${message}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", textAlign: "center",
                background: "#25D366", color: "#fff",
                padding: "12px", borderRadius: 10,
                fontWeight: 700, fontSize: 14, textDecoration: "none",
                boxShadow: "0 4px 14px rgba(37,211,102,0.3)",
              }}
            >
              Start WhatsApp Chat →
            </a>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <Link href="/signup" style={{ fontSize: 12.5, color: "#4F46E5", fontWeight: 600, textDecoration: "none" }}>
                Or start free trial instead →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
