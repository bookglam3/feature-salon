"use client";
import { useState, useEffect } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "idle" | "loading" | "subscribed" | "denied" | "unsupported";

export default function PushNotificationButton({ salonId }: { salonId: string }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported"); return;
    }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => { if (sub) setStatus("subscribed"); })
      );
    }
  }, []);

  const handleEnable = async () => {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as BufferSource,
      });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON(), salon_id: salonId }),
      });
      if (!res.ok) throw new Error("Subscribe failed");
      setStatus("subscribed");
    } catch {
      setStatus("idle");
    }
  };

  if (status === "unsupported") return null;

  const cfg = {
    idle:       { label: "Enable Notifications", icon: <Bell size={13} strokeWidth={2} />,     color: "#7C3AED", bg: "rgba(124,58,237,0.10)",   cursor: "pointer" as const },
    loading:    { label: "Enabling…",            icon: <Bell size={13} strokeWidth={2} />,     color: "#7C3AED", bg: "rgba(124,58,237,0.10)",   cursor: "default" as const },
    subscribed: { label: "Notifications On",     icon: <Check size={13} strokeWidth={2.5} />, color: "#10B981", bg: "rgba(16,185,129,0.10)",  cursor: "default" as const },
    denied:     { label: "Notifications Blocked",icon: <BellOff size={13} strokeWidth={2} />, color: "#64748B", bg: "rgba(100,116,139,0.10)", cursor: "default" as const },
    unsupported:{ label: "",                     icon: null,                                   color: "#64748B", bg: "transparent",             cursor: "default" as const },
  }[status];

  return (
    <button
      onClick={status === "idle" ? handleEnable : undefined}
      disabled={status !== "idle"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "9px 18px",
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}44`,
        borderRadius: 11, fontSize: 12.5, fontWeight: 700,
        cursor: cfg.cursor, transition: "all 0.15s",
        backdropFilter: "blur(8px)", whiteSpace: "nowrap",
        opacity: status === "loading" ? 0.7 : 1,
        fontFamily: "inherit",
      }}
    >
      {cfg.icon}
      {cfg.label}
    </button>
  );
}
