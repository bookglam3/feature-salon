"use client";
import { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

interface EmptyStateProps {
  icon?: string;
  lucideIcon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, lucideIcon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      padding: "64px 24px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
      position: "relative",
    }}>
      {/* Ambient glow behind icon */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%,-70%)",
        width: 180, height: 180,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Icon box */}
      <div style={{
        width: 68, height: 68, borderRadius: 20,
        background: "#EDE9FF",
        border: "1px solid #ECE9F1",
        boxShadow: "0 0 24px rgba(124,58,237,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20, position: "relative",
        color: "#7C3AED",
      }}>
        {lucideIcon ? lucideIcon : (
          icon ? (
            <span style={{ fontSize: 28 }}>{icon}</span>
          ) : (
            <CalendarDays size={28} strokeWidth={1.5} />
          )
        )}
        {/* Corner glow dot */}
        <div style={{
          position: "absolute", top: -3, right: -3,
          width: 10, height: 10, borderRadius: "50%",
          background: "rgba(124,58,237,0.6)",
          boxShadow: "0 0 8px rgba(124,58,237,0.6)",
        }} />
      </div>

      <div style={{
        fontSize: 15.5, fontWeight: 800, color: "#12101A",
        marginBottom: 8, letterSpacing: "-0.4px",
      }}>{title}</div>

      <div style={{
        fontSize: 13, color: "#6B6577",
        maxWidth: 260, lineHeight: 1.65, fontWeight: 400,
      }}>{description}</div>

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 24,
            padding: "10px 24px",
            background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
            color: "#fff",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 12,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 18px rgba(124,58,237,0.4)",
            transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
            letterSpacing: "-0.1px",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 28px rgba(124,58,237,0.55)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "0 4px 18px rgba(124,58,237,0.4)";
          }}
        >{action.label}</button>
      )}
    </div>
  );
}
