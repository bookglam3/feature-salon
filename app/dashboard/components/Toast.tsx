"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 3800);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  const colors = {
    success: { bg: "rgba(16,185,129,0.10)", border: "#6EE7B7", text: "#065F46", icon: "✓" },
    error:   { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)", text: "#991B1B", icon: "✕" },
    info:    { bg: "rgba(124,58,237,0.10)", border: "rgba(124,58,237,0.25)", text: "#5B21B6", icon: "i" },
  };
  const c = colors[toast.type];

  return (
    <div
      ref={ref}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 12, padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
        animation: "toastIn 0.28s cubic-bezier(0.4,0,0.2,1) both",
        minWidth: 260, maxWidth: 360,
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: "50%", background: c.border,
        color: c.text, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, flexShrink: 0,
      }}>{c.icon}</span>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: c.text, flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ background: "none", border: "none", cursor: "pointer", color: c.text, opacity: 0.5, fontSize: 16, lineHeight: 1, padding: 0 }}
      >×</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p.slice(-3), { id, message, type }]);
  }, []);

  const ctx: ToastContextType = {
    success: (msg) => add(msg, "success"),
    error: (msg) => add(msg, "error"),
    info: (msg) => add(msg, "info"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div style={{
        position: "fixed", bottom: 80, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
