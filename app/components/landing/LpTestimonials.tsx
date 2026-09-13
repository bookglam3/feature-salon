import "./landing.css";

const testimonials = [
  {
    quote: "Before Feature, managing bookings was a real hassle — and Fresha kept taking commission on top. Now it costs me far less, and the automatic WhatsApp reminders are brilliant. I'd absolutely recommend it to any other salon.",
    initial: "J",
    name: "John",
    business: "Style by John",
  },
];

export default function LpTestimonials() {
  return (
    <section className="lp-section">
      <div className="lp-section-inner">
        <p className="lp-eyebrow">What our customers say</p>
        <h2 className="lp-section-title">Loved by real UK businesses</h2>
        <div className="lp-tst-grid" style={{ marginTop: 48 }}>
          {testimonials.map(t => (
            <div key={t.name} className="lp-tst">
              <p className="lp-tst-quote">&quot;{t.quote}&quot;</p>
              <div className="lp-tst-person">
                <div className="lp-tst-av">{t.initial}</div>
                <div>
                  <div className="lp-tst-name">{t.name}</div>
                  <div className="lp-tst-biz">{t.business}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
