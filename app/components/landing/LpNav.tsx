"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "./landing.css";

export default function LpNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="lp-nav">
      <div className="lp-nav-inner">
        <Link href="/" className="lp-logo">
          <Image src="/brand/logo-light-no-tagline.svg" alt="Feature" width={72} height={32} style={{ height: 32, width: "auto" }} priority />
        </Link>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#how">How it works</a>
          <Link href="/about">About us</Link>
          <Link href="/blog">Blog</Link>
        </div>
        <div className="lp-nav-right">
          <Link href="/login" className="lp-login">Log in</Link>
          <Link href="/signup" className="lp-btn lp-btn-primary">Start free trial</Link>
          <button
            className="lp-hamburger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="#12101A" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className={`lp-mobile-menu ${open ? "open" : ""}`}>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#how">How it works</a>
        <Link href="/about">About us</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/login">Log in</Link>
        <Link href="/signup" className="lp-btn lp-btn-primary" style={{ width: "100%", marginTop: 8 }}>Start free trial</Link>
      </div>
    </nav>
  );
}
