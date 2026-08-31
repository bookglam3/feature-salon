import { Fragment } from "react";
import Link from "next/link";
import "./landing.css";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const times = ["9 AM", "10 AM", "11 AM", "12 PM"];

const listItems = [
  "View by day, week or month",
  "Drag & drop appointments",
  "Colour-coded by staff or service",
  "Syncs in real-time",
];

type Evt = { who: string; service: string; bg: string; color: string };

const events: Record<string, Evt> = {
  "0-0": { who: "Emma W.", service: "Highlights", bg: "#EDE9FF", color: "#6D28D9" },
  "0-3": { who: "Mia M.", service: "Blow Dry", bg: "#E0F2FE", color: "#0369A1" },
  "1-1": { who: "Sarah J.", service: "Hair Cut", bg: "#FEF3C7", color: "#B45309" },
  "1-4": { who: "Olivia B.", service: "Balayage", bg: "#FCE7F3", color: "#BE185D" },
  "2-2": { who: "Chloe D.", service: "Colour", bg: "#EDE9FF", color: "#6D28D9" },
  "3-3": { who: "Sophie C.", service: "Keratin", bg: "#E0F2FE", color: "#0369A1" },
};

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function LpCalendar() {
  return (
    <section className="lp-cal-sec">
      <div className="lp-cal-inner">
        <div>
          <p className="lp-cal-eyebrow">Smart Calendar</p>
          <h2 className="lp-cal-title">Manage your appointments with ease</h2>
          <p className="lp-cal-text">Our smart calendar helps you visualise your day, week or month. Drag, drop and manage appointments effortlessly.</p>
          <ul className="lp-cal-list">
            {listItems.map(item => (
              <li key={item} className="lp-cal-item">
                <span className="lp-cal-dot"><CheckIcon /></span>
                {item}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="lp-btn lp-btn-primary lp-btn-lg">Start Free Trial</Link>
        </div>

        <div className="lp-cal-mock">
          <div className="lp-cal-mock-bar">
            <span className="lp-cal-mock-dot" style={{ background: "#ff5f57" }}></span>
            <span className="lp-cal-mock-dot" style={{ background: "#febc2e" }}></span>
            <span className="lp-cal-mock-dot" style={{ background: "#28c840" }}></span>
          </div>
          <div className="lp-cal-mock-head">
            <h4>Calendar</h4>
            <span className="range">5 – 11 May 2026</span>
          </div>
          <div className="lp-cal-grid">
            <div className="lp-cal-dayhdr"></div>
            {days.map(day => (
              <div key={day} className="lp-cal-dayhdr">{day}</div>
            ))}

            {times.map((time, tIdx) => (
              <Fragment key={time}>
                <div className="lp-cal-timecol">{time}</div>
                {days.map((day, dIdx) => {
                  const evt = events[`${tIdx}-${dIdx}`];
                  return (
                    <div key={day} className="lp-cal-cell">
                      {evt && (
                        <div className="lp-cal-evt" style={{ background: evt.bg, color: evt.color }}>
                          <div className="who">{evt.who}</div>
                          {evt.service}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
