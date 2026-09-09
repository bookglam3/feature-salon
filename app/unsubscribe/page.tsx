"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeInner() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const salon = params.get("salon") || "";
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const missing = !email || !salon;

  const handleUnsubscribe = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, salon }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErrorMsg(json.error || "Something went wrong."); setState("error"); return; }
      setState("done");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F5F3FF", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Inter','Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "#FFFFFF",
        border: "1px solid #ECE9F1", borderRadius: 20,
        padding: "36px 32px", textAlign: "center",
        boxShadow: "0 8px 32px rgba(91,33,182,0.12)",
      }}>
        <div style={{ fontSize: 34, marginBottom: 14 }}>✉️</div>

        {missing ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#12101A", margin: "0 0 8px" }}>Invalid unsubscribe link</h1>
            <p style={{ fontSize: 13.5, color: "#524D60", lineHeight: 1.6, margin: 0 }}>
              This link is missing information. Please use the unsubscribe link from the email you received.
            </p>
          </>
        ) : state === "done" ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#12101A", margin: "0 0 8px" }}>You&apos;re unsubscribed</h1>
            <p style={{ fontSize: 13.5, color: "#524D60", lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: "#12101A" }}>{email}</strong> will no longer receive marketing emails from this salon. You may still receive essential booking confirmations.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#12101A", margin: "0 0 8px" }}>Unsubscribe from marketing emails?</h1>
            <p style={{ fontSize: 13.5, color: "#524D60", lineHeight: 1.6, margin: "0 0 24px" }}>
              <strong style={{ color: "#12101A" }}>{email}</strong> will stop receiving win-back and promotional emails from this salon.
            </p>
            {state === "error" && (
              <div style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#B91C1C", marginBottom: 16 }}>
                ⚠️ {errorMsg}
              </div>
            )}
            <button
              onClick={handleUnsubscribe}
              disabled={state === "loading"}
              style={{
                width: "100%", padding: "12px 20px",
                background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: state === "loading" ? "default" : "pointer",
                opacity: state === "loading" ? 0.6 : 1,
              }}
            >
              {state === "loading" ? "Unsubscribing…" : "Confirm Unsubscribe"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
