"use client";
import { useState, useSyncExternalStore } from "react";

// /unsubscribe/emails?t=<token> — owners opting out of Feature's lifecycle
// emails (check-ins, tips). Opening the page changes nothing; the button does,
// so email link scanners can't unsubscribe anyone. The /unsubscribe page next
// door is a different thing: clients opting out of a salon's marketing.
const noSubscribe = () => () => {};
const readToken = () => new URLSearchParams(window.location.search).get("t");
const serverToken = () => undefined; // unknown until the browser renders

export default function UnsubscribeEmailsPage() {
  // undefined = not read yet (server render), null = missing from the link
  const token = useSyncExternalStore<string | null | undefined>(noSubscribe, readToken, serverToken);
  const [state, setState] = useState<"ready" | "sending" | "done" | "error">("ready");
  const [error, setError] = useState("");

  const unsubscribe = async () => {
    if (!token || state === "sending") return;
    setState("sending"); setError("");
    try {
      const res = await fetch("/api/lifecycle/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Something went wrong. Please try again."); setState("error"); return; }
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  };

  const heading = { fontSize: 18, fontWeight: 700, color: "#12101A", margin: "0 0 8px" } as const;
  const text = { fontSize: 13.5, color: "#524D60", lineHeight: 1.6, margin: 0 } as const;

  return (
    <main style={{ minHeight: "100vh", background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 20, padding: "32px 28px", boxSizing: "border-box" }}>
        {state === "done" ? (
          <>
            <h1 style={heading}>You&apos;re unsubscribed</h1>
            <p style={text}>
              We won&apos;t send you any more check-ins or tips. You&apos;ll still get the emails your account needs,
              like booking notifications and password resets.
            </p>
          </>
        ) : token === undefined ? null : !token ? (
          <>
            <h1 style={heading}>Invalid unsubscribe link</h1>
            <p style={text}>This link is missing its code. Please use the link from the bottom of one of our emails.</p>
          </>
        ) : (
          <>
            <h1 style={heading}>Unsubscribe from Feature emails?</h1>
            <p style={{ ...text, margin: "0 0 24px" }}>
              You&apos;ll stop getting our check-ins and tips about your Feature account. Booking notifications
              and password emails aren&apos;t affected.
            </p>
            {state === "error" && (
              <div role="alert" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#B91C1C", marginBottom: 16 }}>
                {error}
              </div>
            )}
            <button
              onClick={unsubscribe}
              disabled={state === "sending"}
              style={{ width: "100%", height: 46, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 700, cursor: state === "sending" ? "not-allowed" : "pointer", opacity: state === "sending" ? 0.7 : 1 }}
            >
              {state === "sending" ? "Unsubscribing…" : "Unsubscribe"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
