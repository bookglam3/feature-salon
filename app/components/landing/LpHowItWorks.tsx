import "./landing.css";

const steps = [
  {
    title: "Set up your services",
    text: "Add your services, your prices and your staff. If you've already got a client list, you can bring that over too. It takes a few minutes and there's nothing technical about it.",
  },
  {
    title: "Share your booking link",
    text: "You'll get your own booking page and a QR code. Put the link on Instagram, your website, or print the code for the shop door, so clients can book themselves in whenever suits them.",
  },
  {
    title: "Let it run",
    text: "Bookings land in your calendar, payments go through Stripe straight to your account, and reminders go out by WhatsApp and email on their own. All you need to do is turn up.",
  },
];

export default function LpHowItWorks() {
  return (
    <section className="lp-section" id="how" style={{ background: "#FBFAFD" }}>
      <div className="lp-section-inner">
        <p className="lp-eyebrow">How it works</p>
        <h2 className="lp-section-title">Up and running in an afternoon</h2>
        <p className="lp-section-sub">No long setup, no training course. Most owners have their booking page live the same day they sign up.</p>
        <div className="lp-how-grid">
          {steps.map((step, i) => (
            <div key={step.title} className="lp-how-step">
              <div className="lp-how-num">{i + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
