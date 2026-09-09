"use client";
import { useState } from "react";
import Link from "next/link";

const C = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#ECE9F1",
  text: "#12101A",
  text2: "#524D60",
  muted: "#6B6577",
  gold: "#7C3AED",
  dim: "#6B6577",
  green: "#065F46",
};

function calcFresha(newClients: number, avgPrice: number, teamMembers: number) {
  const subscription = teamMembers <= 1 ? 14.95 : 9.95 * teamMembers;
  const commissionPerClient = Math.max(avgPrice * 0.2, 6);
  return subscription + newClients * commissionPerClient;
}

function calcBooksy(newClients: number, avgPrice: number, teamMembers: number) {
  const subscription = 40 + 5 * (teamMembers - 1);
  const commissionPerClient = Math.max(avgPrice * 0.3, 5);
  return subscription + newClients * commissionPerClient;
}

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, hint, value, min, max, step, prefix, suffix, onChange }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>{label}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{hint}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {prefix && <span style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>{prefix}</span>}
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => {
              const raw = Number(e.target.value);
              if (!isNaN(raw)) onChange(Math.max(min, Math.min(max, raw)));
            }}
            style={{
              width: 60,
              padding: "5px 8px",
              background: "#F5F3FF",
              border: `1.5px solid ${C.border}`,
              borderRadius: 8,
              color: C.gold,
              fontSize: 16,
              fontWeight: 900,
              textAlign: "right",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {suffix && <span style={{ fontSize: 13, color: C.muted }}>{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="calc-slider"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.dim, marginTop: 5 }}>
        <span>{prefix}{min}{suffix}</span>
        <span>{prefix}{max}{suffix}</span>
      </div>
    </div>
  );
}

