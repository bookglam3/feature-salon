import Link from "next/link";
import "./landing.css";

const checklist = [
  "Online Booking 24/7",
  "Zero Commission",
  "Easy Client Management",
  "Accept Payments Securely",
];

const navItems = [
  "Dashboard", "Appointments", "Calendar", "Clients",
  "Services", "Staff", "Payments", "Reports", "Settings",
];

const appointments = [
  { t: "10:00", n: "Sarah Johnson", s: "Hair Cut & Blow Dry" },
  { t: "11:30", n: "Emma Williams", s: "Full Highlights" },
  { t: "13:00", n: "Olivia Brown", s: "Balayage" },
  { t: "14:30", n: "Sophie Davis", s: "Hair Treatment" },
];

const stats = [
  { l: "Total Appointments", v: "128", d: "↑ 12% from last month" },
  { l: "Total Revenue", v: "£4,560", d: "↑ 8% from last month" },
  { l: "New Clients", v: "32", d: "↑ 18% from last month" },
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function LpHero() {
  return (
    <section className="lp-hero">
      <div className="lp-hero-inner">
        <div>
          <span className="lp-pill">✦ All-in-one Booking &amp; Management</span>
          <h1 className="lp-hero-title">Grow Your Business with <span className="accent">Feature</span></h1>
          <p className="lp-hero-sub">The all-in-one platform for salons, barbers, gyms, spas and clinics — online booking, client management and payments in one place.</p>
          <ul className="lp-checklist">
            {checklist.map(item => (
              <li key={item} className="lp-check">
                <span className="lp-check-ic"><CheckIcon /></span>
                {item}
              </li>
            ))}
          </ul>
          <div className="lp-hero-cta">
            <Link href="/signup" className="lp-btn lp-btn-primary lp-btn-lg">Start Free Trial</Link>
            <Link href="/signup" className="lp-btn lp-btn-outline lp-btn-lg">📅 Book a Demo</Link>
          </div>
          <p className="lp-hero-micro">No credit card required · 14 days free trial</p>
        </div>

        <div className="lp-mock">
          <div className="lp-mock-bar">
            <span className="lp-mock-dot" style={{ background: "#ff5f57" }}></span>
            <span className="lp-mock-dot" style={{ background: "#febc2e" }}></span>
            <span className="lp-mock-dot" style={{ background: "#28c840" }}></span>
          </div>
          <div className="lp-mock-body">
            <div className="lp-mock-side">
              <div className="lp-mock-brand"><span>F</span>Feature</div>
              <div className="lp-mock-nav">
                {navItems.map(item => (
                  <div key={item} className={item === "Dashboard" ? "on" : undefined}>{item}</div>
                ))}
              </div>
            </div>
            <div className="lp-mock-main">
              <div className="lp-mock-head">
                <div><h4>Dashboard</h4><p>Welcome back, Anita</p></div>
              </div>
              <div className="lp-mock-stats">
                {stats.map(stat => (
                  <div key={stat.l} className="lp-mock-stat">
                    <div className="l">{stat.l}</div>
                    <div className="v">{stat.v}</div>
                    <div className="d">{stat.d}</div>
                  </div>
                ))}
              </div>
              <div className="lp-mock-panel">
                <h5>Upcoming Appointments</h5>
                <div className="lp-mock-appts">
                  {appointments.map(appt => (
                    <div key={appt.t} className="lp-mock-appt">
                      <span className="t">{appt.t}</span>
                      <span className="n">{appt.n}</span> — <span className="s">{appt.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
