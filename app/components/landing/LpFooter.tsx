import Image from "next/image";
import Link from "next/link";
import "./landing.css";

export default function LpFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <Link href="/" className="lp-logo">
              <Image src="/brand/logo-light-no-tagline.svg" alt="Feature" width={72} height={32} style={{ height: 32, width: "auto" }} />
            </Link>
            <p>The all-in-one booking and management platform for UK salons, barbers, gyms, spas and clinics.</p>
          </div>
          <div className="lp-footer-col">
            <h5>Product</h5>
            <a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#how">How it works</a>
          </div>
          <div className="lp-footer-col">
            <h5>Company</h5>
            <Link href="/about">About us</Link><Link href="/blog">Blog</Link>
          </div>
          <div className="lp-footer-col">
            <h5>Resources</h5>
            <Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link>
          </div>
          <div className="lp-footer-col">
            <h5>Contact</h5>
            <a href="mailto:features@featuresalon.co.uk">features@featuresalon.co.uk</a>
            <address style={{ fontStyle: "normal", display: "block", fontSize: 14, color: "#524D60", lineHeight: 1.5 }}>
              FEATURES TECH LTD<br />
              71-75 Shelton Street, Covent Garden<br />
              London WC2H 9JQ
            </address>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Feature. All rights reserved.</span>
          <span>Payments powered by Stripe</span>
        </div>
      </div>
    </footer>
  );
}
