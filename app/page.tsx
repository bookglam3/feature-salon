import Link from "next/link";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", background: "#F2F4F7", minHeight: "100vh" }}>
      
      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "#0F172A", letterSpacing: "-0.5px" }}>feature</span>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <a href="#features" style={{ fontSize: "14px", color: "#64748B", textDecoration: "none" }}>Features</a>
          <a href="#how" style={{ fontSize: "14px", color: "#64748B", textDecoration: "none" }}>How it works</a>
          <a href="#pricing" style={{ fontSize: "14px", color: "#64748B", textDecoration: "none" }}>Pricing</a>
          <Link href="/login" style={{ fontSize: "14px", color: "#64748B", textDecoration: "none" }}>Login</Link>
          <Link href="/signup" style={{ background: "#4F6EF7", color: "#fff", fontSize: "13px", padding: "8px 20px", borderRadius: "8px", textDecoration: "none" }}>Start free trial</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: "#fff", padding: "96px 40px", textAlign: "center", borderBottom: "0.5px solid #E8EAF0" }}>
        <div style={{ display: "inline-block", background: "#EEF2FF", color: "#4F6EF7", fontSize: "12px", letterSpacing: "2px", padding: "6px 18px", borderRadius: "20px", marginBottom: "32px", border: "0.5px solid #C7D2FE" }}>
          BUILT FOR UK & EUROPEAN SALONS
        </div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "56px", fontWeight: 400, color: "#0F172A", lineHeight: "1.15", maxWidth: "620px", margin: "0 auto 24px", letterSpacing: "-1.5px" }}>
          Run your salon without the chaos
        </h1>
        <p style={{ fontSize: "18px", color: "#64748B", maxWidth: "460px", margin: "0 auto 40px", lineHeight: "1.7" }}>
          Feature handles your bookings, staff, and clients — so you can focus on what you do best.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link href="/signup" style={{ background: "#4F6EF7", color: "#fff", fontSize: "15px", padding: "14px 32px", borderRadius: "10px", textDecoration: "none" }}>Start free trial</Link>
          <a href="#how" style={{ background: "#fff", color: "#0F172A", fontSize: "15px", padding: "14px 32px", borderRadius: "10px", textDecoration: "none", border: "0.5px solid #C8C8C6" }}>See how it works</a>
        </div>
      </section>

      {/* Trust bar */}
      <section style={{ background: "#F8F9FC", padding: "20px 40px", borderBottom: "0.5px solid #E8EAF0", display: "flex", justifyContent: "center", gap: "48px" }}>
        {["No setup fees", "Free 14-day trial", "Cancel anytime", "UK-based support"].map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748B" }}>
            <div style={{ width: "6px", height: "6px", background: "#4F6EF7", borderRadius: "50%" }}></div>
            {item}
          </div>
        ))}
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "80px 40px", background: "#F2F4F7" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#94A3B8", marginBottom: "12px" }}>WHAT YOU GET</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "36px", fontWeight: 400, color: "#0F172A", letterSpacing: "-0.5px" }}>Everything your salon needs</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", maxWidth: "900px", margin: "0 auto" }}>
          {[
            { title: "Online booking", desc: "Clients book 24/7 from your own booking page. No more missed calls." },
            { title: "Staff management", desc: "Set hours, assign services, and manage your team in one place." },
            { title: "Client profiles", desc: "Track visit history, preferences, and notes for every client." },
            { title: "Reports", desc: "See revenue, bookings, and trends at a glance every day." },
            { title: "Reminders", desc: "Automated SMS and email reminders reduce no-shows by 60%." },
            { title: "Payments", desc: "Accept deposits and full payments online. Stripe powered." },
          ].map((f) => (
            <div key={f.title} style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "28px" }}>
              <div style={{ width: "36px", height: "36px", background: "#EEF2FF", borderRadius: "8px", marginBottom: "16px" }}></div>
              <h3 style={{ fontSize: "15px", fontWeight: 500, color: "#0F172A", marginBottom: "8px" }}>{f.title}</h3>
              <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: "80px 40px", background: "#fff", borderTop: "0.5px solid #E8EAF0" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#94A3B8", marginBottom: "12px" }}>HOW IT WORKS</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "36px", fontWeight: 400, color: "#0F172A", letterSpacing: "-0.5px" }}>Up and running in minutes</h2>
        </div>
        <div style={{ display: "flex", gap: "0", maxWidth: "700px", margin: "0 auto" }}>
          {[
            { num: "1", title: "Set up your salon", desc: "Add your services, staff, and working hours." },
            { num: "2", title: "Share your link", desc: "Send clients your booking page or add it to Instagram." },
            { num: "3", title: "Sit back", desc: "Feature handles bookings, reminders, and payments for you." },
          ].map((s) => (
            <div key={s.num} style={{ flex: 1, textAlign: "center", padding: "0 24px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#4F6EF7", color: "#fff", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>{s.num}</div>
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#0F172A", marginBottom: "8px" }}>{s.title}</h3>
              <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.6" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "80px 40px", background: "#F2F4F7", borderTop: "0.5px solid #E8EAF0" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#94A3B8", marginBottom: "12px" }}>PRICING</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "36px", fontWeight: 400, color: "#0F172A", letterSpacing: "-0.5px" }}>Simple, honest pricing</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", maxWidth: "640px", margin: "0 auto" }}>
          <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "32px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#94A3B8", marginBottom: "12px" }}>STARTER</div>
            <div style={{ marginBottom: "16px" }}>
              <span style={{ fontFamily: "Georgia, serif", fontSize: "40px", color: "#0F172A" }}>£29</span>
              <span style={{ fontSize: "14px", color: "#64748B" }}>/month</span>
            </div>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "24px", lineHeight: "1.6" }}>Perfect for independent stylists and small salons.</p>
            {["Online booking page", "Up to 2 staff", "Client profiles", "Email reminders"].map((f) => (
              <div key={f} style={{ fontSize: "13px", color: "#64748B", padding: "8px 0", borderBottom: "0.5px solid #F1F5F9", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#4F6EF7" }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: "block", textAlign: "center", marginTop: "24px", padding: "12px", borderRadius: "8px", border: "0.5px solid #E8EAF0", color: "#0F172A", textDecoration: "none", fontSize: "14px" }}>Start free trial</Link>
          </div>
          <div style={{ background: "#fff", border: "1.5px solid #4F6EF7", borderRadius: "12px", padding: "32px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#4F6EF7", marginBottom: "12px" }}>PROFESSIONAL</div>
            <div style={{ marginBottom: "16px" }}>
              <span style={{ fontFamily: "Georgia, serif", fontSize: "40px", color: "#0F172A" }}>£59</span>
              <span style={{ fontSize: "14px", color: "#64748B" }}>/month</span>
            </div>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "24px", lineHeight: "1.6" }}>For growing salons that need more power and control.</p>
            {["Everything in Starter", "Unlimited staff", "SMS reminders", "Reports & analytics"].map((f) => (
              <div key={f} style={{ fontSize: "13px", color: "#64748B", padding: "8px 0", borderBottom: "0.5px solid #F1F5F9", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#4F6EF7" }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: "block", textAlign: "center", marginTop: "24px", padding: "12px", borderRadius: "8px", background: "#4F6EF7", color: "#fff", textDecoration: "none", fontSize: "14px" }}>Start free trial</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#0F172A", padding: "40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: "20px", color: "#fff", letterSpacing: "-0.5px" }}>feature</span>
        <span style={{ fontSize: "13px", color: "#64748B" }}>© 2025 Feature. Built for salons across the UK & Europe.</span>
      </footer>

    </main>
  );
}