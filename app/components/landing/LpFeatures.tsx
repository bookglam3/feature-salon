import "./landing.css";

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <circle cx="17" cy="7.5" r="2.6" />
      <path d="M15.2 14.7c2.8.5 4.8 3 4.8 6.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 13 6 8Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="12" width="4" height="8" />
      <rect x="10" y="6" width="4" height="14" />
      <rect x="16.5" y="9" width="4" height="11" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  );
}

const features = [
  { Icon: CalendarIcon, title: "Online Booking", desc: "Allow your clients to book appointments 24/7 from any device." },
  { Icon: UserIcon, title: "Client Management", desc: "Keep all your client information, history and preferences in one place." },
  { Icon: UsersIcon, title: "Staff Management", desc: "Manage your team, schedules and permissions effortlessly." },
  { Icon: BellIcon, title: "SMS & Email Reminders", desc: "Reduce no-shows with automated reminders and keep your calendar full." },
  { Icon: CreditCardIcon, title: "Payments", desc: "Accept payments online securely with Stripe. Get paid faster." },
  { Icon: BarChartIcon, title: "Reports & Analytics", desc: "Understand your business performance with detailed insights." },
  { Icon: TagIcon, title: "Services & Packages", desc: "Create and manage services, packages and special offers easily." },
  { Icon: SparkleIcon, title: "Custom Branding", desc: "Make Feature your own with custom branding and your logo." },
];

export default function LpFeatures() {
  return (
    <section className="lp-section" id="features" style={{ background: "#FBFAFD" }}>
      <div className="lp-section-inner">
        <p className="lp-eyebrow">Features</p>
        <h2 className="lp-section-title">Everything you need to run your business</h2>
        <p className="lp-section-sub">Powerful features to help you save time, increase bookings and grow — whether you run a salon, barbershop, gym, spa or clinic.</p>
        <div className="lp-feat-grid">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="lp-feat">
              <div className="lp-feat-ic"><Icon /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
