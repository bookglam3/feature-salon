import type { CSSProperties } from "react";
import { bookingPaymentLabel, type PaymentLabelInput, type PaymentLabelTone } from "@/app/lib/payments/paymentLabel";

/* Same colours as the Payments page pills (paid green, failed red, amber);
   deposit blue; pay at salon / free neutral. */
const TONES: Record<PaymentLabelTone, { bg: string; color: string; border: string }> = {
  paid:     { bg: "rgba(16,185,129,0.10)", color: "#047857", border: "rgba(16,185,129,0.25)" },
  deposit:  { bg: "rgba(59,130,246,0.10)", color: "#1D4ED8", border: "rgba(59,130,246,0.25)" },
  salon:    { bg: "#F5F3FF",               color: "#524D60", border: "#ECE9F1" },
  free:     { bg: "#F5F3FF",               color: "#524D60", border: "#ECE9F1" },
  failed:   { bg: "rgba(239,68,68,0.10)",  color: "#B91C1C", border: "rgba(239,68,68,0.25)" },
  awaiting: { bg: "rgba(245,158,11,0.12)", color: "#B45309", border: "rgba(245,158,11,0.25)" },
};

/** A booking's payment label (app/lib/payments/paymentLabel.ts); nothing when there's nothing to say. */
export default function PaymentBadge({ compact, style, ...input }: PaymentLabelInput & { compact?: boolean; style?: CSSProperties }) {
  const label = bookingPaymentLabel(input);
  if (!label) return null;
  const t = TONES[label.tone];
  return (
    <span title={label.text} style={{
      display: "inline-block", maxWidth: "100%", verticalAlign: "middle",
      fontSize: compact ? 9.5 : 11, fontWeight: 700, lineHeight: 1.35,
      padding: compact ? "1px 6px" : "2px 8px", borderRadius: 99,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      ...style,
    }}>{label.text}</span>
  );
}
