// Lifecycle email copy, word for word from docs/lifecycle-emails.md.
// Change the doc first, then this file. Plain text only (no HTML), so names
// need no escaping; they are kept to one line so they can't break a subject.
// Pure: the caller passes everything in, so scripts/test-lifecycle.mjs can
// render every email directly under node.

import type { EmailKey, ServiceState } from "./decide";

export interface EmailData {
  firstName: string;        // "" when unknown
  salonName: string;
  slug: string;
  staffLabel: string;       // the dashboard's staff page name, e.g. "Stylists"
  serviceState: ServiceState;
  trialEnd: Date;
  unsubscribeUrl: string;
  googleReviewLink: string;
  siteUrl: string;          // e.g. "https://featuresalon.co.uk"
}

export interface RenderedEmail {
  subject: string;
  text: string;
}

/** Collapse to a single line (no CR/LF/tabs) and cap the length. */
export function oneLine(value: unknown, max = 80): string {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

/** First word of the owner's signup name; "" if missing or it looks like an email. */
export function firstNameFrom(fullName: unknown): string {
  const first = oneLine(fullName, 80).split(" ")[0] ?? "";
  return first.includes("@") ? "" : first.slice(0, 40);
}

/** e.g. "Friday 17 October", in UK time. */
export function formatTrialEnd(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London",
  }).format(d);
}

export function footer(unsubscribeUrl: string): string {
  return [
    "—",
    "Feature · FEATURES TECH LTD · 71-75 Shelton Street, London WC2H 9JQ",
    "Registered in England and Wales, company no. 17288184",
    `You're getting this because you have a Feature account. Don't want these emails? Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
}

export function renderEmail(key: EmailKey, d: EmailData): RenderedEmail {
  const first = oneLine(d.firstName, 40);
  const salon = oneLine(d.salonName, 80);
  const hi = first ? `Hi ${first},` : "Hi there,";
  const bookingLink = `${d.siteUrl}/book/${d.slug}`;
  const subscribeLink = `${d.siteUrl}/subscribe`;
  // Emails 1, 3 and 7 address the owner by name in the subject; without a name the ", {first_name}" goes.
  const named = (base: string, end = "") => (first ? `${base}, ${first}${end}` : `${base}${end}`);

  let subject: string;
  let body: string[];

  switch (key) {
    case "e1_welcome":
      subject = named("Welcome to Feature");
      body = [
        `Thanks for signing up to Feature. We're really glad to have ${salon} on board.`,
        "",
        "Three things get you taking bookings:",
        "",
        d.serviceState === "none"
          ? "1. Add your services and prices (Dashboard → Services)"
          : "1. Check your services and prices (we've added a few examples to get you started)",
        `2. Add your team, even if it's just you (Dashboard → ${oneLine(d.staffLabel, 40) || "Staff"})`,
        `3. Share your booking link: ${bookingLink}`,
        "",
        "Most owners are done in about 15 minutes. Put the link in your Instagram bio and you're live.",
        "",
        "If anything's confusing, just reply to this email. A real person reads every message.",
      ];
      break;

    case "e2_setup_help":
      subject = `Can we help you set up ${salon}?`;
      body = [
        d.serviceState === "none"
          ? `We noticed ${salon} doesn't have any services on it yet, so your booking page is still empty.`
          : `We noticed ${salon} is still showing our sample services, so your booking page isn't really yours yet.`,
        "",
        "No pressure. Setting up a new system is a faff when you're busy with clients all day.",
        "",
        "Adding your services takes a few minutes: go to Dashboard → Services, add each service with its price and length, and you're ready to share your link.",
        "",
        "If you get stuck on anything, or something got in the way, reply and tell us. We'll help you through it.",
      ];
      break;

    case "e3_week_one":
      subject = named("Quick one");
      body = [
        "You've had Feature for a week now, so we wanted to check in.",
        "",
        "Is anything not working the way you expected, or is something missing that you need? Even small things are useful to hear about. It's often a quick fix on our side.",
        "",
        "Just hit reply. A one-line answer is perfect.",
      ];
      break;

    case "e4_trial_ending": {
      const date = formatTrialEnd(d.trialEnd);
      subject = `Your Feature trial ends on ${date}`;
      body = [
        `Just a heads-up: your free trial for ${salon} ends on ${date}.`,
        "",
        "If you'd like to keep taking bookings, you can choose a plan here:",
        subscribeLink,
        "",
        "Plans start at £29 a month. That's one flat fee, with no commission on any booking. You can cancel any time.",
        "",
        "If you're not sure Feature is right for you, or something's holding you back, reply and tell us. We'd rather hear it than lose you without knowing why.",
      ];
      break;
    }

    case "e5_trial_ended":
      subject = "What could we have done better?";
      body = [
        `Your Feature trial for ${salon} has now ended, and you didn't go ahead with a plan. That's completely fine.`,
        "",
        "Could we ask one favour? Reply with the main reason. Was it the price, a missing feature, not enough time to set it up, or something else?",
        "",
        "We're building Feature for owners like you, and every honest answer shapes what we build next.",
        "",
        "If you'd like to pick up where you left off, your account is still here:",
        subscribeLink,
        "",
        "Thanks for giving it a go.",
      ];
      break;

    case "e6_monthly":
      subject = `How's Feature working for ${salon}?`;
      body = [
        "Just our monthly check-in. How's Feature working for you?",
        "",
        "If there's anything that's annoying you, slowing you down, or that you wish it did, reply and let us know. We read every reply, and a lot of what's been built so far came from owners telling us exactly this.",
        "",
        "And if it's all running smoothly, that's great to hear too.",
      ];
      break;

    case "e7_review":
      subject = named("A small favour", "?");
      body = [
        `You've been using Feature at ${salon} for a month now. Thank you for trusting a small business with your bookings.`,
        "",
        "Feature is still early, and most salon owners find new software through reviews from other owners. If you have two minutes, would you share your honest experience on Google?",
        "",
        d.googleReviewLink,
        "",
        "Good, bad or somewhere in between, all of it helps. And if something isn't right, we'd really like to hear it directly too. Just reply here.",
      ];
      break;

    case "e8_gone_quiet":
      subject = `Everything OK with ${salon}?`;
      body = [
        `We noticed there hasn't been much activity on ${salon} for the last couple of weeks, so we wanted to check you're all right.`,
        "",
        "If something stopped working, or Feature isn't fitting how you run things, reply and tell us. We'd much rather fix it than have you stuck.",
        "",
        "If you're just on a quiet spell or a break, ignore this. Your booking page is still live:",
        bookingLink,
      ];
      break;
  }

  return {
    subject: oneLine(subject, 150),
    text: [hi, "", ...body, "", "The Feature Team", "", footer(d.unsubscribeUrl)].join("\n"),
  };
}