export default function Calculator() {
  const [newClients, setNewClients] = useState(15);
  const [avgPrice, setAvgPrice] = useState(40);
  const [teamMembers, setTeamMembers] = useState(2);

  const freshaTotal = Math.round(calcFresha(newClients, avgPrice, teamMembers));
  const booksyTotal = Math.round(calcBooksy(newClients, avgPrice, teamMembers));
  const featureTotal = 29;

  const freshaSubscription = Math.round(teamMembers <= 1 ? 14.95 : 9.95 * teamMembers);
  const freshaCommission = Math.round(newClients * Math.max(avgPrice * 0.2, 6));
  const booksySubscription = 40 + 5 * (teamMembers - 1);
  const booksyCommission = Math.round(newClients * Math.max(avgPrice * 0.3, 5));

  const savingVsFresha = freshaTotal - featureTotal;
  const savingVsBooksy = booksyTotal - featureTotal;

  return (
    <div>
      <style>{`
        .calc-slider {
          -webkit-appearance: none;
          appearance: none;
          display: block;
          width: 100%;
          height: 5px;
          border-radius: 99px;
          background: linear-gradient(to right, #7C3AED var(--pct, 15%), #ECE9F1 var(--pct, 15%));
          outline: none;
          cursor: pointer;
          margin: 4px 0;
        }
        .calc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #7C3AED;
          cursor: pointer;
          box-shadow: 0 0 0 3px #FFFFFF, 0 2px 8px rgba(124,58,237,0.5);
          border: none;
        }
        .calc-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7C3AED;
          cursor: pointer;
          border: 3px solid #FFFFFF;
          box-shadow: 0 2px 8px rgba(124,58,237,0.4);
        }
        .calc-slider:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px #FFFFFF, 0 0 0 5px rgba(124,58,237,0.4);
        }
        @media (max-width: 640px) {
          .result-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Inputs */}
      <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 20, padding: "28px 28px 8px" }}>
        <SliderRow
          label="New marketplace clients per month"
          hint="Clients who first find and book you via Fresha/Booksy marketplace"
          value={newClients}
          min={0}
          max={100}
          step={1}
          suffix=" clients"
          onChange={setNewClients}
        />
        <SliderRow
          label="Average service price"
          hint="Your typical booking value"
          value={avgPrice}
          min={5}
          max={300}
          step={5}
          prefix="£"
          onChange={setAvgPrice}
        />
        <SliderRow
          label="Team members"
          hint="Total staff in your business"
          value={teamMembers}
          min={1}
          max={20}
          step={1}
          suffix=" staff"
          onChange={setTeamMembers}
        />
      </div>

      {/* Result cards */}
      <div
        className="result-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}
      >
        {/* Fresha */}
        <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "22px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>Fresha</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: C.text, lineHeight: 1, marginBottom: 2, letterSpacing: "-1.5px" }}>
            ~£{freshaTotal}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>/month estimated</div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.muted }}>Subscription</span>
              <span style={{ color: C.text2, fontWeight: 600 }}>~£{freshaSubscription}/mo</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.muted }}>Commission</span>
              <span style={{ color: "#B91C1C", fontWeight: 700 }}>~£{freshaCommission}/mo</span>
            </div>
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>
              20% on {newClients} new clients (min £6 each)
            </div>
          </div>
        </div>

        {/* Booksy */}
        <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "22px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>Booksy</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: C.text, lineHeight: 1, marginBottom: 2, letterSpacing: "-1.5px" }}>
            ~£{booksyTotal}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>/month estimated</div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.muted }}>Subscription</span>
              <span style={{ color: C.text2, fontWeight: 600 }}>~£{booksySubscription}/mo</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.muted }}>Commission</span>
              <span style={{ color: "#B91C1C", fontWeight: 700 }}>~£{booksyCommission}/mo</span>
            </div>
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>
              30% on {newClients} new clients via Boost (min £5 each)
            </div>
          </div>
        </div>

        {/* Feature */}
        <div style={{ background: "rgba(124,58,237,0.07)", border: `2px solid rgba(124,58,237,0.4)`, borderRadius: 16, padding: "22px 20px", position: "relative" }}>
          <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#FFFFFF", fontSize: 10, fontWeight: 900, padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap", letterSpacing: "1px" }}>
            FLAT RATE
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>Feature</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: C.gold, lineHeight: 1, marginBottom: 2, letterSpacing: "-1.5px" }}>
            £{featureTotal}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>always, no commission</div>
          <div style={{ borderTop: `1px solid rgba(124,58,237,0.2)`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {savingVsFresha > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(16,185,129,0.12)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ color: C.green, fontSize: 16, fontWeight: 900, lineHeight: 1 }}>↓</span>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 700, lineHeight: 1.3 }}>
                  Est. saving vs Fresha:<br />
                  <strong style={{ fontSize: 15 }}>£{savingVsFresha}/month</strong>
                </span>
              </div>
            )}
            {savingVsBooksy > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(16,185,129,0.12)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ color: C.green, fontSize: 16, fontWeight: 900, lineHeight: 1 }}>↓</span>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 700, lineHeight: 1.3 }}>
                  Est. saving vs Booksy:<br />
                  <strong style={{ fontSize: 15 }}>£{savingVsBooksy}/month</strong>
                </span>
              </div>
            )}
            {savingVsFresha <= 0 && savingVsBooksy <= 0 && (
              <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
                With few marketplace bookings, subscription costs are comparable — Feature is for owners who value predictability over marketplace reach.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 12.5, color: C.dim, textAlign: "center", fontStyle: "italic", lineHeight: 1.65, marginTop: 20, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
        This is an estimate based on the numbers you enter and reported 2026 pricing. Commissions apply only to new clients from each platform&apos;s marketplace, not to existing clients. Always check each provider&apos;s current pricing.
      </p>

      {/* CTA */}
      <div style={{ textAlign: "center", marginTop: 36 }}>
        <Link href="/signup" className="btn-primary btn-lg btn-glow">
          Start your 14-day free trial — no card, no commission →
        </Link>
      </div>
    </div>
  );
}
