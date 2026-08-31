import Link from "next/link";
import "./landing.css";

export default function LpCta() {
  return (
    <section className="lp-cta-wrap">
      <div className="lp-cta">
        <div className="lp-cta-text">
          <h2>Ready to grow your business?</h2>
          <p>Switch to flat-fee booking and keep every pound you earn. Set up in minutes, cancel anytime.</p>
        </div>
        <div className="lp-cta-actions">
          <Link href="/signup" className="lp-btn-white">Start Your Free Trial</Link>
          <span className="lp-cta-micro">No credit card required</span>
        </div>
      </div>
    </section>
  );
}
