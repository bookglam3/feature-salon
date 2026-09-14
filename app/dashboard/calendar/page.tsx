"use client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  House,
  ListPlus,
  Mail,
  MessageCircle,
  Plus,
  Phone,
  UsersRound,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import { describeReward } from "@/app/lib/loyalty";
import FeatureGate from "../components/FeatureGate";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import Modal from "../components/Modal";
import { useSalon } from "../context/SalonContext";
import { resolveAppointmentServices } from "@/app/lib/appointmentServices";
import { formatTimeDisplay } from "@/app/lib/formatTime";

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  date_time: string;
  // Written on every booking create and returned by select("*") — it was
  // simply never declared here. Duration is derived from it below.
  end_time?: string | null;
  status: "confirmed" | "pending" | "cancelled";
  services?: { name: string; price: number; price_is_from?: boolean } | null;
  staff?: { name: string } | null;
  // Multi-service aware (3C-2b-display) — combined across appointment_
  // services line items, falling back to the primary services join above
  // for bookings with no line items. Populated once at fetch time (see
  // CalendarContent's load()) so every sub-component below just reads
  // these fields directly, no prop-threading of a separate lookup map
  // through MonthView/WeekView/DayView/ApptModal needed.
  serviceName?: string;
  combinedPrice?: number;
  anyPriceIsFrom?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  confirmed: { bg: "rgba(16,185,129,0.10)", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
  pending:   { bg: "rgba(245,158,11,0.10)", border: "#FCD34D", text: "#F59E0B", dot: "#F59E0B" },
  cancelled: { bg: "rgba(239,68,68,0.10)", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am – 7pm
const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type ViewMode = "week" | "month" | "day";

const CALENDAR_STYLES = `
  .cal-topbar {
    min-height: 64px;
    padding: 0 24px;
    background: #FFFFFF;
    border-bottom: 1px solid #ECE9F1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 30;
  }
  .cal-topbar-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .cal-topbar-title { font-size: 14px; font-weight: 700; color: #12101A; letter-spacing: -0.2px; }
  .cal-topbar-create {
    min-height: 40px;
    padding: 0 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #FFFFFF;
    background: linear-gradient(145deg,#8B3FF1 0%,#7135E8 100%);
    border-radius: 11px;
    box-shadow: 0 8px 22px rgba(124,58,237,0.25);
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .cal-topbar-create:hover { transform: translateY(-1px); box-shadow: 0 11px 26px rgba(124,58,237,0.32); }
  .cal-page { padding: 26px 24px 40px; max-width: 1360px; margin: 0 auto; }
  .cal-heading { margin-bottom: 20px; }
  .cal-eyebrow { font-size: 10.5px; font-weight: 600; color: #6B6577; letter-spacing: 0.2px; }
  .cal-title { margin: 6px 0 0; color: #12101A; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2; }
  .cal-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .cal-toolbar-main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .cal-nav-buttons { display: flex; gap: 6px; }
  .cal-nav-button {
    height: 34px;
    min-width: 34px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #FFFFFF;
    color: #524D60;
    border: 1px solid #ECE9F1;
    border-radius: 9px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
  }
  .cal-nav-button:hover { color: #7C3AED; border-color: #CFC4EB; box-shadow: 0 4px 14px rgba(31,24,51,0.06); }
  .cal-nav-today { padding: 0 14px; }
  .cal-range { color: #12101A; font-size: 14px; font-weight: 700; letter-spacing: -0.2px; }
  .cal-view-toggle { display: flex; padding: 3px; gap: 2px; background: #F5F3FF; border: 1px solid #ECE9F1; border-radius: 10px; }
  .cal-view-button { padding: 5px 13px; color: #524D60; background: transparent; border: 0; border-radius: 8px; font-size: 11.5px; font-weight: 500; text-transform: capitalize; cursor: pointer; transition: all 0.14s ease; }
  .cal-view-button.active { color: #6D28D9; background: #EDE9FF; font-weight: 700; }
  .cal-status-counts { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-bottom: 18px; }
  .cal-status-count { display: flex; align-items: center; gap: 7px; }
  .cal-status-count > i { width: 7px; height: 7px; border-radius: 50%; }
  .cal-status-value { color: #12101A; font-size: 12px; font-weight: 700; }
  .cal-status-label { color: #524D60; font-size: 12px; }
  .cal-desktop { display: block; }
  .cal-mobile { display: none; }
  .cal-reference-nav { display: none; }

  .cal-agenda-row {
    min-height: 76px;
    padding: 12px 0;
    display: grid;
    grid-template-columns: 52px 3px minmax(0,1fr) auto;
    align-items: center;
    column-gap: 13px;
    cursor: pointer;
    transition: background 0.14s ease;
  }
  .cal-agenda-row + .cal-agenda-row { border-top: 1px solid #ECE9F1; }
  .cal-agenda-row:hover { background: #FAF9FC; }
  .cal-agenda-time { color: #24212D; font-size: 12.5px; font-weight: 700; letter-spacing: -0.15px; }
  .cal-agenda-accent { width: 3px; min-height: 38px; border-radius: 999px; }
  .cal-agenda-copy { min-width: 0; }
  .cal-agenda-name { color: #24212D; font-size: 13.5px; font-weight: 700; letter-spacing: -0.16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cal-agenda-service { margin-top: 4px; color: #6B6577; font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cal-agenda-price { padding-left: 5px; color: #24212D; font-size: 12.5px; font-weight: 700; white-space: nowrap; }

  .cal-drawer-client { display: flex; align-items: center; gap: 14px; padding: 8px 0 22px; border-bottom: 1px solid #eeecf2; }
  .cal-drawer-client-copy { min-width: 0; }
  .cal-drawer-client-name { color: #12101A; font-family: var(--font-playfair,Georgia,serif); font-size: 21px; font-weight: 600; line-height: 1.2; letter-spacing: -0.45px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cal-drawer-client-sub { margin-top: 6px; color: #524D60; font-size: 11.5px; text-transform: capitalize; }
  .cal-drawer-status { width: fit-content; margin-top: 7px; padding: 3px 9px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid; border-radius: 999px; font-size: 10.5px; font-weight: 700; text-transform: capitalize; }
  .cal-drawer-status > span { width: 5px; height: 5px; border-radius: 50%; }
  .cal-drawer-summary { margin: 20px 0 26px; padding: 18px; display: flex; align-items: flex-start; gap: 13px; background: #F5F3FF; border: 1px solid #ECE9F1; border-radius: 14px; }
  .cal-drawer-summary-icon { width: 36px; height: 36px; flex: 0 0 36px; display: flex; align-items: center; justify-content: center; color: #7C3AED; background: #EDE7FF; border-radius: 10px; }
  .cal-drawer-summary-copy { min-width: 0; }
  .cal-drawer-summary-title { color: #12101A; font-size: 13.5px; font-weight: 700; }
  .cal-drawer-summary-date { margin-top: 4px; color: #524D60; font-size: 11.5px; line-height: 1.45; }
  .cal-drawer-service { margin-top: 10px; color: #12101A; font-size: 12.5px; font-weight: 700; }
  .cal-drawer-meta { margin-top: 3px; color: #524D60; font-size: 11.5px; }
  .cal-drawer-section-label { margin-bottom: 10px; color: #6B6577; font-size: 10px; font-weight: 800; letter-spacing: 0.9px; text-transform: uppercase; }
  .cal-drawer-details-label { margin-top: 26px; margin-bottom: 4px; }
  .cal-drawer-phone { margin: -2px 0 11px; color: #12101A; font-size: 15px; font-weight: 700; letter-spacing: -0.3px; }
  .cal-drawer-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-bottom: 4px; }
  .cal-drawer-action { min-width: 0; min-height: 46px; padding: 12px 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: #6D28D9; background: #F5F3FF; border: 1px solid #ECE9F1; border-radius: 12px; text-decoration: none; font-size: 12.5px; font-weight: 700; transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease; }
  .cal-drawer-action:hover { transform: translateY(-1px); border-color: #CFC0EF; box-shadow: 0 7px 18px rgba(76,45,121,0.08); }
  .cal-drawer-action > span { min-width: 0; }
  .cal-drawer-action-whatsapp { color: #047857; background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.22); }
  .cal-drawer-action-email { grid-column: 1 / -1; justify-content: flex-start; color: #524D60; background: #FFFFFF; border-color: #ECE9F1; font-weight: 600; font-size: 12px; }
  .cal-drawer-action-email > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cal-drawer-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid #eeecf2; }
  .cal-drawer-row-label { color: #524D60; font-size: 12px; }
  .cal-drawer-row-value { color: #12101A; font-size: 13px; font-weight: 700; text-align: right; }
  .cal-drawer-total { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 0 4px; }
  .cal-drawer-total-label { color: #12101A; font-size: 13px; font-weight: 700; }
  .cal-drawer-total-value { color: #12101A; font-size: 19px; font-weight: 800; letter-spacing: -0.5px; }
  .cal-drawer-footer { display: flex; gap: 8px; padding-top: 16px; }
  .cal-drawer-close, .cal-drawer-primary { min-height: 44px; flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 11px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .cal-drawer-close { color: #524D60; background: #FFFFFF; border: 1px solid #E5E1EB; }
  .cal-drawer-primary { color: #FFFFFF; background: linear-gradient(145deg,#8B3FF1,#7135E8); border: 0; box-shadow: 0 7px 18px rgba(124,58,237,0.22); }
  .modal-inner:has(.cal-drawer-client) { box-shadow: -18px 0 60px rgba(46,32,67,0.14) !important; }
  .modal-inner:has(.cal-drawer-client) h2 { font-family: var(--font-playfair,Georgia,serif); font-size: 21px !important; font-weight: 600 !important; letter-spacing: -0.45px !important; }

  @media (max-width: 767px) {
    .cal-topbar { min-height: 64px; padding: 0 18px; background: #FBFAFE; }
    .cal-topbar-left { gap: 0; }
    .cal-topbar-title { display: none; }
    .cal-topbar-left .hbtn { width: 28px !important; height: 32px !important; padding: 6px 2px !important; gap: 4px !important; background: transparent !important; border: 0 !important; border-radius: 0 !important; }
    .cal-topbar-left .hbtn span { height: 1.5px !important; background: #5C5766 !important; }
    .cal-topbar-left .hbtn span:nth-child(1), .cal-topbar-left .hbtn span:nth-child(3) { width: 21px !important; }
    .cal-topbar-left .hbtn span:nth-child(2) { width: 15px !important; align-self: flex-start; }
    .cal-topbar-create { width: 42px; height: 42px; min-height: 42px; padding: 0; border-radius: 11px; }
    .cal-topbar-create-label { display: none; }
    .cal-page { min-height: calc(100vh - 64px); padding: 28px 18px 48px; }
    .cal-heading { margin-bottom: 28px; }
    .cal-eyebrow { font-size: 11.5px; font-weight: 500; letter-spacing: 0; }
    .cal-title { margin-top: 8px; font-family: var(--font-playfair,Georgia,serif); font-size: 28px; font-weight: 400; letter-spacing: -0.75px; }
    .cal-toolbar { display: block; margin-bottom: 22px; }
    .cal-toolbar-main { display: block; }
    .cal-nav-buttons { gap: 7px; }
    .cal-nav-button { width: 38px; height: 38px; min-width: 38px; padding: 0; border-radius: 9px; box-shadow: 0 2px 8px rgba(33,24,51,0.025); }
    .cal-nav-today { width: auto; padding: 0 15px; }
    .cal-range { margin-top: 19px; font-size: 16px; font-weight: 750; letter-spacing: -0.35px; }
    .cal-status-counts { display: none; }
    /* View toggle now shows on mobile too, so Week/Month are reachable. */
    .cal-view-toggle { margin-top: 16px; width: 100%; justify-content: stretch; }
    .cal-view-button { flex: 1; min-height: 36px; font-size: 12px; }
    /* The existing Week/Month grids, made usable on a phone. Week keeps its
       own horizontal scroll (minWidth 720); Month gets compact cells. */
    .cal-mobile-grid { margin-top: 14px; }
    .cal-mobile-grid > div { padding: 0 !important; }
    .cal-mobile-grid [style*="min-height: 90px"], .cal-mobile-grid [style*="minHeight: 90"] { min-height: 62px !important; }
    .cal-desktop { display: none; }
    .cal-mobile { display: block; }
    .cal-week-card { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); padding: 8px; background: #FFFFFF; border: 1px solid #E8E4ED; border-radius: 15px; box-shadow: 0 7px 20px rgba(37,25,57,0.035); }
    .cal-day-button { min-width: 0; height: 56px; padding: 7px 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6B6577; background: transparent; border: 0; border-radius: 11px; cursor: pointer; transition: color 0.14s ease, background 0.14s ease, transform 0.14s ease; }
    .cal-day-button:hover { color: #6D28D9; background: #F8F5FF; }
    .cal-day-button.active { color: #FFFFFF; background: linear-gradient(145deg,#8C39F2,#7532EB); box-shadow: 0 7px 16px rgba(124,58,237,0.24); }
    .cal-day-name { font-size: 9px; font-weight: 600; line-height: 1; text-transform: uppercase; opacity: 0.8; }
    .cal-day-number { margin-top: 7px; font-size: 15px; font-weight: 750; line-height: 1; letter-spacing: -0.25px; }
    .cal-agenda-card { margin-top: 14px; padding: 8px 16px 17px; background: #FFFFFF; border: 1px solid #E8E4ED; border-radius: 16px; box-shadow: 0 8px 22px rgba(37,25,57,0.035); }
    .cal-agenda-list { margin-top: 0; }
    .cal-agenda-empty { padding: 36px 12px 31px; text-align: center; }
    .cal-agenda-empty-title { color: #24212D; font-size: 13px; font-weight: 700; }
    .cal-agenda-empty-copy { margin-top: 4px; color: #6B6577; font-size: 11.5px; }
    .cal-add-booking { width: 100%; min-height: 48px; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #7C3AED; background: #FBF8FF; border: 1.5px dashed #D9C2FA; border-radius: 11px; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: background 0.14s ease, border-color 0.14s ease; }
    .cal-add-booking:hover { background: #F5EEFF; border-color: #BDA0ED; }
    .mobile-nav-bar { display: none !important; }
    .cal-reference-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; min-height: 72px; padding: 6px 8px env(safe-area-inset-bottom,0px); display: flex; align-items: stretch; background: #FFFFFF; border-top: 1px solid #ECE9F1; box-shadow: 0 -2px 12px rgba(18,16,26,0.04); }
    .cal-reference-nav-item { flex: 1; min-width: 0; padding: 7px 2px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #9D97A5; text-decoration: none; font-size: 9.5px; font-weight: 500; }
    .cal-reference-nav-item.active { color: #8B45F5; }
    .cal-reference-nav-item svg { width: 21px; height: 21px; }
    .modal-inner:has(.cal-drawer-client) h2 { font-size: 20px !important; }
    .cal-drawer-actions { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }

  @media (max-width: 390px) {
    .cal-page { padding-left: 14px; padding-right: 14px; }
    .cal-week-card { padding: 6px; }
    .cal-day-button { height: 53px; }
    .cal-agenda-card { padding-left: 13px; padding-right: 13px; }
    .cal-agenda-row { grid-template-columns: 46px 3px minmax(0,1fr) auto; column-gap: 10px; }
    .cal-agenda-service { max-width: 135px; }
  }
`;

/* ─── Initials avatar (no photo field exists on an appointment) ── */
const AVATAR_COLORS = ["#7C3AED", "#6D28D9", "#8B5CF6", "#A78BFA", "#EC4899"];
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const bg = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = (name || "?").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 800, color: "#fff", flexShrink: 0, letterSpacing: "-0.3px" }}>
      {initials}
    </div>
  );
}

