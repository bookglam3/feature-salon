# Feature: Lifecycle Emails

Sender: **Feature Team** <features@featuresalon.co.uk>
Reply-to: features@featuresalon.co.uk
Format: plain text, no images, no buttons. It should read like an email from real people, not a newsletter.

## Rules for every email
- Max **1 lifecycle email per owner per day**. If two are due on the same day, send the more important one (order: 4 > 5 > 2 > 1 > 3 > 8 > 6 > 7).
- **Emails 1–5 (trial sequence)** follow their send windows below. They are NOT subject to the 7-day cap.
- **Emails 6–8**: max 1 per owner per 7 days, and never within 7 days of any other lifecycle email.
- "Paying" = subscription_status 'active' (with or without Stripe, so comped accounts count) or a Stripe subscription that is active/trialing. Paying owners never get emails 2–5.
- Emails 2–5 only go to owners who never subscribed (no Stripe subscription, status empty or 'trial'). Past-due and cancelled owners get none of them.
- "Paid since" (emails 6–7) = the Stripe subscription's start date. Comped accounts use their trial end date.
- "Login" (email 8) = the later of the dashboard login log and the owner's last sign-in.

### Send windows (day N = whole days since signup)
| Email | Window | If missed |
|---|---|---|
| 1 | First cron run after signup, up to 36 hours | Skip for good |
| 2 | Days 2–4 | Skip for good |
| 3 | Days 7–9 | Skip for good |
| 4 | 3 to 1 days before trial end | Skip for good |
| 5 | 2 to 7 days after trial end | Skip for good |
| 6 | Every 30 days for paying owners | Next month |
| 7 | Once, between 30 and 60 days of paying, with a booking in the last 30 days | Not sent (older customers are asked by hand) |
| 8 | 14+ days with no new bookings and no login; max once per 60 days | Next eligible day |

Older accounts outside these windows get nothing on go-live (handled by hand).
- Skip demo, staging and test salons.
- Every email ends with the footer below.
- No incentives for reviews (Google forbids it), and ask everyone neutrally (no "only if you're happy").

### Placeholders
{first_name} {salon_name} {booking_link} {dashboard_link} {trial_end_date} {subscribe_link} {google_review_link} {unsubscribe_link} {staff_label}

{staff_label} is the dashboard's name for the staff page for that business type (e.g. Stylists, Barbers, Trainers, Team).

If {first_name} is empty, use "Hi there", and drop ", {first_name}" from the subjects of emails 1, 3 and 7 (e.g. "Welcome to Feature").

### Footer (all emails)
—
Feature · FEATURES TECH LTD · 71-75 Shelton Street, London WC2H 9JQ
Registered in England and Wales, company no. 17288184
You're getting this because you have a Feature account. Don't want these emails? Unsubscribe: {unsubscribe_link}

---

## 1. Welcome
When: right after signup. Who: everyone.
Subject: Welcome to Feature, {first_name}

Hi {first_name},

Thanks for signing up to Feature. We're really glad to have {salon_name} on board.

Three things get you taking bookings:

1. Check your services and prices (we've added a few examples to get you started)
2. Add your team, even if it's just you (Dashboard → {staff_label})
3. Share your booking link: {booking_link}

(Salons that start with no services — business type "Other", or created by an admin — get this step 1 instead: "Add your services and prices (Dashboard → Services)".)

Most owners are done in about 15 minutes. Put the link in your Instagram bio and you're live.

If anything's confusing, just reply to this email. A real person reads every message.

The Feature Team

---

## 2. Setup help
When: day 2 after signup. Who: owners with no services, or only the untouched sample services we add at signup (every service still matches a sample's name, price and length).
Subject: Can we help you set up {salon_name}?

Hi {first_name},

We noticed {salon_name} is still showing our sample services, so your booking page isn't really yours yet.

(Salons with no services at all get this first line instead: "We noticed {salon_name} doesn't have any services on it yet, so your booking page is still empty.")

No pressure. Setting up a new system is a faff when you're busy with clients all day.

Adding your services takes a few minutes: go to Dashboard → Services, add each service with its price and length, and you're ready to share your link.

If you get stuck on anything, or something got in the way, reply and tell us. We'll help you through it.

The Feature Team

---

## 3. One-week check-in
When: day 7 after signup. Who: owners still on trial.
Subject: Quick one, {first_name}

Hi {first_name},

You've had Feature for a week now, so we wanted to check in.

Is anything not working the way you expected, or is something missing that you need? Even small things are useful to hear about. It's often a quick fix on our side.

Just hit reply. A one-line answer is perfect.

The Feature Team

---

## 4. Trial ending soon
When: 3 days before trial_ends_at. Who: trial owners who haven't subscribed.
Subject: Your Feature trial ends on {trial_end_date}

Hi {first_name},

Just a heads-up: your free trial for {salon_name} ends on {trial_end_date}.

If you'd like to keep taking bookings, you can choose a plan here:
{subscribe_link}

Plans start at £29 a month. That's one flat fee, with no commission on any booking. You can cancel any time.

If you're not sure Feature is right for you, or something's holding you back, reply and tell us. We'd rather hear it than lose you without knowing why.

The Feature Team

---

## 5. Trial ended
When: 2 days after trial_ends_at. Who: owners whose trial ended without subscribing.
Subject: What could we have done better?

Hi {first_name},

Your Feature trial for {salon_name} has now ended, and you didn't go ahead with a plan. That's completely fine.

Could we ask one favour? Reply with the main reason. Was it the price, a missing feature, not enough time to set it up, or something else?

We're building Feature for owners like you, and every honest answer shapes what we build next.

If you'd like to pick up where you left off, your account is still here:
{subscribe_link}

Thanks for giving it a go.

The Feature Team

---

## 6. Monthly check-in
When: once a month. Who: paying customers.
Subject: How's Feature working for {salon_name}?

Hi {first_name},

Just our monthly check-in. How's Feature working for you?

If there's anything that's annoying you, slowing you down, or that you wish it did, reply and let us know. We read every reply, and a lot of what's been built so far came from owners telling us exactly this.

And if it's all running smoothly, that's great to hear too.

The Feature Team

---

## 7. Google review request
When: once, between 30 and 60 days of paying, with a booking in the last 30 days. Who: paying customers, never sent twice.
Subject: A small favour, {first_name}?

Hi {first_name},

You've been using Feature at {salon_name} for a month now. Thank you for trusting a small business with your bookings.

Feature is still early, and most salon owners find new software through reviews from other owners. If you have two minutes, would you share your honest experience on Google?

{google_review_link}

Good, bad or somewhere in between, all of it helps. And if something isn't right, we'd really like to hear it directly too. Just reply here.

The Feature Team

---

## 8. Gone quiet
When: 14 days with no new bookings and no dashboard login. Who: everyone (trial or paying), not more than once every 60 days.
Subject: Everything OK with {salon_name}?

Hi {first_name},

We noticed there hasn't been much activity on {salon_name} for the last couple of weeks, so we wanted to check you're all right.

If something stopped working, or Feature isn't fitting how you run things, reply and tell us. We'd much rather fix it than have you stuck.

If you're just on a quiet spell or a break, ignore this. Your booking page is still live:
{booking_link}

The Feature Team
