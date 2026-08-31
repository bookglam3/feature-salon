"use client";

import { useState } from "react";
import "./landing.css";

const faqs = [
  {
    q: "How much does Feature cost?",
    a: "There are three plans to choose from. Starter is £29 a month, Pro is £59, and Business is £99. Whichever one you pick, it's a flat monthly fee, so there's no commission and no charge per booking.",
  },
  {
    q: "Does Feature charge commission on bookings?",
    a: "No, never. You pay your monthly fee and that's it. Whatever your clients pay you, you keep. A lot of booking platforms take a cut of every appointment. We don't work that way.",
  },
  {
    q: "Is Feature a good alternative to Fresha, Treatwell or Booksy?",
    a: "It can be. Those platforms usually take commission or charge per booking, which adds up once you're busy. Feature gives you online booking, payments, reminders and client management for one flat fee instead, so you know exactly what you're paying each month.",
  },
  {
    q: "What types of business is Feature for?",
    a: "Salons and barbershops mostly, but also gyms, spas, yoga studios, and physio or wellness clinics. Really, if you take appointments and need a way for clients to book you in, it'll work for your business.",
  },
  {
    q: "Can my clients book online 24/7?",
    a: "Yes. You get a booking page and a QR code you can put on your door, your Instagram, wherever suits. Clients can book from their phone at any time of day, and there's nothing for them to download.",
  },
  {
    q: "Does Feature send appointment reminders?",
    a: "It does. WhatsApp and email reminders go out automatically before each appointment, so you're not chasing clients yourself, and you'll see fewer no-shows.",
  },
  {
    q: "How do payments work?",
    a: "Payments run through Stripe, so it's secure and the money lands straight in your own account. You can take deposits or full payment when someone books, and again, we don't take any commission from it.",
  },
  {
    q: "Can I import my existing clients?",
    a: "Yes, you can bring your existing client list over when you sign up, so you're not starting from scratch. Their details and history come with them.",
  },
  {
    q: "Is there a free trial? Do I need a card to start?",
    a: "There's a 14-day free trial and you don't need to put a card in to start it. If it's not for you, you can cancel any time, no hassle.",
  },
  {
    q: "Can I manage multiple staff and services?",
    a: "You can. Depending on your plan, you get separate calendars for each member of staff, and you can set up your services and packages so clients can book more than one thing at once. It's all managed from the same dashboard.",
  },
];

function PlusIcon() {
  return (
    <svg className="lp-faq-icon" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="11" y1="4" x2="11" y2="18" />
      <line x1="4" y1="11" x2="18" y2="11" />
    </svg>
  );
}

export default function LpFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="lp-section" id="faq">
      <div className="lp-section-inner">
        <p className="lp-eyebrow">FAQ</p>
        <h2 className="lp-section-title">Frequently asked questions</h2>
        <p className="lp-section-sub">Everything you need to know about Feature. Can&apos;t find an answer? Email us at features@featuresalon.co.uk.</p>
        <div className="lp-faq-wrap">
          {faqs.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className={`lp-faq-item ${isOpen ? "open" : ""}`}>
                <button
                  className="lp-faq-q"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <PlusIcon />
                </button>
                {isOpen && <div className="lp-faq-a">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