/* Duration in minutes from end_time, same arithmetic as the reschedule
   page. Returns null when end_time is absent (older rows) so the caller
   omits the line rather than assuming a length. */
function durationMins(a: Appointment): number | null {
  if (!a.end_time) return null;
  const mins = Math.round((new Date(a.end_time).getTime() - new Date(a.date_time).getTime()) / 60_000);
  return mins > 0 ? mins : null;
}

/* Digits only, with a UK 0-prefix promoted to 44 — same normalisation
   idea as the clients page, which strips non-digits before wa.me. */
function whatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  return digits;
}

/* ─── MONTH VIEW ─────────────────────────────────── */
interface MonthViewProps {
  currentDate: Date;
  monthDays: (Date | null)[];
  getApptsByDay: (day: Date) => Appointment[];
  today: Date;
  setSelectedAppt: (a: Appointment) => void;
}
function MonthView({ currentDate, monthDays, getApptsByDay, today, setSelectedAppt }: MonthViewProps) {
  const monthName = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return (
    <div style={{ padding: "24px 24px", maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 900, color: "#12101A", marginBottom: 20, letterSpacing: "-0.5px" }}>{monthName}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#524D60", padding: "8px 0", letterSpacing: "0.5px", textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {monthDays.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} style={{ minHeight: 90, background: "#F5F3FF", borderRadius: 10, border: "1.5px solid #ECE9F1" }} />;
          const dayAppts = getApptsByDay(day);
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()}
              style={{ minHeight: 90, background: isToday ? "rgba(124,58,237,0.10)" : "#FFFFFF", borderRadius: 10, border: `1.5px solid ${isToday ? "rgba(124,58,237,0.25)" : "#ECE9F1"}`, padding: "8px 8px", cursor: "default", transition: "all 0.12s" }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.borderColor = "rgba(124,58,237,0.25)"; }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.borderColor = "#ECE9F1"; }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 900 : 600, marginBottom: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: isToday ? "#7C3AED" : "transparent", color: isToday ? "#fff" : "#12101A" }}>{day.getDate()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayAppts.slice(0, 3).map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                  return (
                    <div key={a.id} onClick={() => setSelectedAppt(a)}
                      style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "opacity 0.12s" }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    >
                      {formatTimeDisplay(a.date_time)} {a.client_name}
                    </div>
                  );
                })}
                {dayAppts.length > 3 && <div style={{ fontSize: 9.5, color: "#524D60", fontWeight: 600, paddingLeft: 4 }}>+{dayAppts.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── WEEK VIEW ─────────────────────────────────── */
/* ── Loyalty "reward ready" signal ──────────────────────────────────
   The owner works from the calendar, not the loyalty page, so a client
   arriving to claim a reward previously showed nothing here.

   `null` means: programme off, unconfigured, or the lookup failed. In every
   one of those cases nothing renders at all, so salons not running the
   scheme see no change. Keyed on lower(btrim(email)) to match the
   loyalty_progress view's own key; entries with no email (walk-ins) simply
   never match rather than throwing. */
export interface LoyaltyReady {
  /** normalised client_email -> visits, for clients at or over the threshold */
  ready: Map<string, number>;
  required: number;
  rewardText: string;
}

function isRewardReady(a: Appointment, loyalty: LoyaltyReady | null): boolean {
  if (!loyalty) return false;
  const key = (a.client_email ?? "").trim().toLowerCase();
  return !!key && loyalty.ready.has(key);
}

interface WeekViewProps {
  weekDays: Date[];
  appointments: Appointment[];
  today: Date;
  setSelectedAppt: (a: Appointment) => void;
  loyalty: LoyaltyReady | null;
}
const CELL_H = 60;
function WeekView({ weekDays, appointments, today, setSelectedAppt, loyalty }: WeekViewProps) {
  /* Visible hour range. HOURS (7–19) stays the baseline, but it is widened
     to cover any booking that actually falls outside it — previously an
     08:00-or-21:00 appointment simply never rendered. Display range only;
     no query or date logic is involved. */
  const weekHours = appointments
    .filter(a => weekDays.some(d => sameDay(new Date(a.date_time), d)))
    .map(a => new Date(a.date_time).getHours());
  const from = Math.min(HOURS[0], ...weekHours);
  const to   = Math.max(HOURS[HOURS.length - 1], ...weekHours);
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "58px repeat(7,minmax(96px,1fr))", minWidth: 720, border: "1px solid #ECE9F1", borderRadius: 14, overflow: "hidden", background: "#FFFFFF" }}>
        <div style={{ borderRight: "1px solid #ECE9F1", borderBottom: "1px solid #ECE9F1", background: "#FBFAFD" }} />
        {weekDays.map((day, di) => {
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} style={{ textAlign: "center", padding: "11px 4px", borderRight: di < 6 ? "1px solid #ECE9F1" : "none", borderBottom: "1px solid #ECE9F1", background: isToday ? "#F5F3FF" : "#FBFAFD" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "#6B6577", textTransform: "uppercase", letterSpacing: "0.7px" }}>{DAYS[di]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? "#7C3AED" : "#12101A", marginTop: 3, letterSpacing: "-0.3px" }}>{day.getDate()}</div>
            </div>
          );
        })}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div style={{ padding: "6px 8px", fontSize: 10, color: "#6B6577", fontWeight: 600, borderRight: "1px solid #ECE9F1", borderBottom: "1px solid #ECE9F1", textAlign: "right", background: "#FBFAFD" }}>
              {String(hour).padStart(2, "0")}:00
            </div>
            {weekDays.map((day, di) => {
              const cellAppts = appointments.filter(a => {
                const d = new Date(a.date_time);
                return sameDay(d, day) && d.getHours() === hour;
              });
              return (
                <div key={`${day.toISOString()}-${hour}`}
                  style={{ height: CELL_H, borderRight: di < 6 ? "1px solid #ECE9F1" : "none", borderBottom: "1px solid #ECE9F1", position: "relative", background: sameDay(day, today) ? "#FCFBFE" : "#FFFFFF" }}>
                  {cellAppts.map((a, idx) => {
                    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                    const d = new Date(a.date_time);
                    /* Minute-accurate placement: a 09:30 now sits half-way
                       down the 09:00 row instead of at its top. Concurrent
                       bookings in the same hour split the width side by side
                       rather than overlapping. */
                    const topPct = (d.getMinutes() / 60) * 100;
                    const n = cellAppts.length;
                    return (
                      <div key={a.id} onClick={() => setSelectedAppt(a)} title={`${formatTimeDisplay(d)} · ${a.client_name}${isRewardReady(a, loyalty) ? " · Reward ready" : ""}`}
                        style={{ position: "absolute", top: `${topPct}%`, left: `calc(${(idx / n) * 100}% + 3px)`, width: `calc(${100 / n}% - 6px)`,
                          background: sc.bg, border: `1px solid ${sc.border}`, borderLeft: `3px solid ${sc.dot}`, borderRadius: 7,
                          padding: "3px 6px", cursor: "pointer", overflow: "hidden", transition: "box-shadow 0.12s, transform 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(18,16,26,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                      >
                        {isRewardReady(a, loyalty) && (
                          /* 6px dot only — the chip text is 9.5px and already truncates, so a
                             word will not fit. Meaning comes from tapping through to the drawer,
                             which works on mobile where hover does not. */
                          <span aria-label="Reward ready" style={{
                            position: "absolute", top: 3, right: 3,
                            width: 6, height: 6, borderRadius: "50%",
                            background: "#7C3AED", flexShrink: 0,
                          }} />
                        )}
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: sc.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {formatTimeDisplay(d)} {a.client_name}
                        </div>
                        {a.serviceName && n === 1 && (
                          <div style={{ fontSize: 9, color: sc.text, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.serviceName}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── DAY VIEW ──────────────────────────────────── */
interface DayViewProps {
  currentDate: Date;
  getApptsByDay: (day: Date) => Appointment[];
  setSelectedAppt: (a: Appointment) => void;
  loyalty: LoyaltyReady | null;
}
function DayView({ currentDate, getApptsByDay, setSelectedAppt, loyalty }: DayViewProps) {
  const dayAppts = getApptsByDay(currentDate);
  const label = currentDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div style={{ padding: "24px 24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#12101A", marginBottom: 20, letterSpacing: "-0.4px" }}>{label}</div>
      {HOURS.map(hour => {
        const hourAppts = dayAppts.filter(a => new Date(a.date_time).getHours() === hour);
        return (
          <div key={hour} style={{ display: "flex", gap: 14, marginBottom: 4, alignItems: "flex-start" }}>
            <div style={{ width: 50, fontSize: 11.5, color: "#524D60", fontWeight: 700, textAlign: "right", paddingTop: 10, flexShrink: 0 }}>{hour}:00</div>
            <div style={{ flex: 1, minHeight: 48, borderTop: "1px solid #ECE9F1", display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
              {hourAppts.map(a => {
                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                return (
                  <div key={a.id} onClick={() => setSelectedAppt(a)}
                    style={{ padding: "10px 16px", borderRadius: 12, background: sc.bg, border: `1.5px solid ${sc.border}`, cursor: "pointer", transition: "all 0.12s", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: sc.text }}>{a.client_name}</div>
                          {isRewardReady(a, loyalty) && (
                            /* Same treatment as the READY pill on /dashboard/loyalty, so the
                               two screens read as one system. */
                            <span style={{
                              fontSize: 9.5, fontWeight: 800, letterSpacing: "0.4px",
                              padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap",
                              background: "rgba(124,58,237,0.10)", color: "#6D28D9",
                              border: "1px solid rgba(124,58,237,0.25)",
                            }}>REWARD READY</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#524D60", marginTop: 2 }}>{a.serviceName || "No service"}{a.staff ? ` · ${a.staff.name}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {!!a.combinedPrice && <div style={{ fontSize: 14, fontWeight: 800, color: "#047857" }}>{a.anyPriceIsFrom ? "from " : ""}£{a.combinedPrice}</div>}
                        <div style={{ fontSize: 11, color: "#524D60", textTransform: "capitalize" }}>{a.status}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {dayAppts.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60", fontSize: 15 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700 }}>No appointments on this day</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Use the dashboard to add a new booking</div>
        </div>
      )}
    </div>
  );
}

/* ─── APPOINTMENT DETAIL MODAL ───────────────────── */
/* Detail row — module scope so it isn't re-created on every render. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cal-drawer-row">
      <span className="cal-drawer-row-label">{label}</span>
      <span className="cal-drawer-row-value">{value}</span>
    </div>
  );
}

/* ─── AGENDA ROW (mobile day list) ─────────────────────────────
   Time · status accent · name · service/staff · price — all real. */
function AgendaRow({ a, onClick, loyalty }: { a: Appointment; onClick: () => void; loyalty: LoyaltyReady | null }) {
  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
  return (
    <div onClick={onClick} className="cal-agenda-row">
      <div className="cal-agenda-time">
        {formatTimeDisplay(a.date_time)}
      </div>
      <div className="cal-agenda-accent" style={{ background: sc.border }} />
      <div className="cal-agenda-copy">
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {/* The name keeps its own nowrap/ellipsis; the pill is a sibling with
             flexShrink:0 so truncation can never eat it. This is the mobile DAY
             view — it renders AgendaRow, NOT DayView, so it needs its own badge. */}
          <div className="cal-agenda-name">{a.client_name}</div>
          {isRewardReady(a, loyalty) && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.3px",
              padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
              background: "rgba(124,58,237,0.10)", color: "#6D28D9",
              border: "1px solid rgba(124,58,237,0.25)",
            }}>READY</span>
          )}
        </div>
        <div className="cal-agenda-service">
          {a.serviceName || "No service"}{a.staff?.name ? ` \u00b7 ${a.staff.name}` : ""}
        </div>
      </div>
      {typeof a.combinedPrice === "number" && a.combinedPrice > 0 && (
        <div className="cal-agenda-price">£{a.combinedPrice}{a.anyPriceIsFrom ? "+" : ""}</div>
      )}
    </div>
  );
}

/* Next free whole hour on a day, within the visible business window.
   Returns null when every slot is taken so the caller drops the time
   rather than inventing one. */
function nextFreeTime(dayAppts: Appointment[]): string | null {
  const taken = new Set(dayAppts.map(a => new Date(a.date_time).getHours()));
  const free = HOURS.find(h => !taken.has(h));
  return free === undefined ? null : `${String(free).padStart(2, "0")}:00`;
}

interface ApptDrawerProps {
  selectedAppt: Appointment | null;
  setSelectedAppt: (a: Appointment | null) => void;
  onViewAll: () => void;
  salonName: string;
  loyalty: LoyaltyReady | null;
}
/* ─── APPOINTMENT DETAIL DRAWER ──────────────────────────────────
   Every value comes off selectedAppt. Contact actions render only when
   the underlying field actually has a value — no dead buttons. */
function ApptDrawer({ selectedAppt, setSelectedAppt, onViewAll, salonName, loyalty }: ApptDrawerProps) {
  const { vc } = useSalon();
  if (!selectedAppt) return null;
  const a = selectedAppt;
  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
  const mins = durationMins(a);
  const firstName = (a.client_name || "").split(" ")[0];
  const waText = encodeURIComponent(`Hi ${firstName}, this is ${salonName} regarding your appointment.`);

  return (
    <Modal
      open={!!selectedAppt}
      onClose={() => setSelectedAppt(null)}
      title={`${vc.bookingSingular} details`}
      side="right"
      maxWidth={420}
      footer={
        <div className="cal-drawer-footer">
          <button className="cal-drawer-close" onClick={() => setSelectedAppt(null)}>Close</button>
          <button className="cal-drawer-primary" onClick={onViewAll}>View all <ArrowRight size={15} strokeWidth={2} /></button>
        </div>
      }
    >
      {/* Header — initials avatar, real name, real status */}
      <div className="cal-drawer-client">
        <Avatar name={a.client_name} size={48} />
        <div className="cal-drawer-client-copy">
          <div className="cal-drawer-client-name">{a.client_name}</div>
          {isRewardReady(a, loyalty) && loyalty && (
            /* The one surface with room for the full statement. Uses the same
               describeReward() wording the client's email used, so the owner
               reads back exactly what the client was promised. */
            <div style={{
              marginTop: 8, padding: "10px 12px", borderRadius: 10,
              background: "#F5F3FF", border: "1px solid #ECE9F1",
              fontSize: 12.5, color: "#12101A", lineHeight: 1.5,
            }}>
              <strong>Reward ready</strong> — {loyalty.ready.get((a.client_email ?? "").trim().toLowerCase())} of {loyalty.required} visits.
              <br />Ask about {loyalty.rewardText}.
            </div>
          )}
          <div className="cal-drawer-client-sub">{a.status} · Calendar {vc.bookingSingular.toLowerCase()}</div>
        </div>
      </div>

      {/* When / what */}
      <div className="cal-drawer-summary">
        <div className="cal-drawer-summary-icon"><CalendarDays size={18} strokeWidth={1.8} /></div>
        <div className="cal-drawer-summary-copy">
          <div className="cal-drawer-summary-title">
            {vc.bookingSingular} at {formatTimeDisplay(a.date_time)}
          </div>
          <div className="cal-drawer-summary-date">
            {new Date(a.date_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          {a.serviceName && <div className="cal-drawer-service">{a.serviceName}</div>}
          {(mins || a.staff?.name) && (
            <div className="cal-drawer-meta">
              {mins ? `${mins} min` : ""}{mins && a.staff?.name ? " with " : ""}{!mins && a.staff?.name ? "with " : ""}{a.staff?.name || ""}
            </div>
          )}
        </div>
      </div>

      {/* Contact — each action only when its field exists */}
      {(a.client_phone || a.client_email) && (
        <>
          <div className="cal-drawer-section-label">
            {vc.clientSingular} contact
          </div>
          {a.client_phone && <div className="cal-drawer-phone">{a.client_phone}</div>}
          <div className="cal-drawer-actions">
            {a.client_phone && (
              <a href={`tel:${a.client_phone}`}
                className="cal-drawer-action cal-drawer-action-call">
                <Phone size={16} strokeWidth={1.9} />
                <span>Call client</span>
              </a>
            )}
            {a.client_phone && (
              <a href={`https://wa.me/${whatsAppNumber(a.client_phone)}?text=${waText}`} target="_blank" rel="noopener"
                className="cal-drawer-action cal-drawer-action-whatsapp">
                <MessageCircle size={16} strokeWidth={1.9} />
                <span>WhatsApp</span>
              </a>
            )}
            {a.client_email && (
              <a href={`mailto:${a.client_email}`}
                className="cal-drawer-action cal-drawer-action-email">
                <Mail size={15} strokeWidth={1.9} />
                <span>{a.client_email}</span>
              </a>
            )}
          </div>
        </>
      )}

      {/* Details */}
      <div className="cal-drawer-section-label cal-drawer-details-label">
        {vc.bookingSingular} details
      </div>
      <div className="cal-drawer-row">
        <span className="cal-drawer-row-label">Status</span>
        <span className="cal-drawer-status" style={{ marginTop: 0, background: sc.bg, color: sc.text, borderColor: sc.border }}>
          <span style={{ background: sc.dot }} />{a.status}
        </span>
      </div>
      {a.staff?.name && <DetailRow label={vc.staffSingular} value={a.staff.name} />}
      {mins !== null && <DetailRow label="Duration" value={`${mins} min`} />}
      {typeof a.combinedPrice === "number" && a.combinedPrice > 0 && (
        <div className="cal-drawer-total">
          <span className="cal-drawer-total-label">Total</span>
          <span className="cal-drawer-total-value">£{a.combinedPrice}{a.anyPriceIsFrom ? "+" : ""}</span>
        </div>
      )}
    </Modal>
  );
}

/* ─── MAIN CALENDAR CONTENT ─────────────────────── */
function CalendarContent() {
  const router = useRouter();
  const { vc } = useSalon();
  const [salonName, setSalonName]   = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyReady | null>(null);
  const [appointments, setAppts]    = useState<Appointment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonName(profile.salon.name);
      const { data } = await supabase
        .from("appointments")
        .select("*, services(name,price,price_is_from), staff(name)")
        .eq("salon_id", profile.salon.id)
        .order("date_time", { ascending: true });
      const resolved = await resolveAppointmentServices(supabase, data || []);
      const enriched = (data || []).map(a => {
        const r = resolved.get(a.id);
        return { ...a, serviceName: r?.serviceName, combinedPrice: r?.combinedPrice, anyPriceIsFrom: r?.anyPriceIsFrom };
      });
      setAppts(enriched);

      /* Loyalty "reward ready" lookup — additive and non-fatal. Wrapped so a
         failure here can never stop the calendar rendering. Stays null when the
         programme is off or unconfigured, in which case nothing renders. */
      try {
        const { data: ls } = await supabase
          .from("loyalty_settings")
          .select("enabled, visits_required, reward_type, reward_service_id, reward_value, reward_description")
          .eq("salon_id", profile.salon.id)
          .maybeSingle();
        if (ls?.enabled && ls.visits_required > 0) {
          const [{ data: prog }, { data: svc }] = await Promise.all([
            supabase.from("loyalty_progress")
              .select("client_email, visits")
              .eq("salon_id", profile.salon.id)
              .gte("visits", ls.visits_required),
            ls.reward_type === "free_service" && ls.reward_service_id
              ? supabase.from("services").select("name").eq("id", ls.reward_service_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const ready = new Map<string, number>();
          (prog ?? []).forEach((r: { client_email: string; visits: number }) => ready.set(r.client_email, r.visits));
          setLoyalty({ ready, required: ls.visits_required, rewardText: describeReward(ls, svc?.name ?? null) });
        }
      } catch (e) {
        console.error("[calendar] loyalty lookup failed (non-fatal):", e);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const weekStart = useMemo(() => getMonday(currentDate), [currentDate]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const monthDays = useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [currentDate]);

  const getApptsByDay = useCallback((day: Date) =>
    appointments.filter(a => sameDay(new Date(a.date_time), day)), [appointments]);

  const nav = (dir: number) => {
    if (view === "week")  setCurrentDate(d => addDays(d, dir * 7));
    if (view === "day")   setCurrentDate(d => addDays(d, dir));
    if (view === "month") {
      setCurrentDate(d => {
        const nd = new Date(d);
        nd.setMonth(nd.getMonth() + dir);
        return nd;
      });
    }
  };

  const today = new Date();

  const Topbar = (
    <>
      <style>{CALENDAR_STYLES}</style>
      <header className="cal-topbar">
        <div className="cal-topbar-left">
          <HamburgerBtn />
          <div className="cal-topbar-title">Calendar</div>
        </div>
        <a href="/dashboard/bookings" className="cal-topbar-create" aria-label={`New ${vc.bookingSingular.toLowerCase()}`} title={`New ${vc.bookingSingular.toLowerCase()}`}>
          <Plus size={20} strokeWidth={2} />
          <span className="cal-topbar-create-label">New {vc.bookingSingular.toLowerCase()}</span>
        </a>
      </header>
    </>
  );

  if (loading) return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading calendar…</div>
    </DashboardShell>
  );

  const weekAppts = appointments.filter(a => weekDays.some(d => sameDay(new Date(a.date_time), d)));
  const dayAppts = getApptsByDay(currentDate);
  const rangeLabel = `${weekDays[0].toLocaleDateString("en-GB", { day: "numeric" })}–${weekDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  const freeTime = nextFreeTime(dayAppts);

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div className="cal-page cal-reference-page">

        {/* ── Header ── */}
        <div className="cal-heading">
          <div className="cal-eyebrow">
            {weekAppts.length} {weekAppts.length === 1 ? vc.bookingSingular.toLowerCase() : vc.bookingPlural.toLowerCase()} this week
          </div>
          <h1 className="cal-title">Calendar</h1>
        </div>

        {/* ── Toolbar ── */}
        <div className="cal-toolbar">
          <div className="cal-toolbar-main">
            <div className="cal-nav-buttons">
              <button className="cal-nav-button" onClick={() => nav(-1)} aria-label="Previous period" title="Previous period">
                <ChevronLeft size={17} strokeWidth={2} />
              </button>
              <button className="cal-nav-button cal-nav-today" onClick={() => setCurrentDate(new Date())}>Today</button>
              <button className="cal-nav-button" onClick={() => nav(1)} aria-label="Next period" title="Next period">
                <ChevronRight size={17} strokeWidth={2} />
              </button>
            </div>
            <div className="cal-range">{rangeLabel}</div>
          </div>
          <div className="cal-view-toggle">
            {(["day","week","month"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`cal-view-button${view === v ? " active" : ""}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ── Status counts (real) ── */}
        <div className="cal-status-counts">
          {[
            { label: "Confirmed", value: appointments.filter(a => a.status === "confirmed").length, color: "#047857" },
            { label: "Pending", value: appointments.filter(a => a.status === "pending").length, color: "#F59E0B" },
            { label: "Cancelled", value: appointments.filter(a => a.status === "cancelled").length, color: "#EF4444" },
          ].map(st => (
            <div key={st.label} className="cal-status-count">
              <i style={{ background: st.color }} />
              <span className="cal-status-value">{st.value}</span>
              <span className="cal-status-label">{st.label}</span>
            </div>
          ))}
        </div>

        {/* ── Desktop: the grid views ── */}
        <div className="cal-desktop">
          {view === "month" && <MonthView currentDate={currentDate} monthDays={monthDays} getApptsByDay={getApptsByDay} today={today} setSelectedAppt={setSelectedAppt} />}
          {view === "week"  && <WeekView weekDays={weekDays} appointments={appointments} today={today} setSelectedAppt={setSelectedAppt} loyalty={loyalty} />}
          {view === "day"   && <DayView currentDate={currentDate} getApptsByDay={getApptsByDay} setSelectedAppt={setSelectedAppt} loyalty={loyalty} />}
        </div>

        {/* ── Mobile ──────────────────────────────────────────────
            Day = the agenda (not hour-bound, so nothing hides);
            Week/Month reuse the very same grid components desktop
            renders. No new state and no new view components — this is
            the existing `view` value driving which one shows. */}
        <div className="cal-mobile">
          {view === "week" && (
            <div className="cal-mobile-grid">
              <WeekView weekDays={weekDays} appointments={appointments} today={today} setSelectedAppt={setSelectedAppt} loyalty={loyalty} />
            </div>
          )}
          {view === "month" && (
            <div className="cal-mobile-grid">
              <MonthView currentDate={currentDate} monthDays={monthDays} getApptsByDay={getApptsByDay} today={today} setSelectedAppt={setSelectedAppt} />
            </div>
          )}
          {view === "day" && (
          <>
          <div className="cal-week-card">
            {weekDays.map((day, di) => {
              const active = sameDay(day, currentDate);
              return (
                <button key={day.toISOString()} onClick={() => setCurrentDate(day)}
                  className={`cal-day-button${active ? " active" : ""}`}
                  aria-label={day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  aria-pressed={active}>
                  <span className="cal-day-name">{DAYS[di][0]}</span>
                  <span className="cal-day-number">{day.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="cal-agenda-card">
            {dayAppts.length === 0 ? (
              <div className="cal-agenda-empty">
                <div className="cal-agenda-empty-title">Nothing booked</div>
                <div className="cal-agenda-empty-copy">This day is completely free.</div>
              </div>
            ) : (
              <div className="cal-agenda-list">
                {dayAppts.map(a => <AgendaRow key={a.id} a={a} onClick={() => setSelectedAppt(a)} loyalty={loyalty} />)}
              </div>
            )}

            <button className="cal-add-booking" onClick={() => router.push("/dashboard/bookings")}>
              <Plus size={16} strokeWidth={1.9} />
              Add {vc.bookingSingular.toLowerCase()}{freeTime ? ` at ${freeTime}` : ""}
            </button>
          </div>
          </>
          )}
        </div>
      </div>

      <nav className="cal-reference-nav" aria-label="Calendar navigation">
        <Link href="/dashboard" className="cal-reference-nav-item"><House strokeWidth={1.7} /><span>Overview</span></Link>
        <Link href="/dashboard/calendar" className="cal-reference-nav-item active" aria-current="page"><CalendarDays strokeWidth={1.9} /><span>Calendar</span></Link>
        <Link href="/dashboard/bookings" className="cal-reference-nav-item"><Clock3 strokeWidth={1.7} /><span>{vc.bookingPlural}</span></Link>
        <Link href="/dashboard/waitlist" className="cal-reference-nav-item"><ListPlus strokeWidth={1.7} /><span>Waitlist</span></Link>
        <Link href="/dashboard/clients" className="cal-reference-nav-item"><UsersRound strokeWidth={1.7} /><span>{vc.clientPlural}</span></Link>
      </nav>

      <ApptDrawer selectedAppt={selectedAppt} setSelectedAppt={setSelectedAppt} salonName={salonName} loyalty={loyalty} onViewAll={() => { router.push("/dashboard/bookings"); setSelectedAppt(null); }} />
    </DashboardShell>
  );
}

export default function CalendarPage() {
  return (
    <FeatureGate feature="calendar">
      <CalendarContent />
    </FeatureGate>
  );
}
