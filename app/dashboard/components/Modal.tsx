"use client";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // Optional. When provided, rendered as a non-scrolling footer pinned to
  // the bottom of the modal (e.g. Cancel/Save) — the body between header
  // and footer becomes the sole scroll region, so the footer never scrolls
  // out of reach on mobile. Omit to keep the previous single-scroll layout
  // (header + children scroll together) unchanged for existing callers.
  footer?: React.ReactNode;
  maxWidth?: number;
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = 480 }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    // Bug 2 fix (part 3): belt-and-suspenders scroll-to-top on open. The
    // component fully unmounts on close (`if (!open) return null` below),
    // so a freshly-mounted scroll container already starts at scrollTop 0
    // by default — this doesn't fix a confirmed mechanism, it's explicit
    // insurance for the "not starting scrolled to top" candidate cause,
    // at zero cost. Covers both branches: ref is the scroll container
    // itself when no footer is given, scrollBodyRef is the separate
    // scroll region when one is.
    if (ref.current) ref.current.scrollTop = 0;
    if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        /* Bug 2 fix (part 1): vh is computed against the browser's maximum
           (chrome-collapsed) viewport, not the actually-visible one — on
           mobile Safari/Chrome the address bar is still showing right when
           a user opens this modal, so 92vh can be taller than what's really
           on screen, pushing content below the visible fold even though the
           layout math is otherwise correct. dvh recalculates against the
           real visible viewport. Declared as a second, later rule for the
           same property (not merged into one value) so unsupported browsers
           simply ignore this line and keep the vh value already set —
           standard progressive-enhancement fallback, not a replacement.
           Must live here (a class rule), not the inline style prop below —
           an inline style has higher specificity than any class selector
           and would silently block this fallback from ever taking effect. */
        .modal-inner { max-height: 92vh; max-height: 92dvh; }
        @media (min-width: 600px) {
          .modal-inner { border-radius: 20px !important; max-height: 90vh !important; max-height: 90dvh !important; margin: 16px !important; animation: slideUp 0.24s cubic-bezier(0.4,0,0.2,1) both !important; }
          .modal-wrap { align-items: center !important; }
        }
        @media (max-width: 599px) {
          .modal-inner { animation: slideUpMobile 0.28s cubic-bezier(0.4,0,0.2,1) both !important; border-radius: 20px 20px 0 0 !important; }
        }
        .modal-inner input:-webkit-autofill,
        .modal-inner input:-webkit-autofill:hover,
        .modal-inner input:-webkit-autofill:focus {
          -webkit-text-fill-color: #2a3350 !important;
          -webkit-box-shadow: 0 0 0px 1000px #1A1830 inset !important;
        }
        .modal-inner input::placeholder,
        .modal-inner textarea::placeholder { color: rgba(255,255,255,0.45) !important; }
      `}</style>
      <div
        ref={ref}
        className="modal-inner"
        style={{
          background: "#14122A",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth,
          // maxHeight set via the .modal-inner CSS rule above (vh + dvh
          // fallback pair) — kept out of inline style, which would win over
          // the class rule by specificity and block the dvh line entirely.
          boxShadow: "0 -8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,162,75,0.1)",
          ...(footer
            ? { display: "flex", flexDirection: "column" as const, overflow: "hidden" }
            : { overflowY: "auto" as const, padding: "24px 20px 32px" }),
        }}
        onClick={e => e.stopPropagation()}
      >
        {footer ? (
          <>
            <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
              {header(title, onClose)}
            </div>
            <div ref={scrollBodyRef} className="modal-scroll-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 20px" }}>
              {children}
            </div>
            <div style={{ flexShrink: 0, padding: "0 20px 32px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {footer}
            </div>
          </>
        ) : (
          <>
            {header(title, onClose)}
            {children}
          </>
        )}
      </div>
    </div>
  );
}

function header(title: string, onClose: () => void) {
  return (
    <>
      {/* Drag handle (mobile) */}
      <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 12px" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#F7F5EF", letterSpacing: "-0.4px" }}>{title}</h2>
        <button
          onClick={onClose}
          style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,0.08)", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 14,
            color: "rgba(255,255,255,0.4)", transition: "all 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
        >✕</button>
      </div>
    </>
  );
}

/* ── Shared form primitives — dark theme ── */
export function FormGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "-0.1px" }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%", padding: "10px 13px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, fontSize: 14,
        color: "#F7F5EF", background: "rgba(255,255,255,0.06)",
        outline: "none", transition: "border-color 0.12s, box-shadow 0.12s",
        ...props.style,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "#E7C878"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,162,75,0.2)"; }}
      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%", padding: "10px 13px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, fontSize: 14,
        color: "#F7F5EF", background: "#1A1838",
        outline: "none", transition: "border-color 0.12s, box-shadow 0.12s",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        paddingRight: 36,
        ...props.style,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "#E7C878"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,162,75,0.2)"; }}
      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
      {children}
    </div>
  );
}

export function BtnPrimary({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        flex: 1, padding: "11px 20px",
        background: "linear-gradient(135deg,#C9A24B,#0E1320)",
        color: "#fff",
        border: "none", borderRadius: 10,
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        boxShadow: "0 4px 16px rgba(201,162,75,0.4)",
        transition: "all 0.14s",
        letterSpacing: "-0.15px", opacity: props.disabled ? 0.45 : 1,
        ...props.style,
      }}
      onMouseEnter={e => { if (!props.disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(201,162,75,0.5)"; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(201,162,75,0.4)"; }}
    >{children}</button>
  );
}

export function BtnSecondary({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        flex: 1, padding: "11px 20px",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
        fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.12s",
        ...props.style,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#2a3350"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
    >{children}</button>
  );
}
