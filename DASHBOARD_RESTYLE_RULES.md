# Dashboard Restyle Rules — Dark Navy/Gold → White/Purple

Reference doc for restyling the remaining dashboard page bodies. Established from the shell, home page, topbar, mobile nav, and shared-component passes already completed. Read this before touching a new page — it saves re-deriving the same decisions.

## Status

**Already restyled (do not re-touch unless a bug is found):**
- Shell: `Sidebar.tsx`, `DashboardShell.tsx` (topbar, layout, content background), `MobileNav.tsx`
- `globals.css`: `.ds-topbar*`, `.ds-notif-btn`, `.ds-avatar-chip`, `.ds-plan-badge`, `.ds-layout`/`.ds-content` backgrounds, `.mobile-nav-bar`/`.mnav-*`, `.skeleton` (both `!important` rules)
- `app/dashboard/page.tsx` (home page, including its custom Topbar)
- Page bodies: `calendar`, `payments`, `reports`, `tips`, `clients`, `staff` (**body only** — its `<Modal>` content left dark, see note), `waitlist`, `services`, `earnings`, `automations`, `broadcast`, `gallery`, `gift-cards` (its gift-card *visual* stays dark on purpose — see note), `invoices` (incl. its printable HTML template), `loyalty`, `partners`, `referrals`, `reviews`, `closed-dates`, `client-portal`, `clients/import`, `settings` (its Booking-Link hero card stays dark on purpose — see note)
- `app/dashboard/layout.tsx` — **loading state only** (light bg + purple spinner). Its `LockedOverlay` paywall is still dark/gold on purpose — see note below.
- Auth surfaces: `app/login/page.tsx`, `app/signup/page.tsx`
- Shared components: `SkeletonLoader.tsx`, `EmptyState.tsx`, `Modal.tsx` (**now fully light** — white panel, dark scrim; see note below), `ServiceModal.tsx`, `PushNotificationButton.tsx` (`app/components/`, not `app/dashboard/components/`), `StatCard.tsx`, `FeatureGate.tsx`
- `bookings/page.tsx` — **fully done**: its New Booking `<Modal>` was converted first, its body second. No longer split-theme.

**Every dashboard page body is now restyled.** What's left is cleanup and two deferred items:
- **Dead CSS in `globals.css`, safe to delete** — the 26 `.elite-*` rules (~lines 1124–1334). `bookings/page.tsx` was the last consumer and no longer references any of them; `.elite-bg` was never used by any page at all. Verify with `grep -rn "elite-" app | grep -v globals.css` (only a code comment should match) before deleting.
- **`.dk-badge*` (~1336–1347) is NOT dead and is a live readability problem.** `bookings/page.tsx`'s `StatusPill` (lines 19–29) still renders `dk-badge dk-badge-{green,indigo,red,amber,slate}`, and those rules are still dark-tuned: pale text (`#34D399`, `#FCD34D`, `#FCA5A5`, `#C4A8E0`, `#94A3B8`) on a ~0.12-alpha tint. That read fine on the old dark table; on the new **white** table it's roughly 2:1 contrast — the Status column is now the least readable thing on the page. Two ways to fix, both fine since bookings is the sole consumer: recolour the six `.dk-badge-*` rules in place (darken text per §2's contrast exception — `#059669`/`#B45309`/`#DC2626`/`#6D28D9`/`#6B6577`), or convert `StatusPill` to inline styles and then delete the rules. `.dk-badge-purple` is also still brand gold.
- `OnboardingChecklist.tsx`, `DashboardIcons.tsx` — unaudited, check when a page imports them
- `layout.tsx`'s `LockedOverlay` — see "deliberately left dark" below
**Deliberately left dark — do not "fix" without an explicit decision:**
- `layout.tsx`'s `LockedOverlay` (subscription paywall). Its hover colours are hardcoded *inside* `onMouseEnter`/`onMouseLeave` handler bodies, so recolouring means editing handler code on the highest-risk file in the app. Needs a scope decision first. (`Modal.tsx` was the other item here — it has since been converted to light.)

---

## 1. Colour map

| Element | Old (dark/gold) | New (light/purple) |
|---|---|---|
| Card/surface background | `#100F1C`, `#1C2438`, `#130F2A`, `linear-gradient(145deg,#100F1C,#130F2A)` | `#FFFFFF` |
| Card border | `rgba(255,255,255,0.05–0.08)`, `#2a3350` | `1px solid #ECE9F1` |
| Card shadow | `0 4px 24px rgba(0,0,0,0.3)` etc. | `0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)` |
| Page/section background | `#141A2E` | `#F5F3FF` (or leave `transparent` — `.ds-content` is already this colour) |
| Primary accent | gold `#C9A24B` | purple `#7C3AED` |
| Accent, dark/hover variant | gold `#E7C878` or `#A07A30` | `#6D28D9` |
| Accent, light tint (badges, active pills, hover fills) | `rgba(201,162,75,0.08–0.15)` | `#EDE9FF` or `rgba(124,58,237, same-alpha)` |
| Accent, softest tint (hover backgrounds, row stripes) | `rgba(255,255,255,0.02–0.05)` used as a subtle surface | `#F5F3FF` |
| Primary text | `#F7F5EF` | `#12101A` |
| Muted text | `rgba(255,255,255,0.4–0.55)`, `#aab1c4` | `#6B6577` |
| Faint/tertiary text | `rgba(255,255,255,0.22–0.35)` | `#9A94A8` |
| Input background | `rgba(255,255,255,0.04–0.06)`, dark surfaces | `#FFFFFF` or `#F5F3FF` |
| Input border | `rgba(255,255,255,0.07–0.1)` | `#ECE9F1` |
| Input focus | border `rgba(201,162,75,0.5)`, ring `rgba(201,162,75,0.12)` | border `#7C3AED`, ring `0 0 0 3px rgba(124,58,237,0.12)` |
| Placeholder | `rgba(255,255,255,0.2–0.45)` | `#9A94A8` |
| Primary button | `linear-gradient(135deg,#C9A24B,#0E1320)` or similar gold gradient | `linear-gradient(135deg,#7C3AED,#6D28D9)`, text `#fff`, shadow `rgba(124,58,237,0.30–0.45)` |
| Active tab/pill | bg `rgba(201,162,75,0.2–0.25)`, text `#C9A24B` | bg `#EDE9FF`, text `#6D28D9` |
| Toggle switch (off state, on a light card) | `#aab1c4` track | `#D6D1DE` track, white `#FFFFFF` thumb (keep green `#10B981` for the ON state — semantic) |
| Disabled/loading button fill | `#aab1c4` | `#D6D1DE` (same token as the off-toggle track) |
| Destructive-hover text tuned for dark bg | `#FCA5A5` | `#DC2626` (see semantic note below — this is a contrast fix, not a hue change) |

**Hex-alpha-suffix pattern** (`${color}18`, `${color}33`, etc. — seen in `MiniStat`, `QuickAction`): when the base `color` variable itself is being changed from gold to purple, leave this suffix pattern structurally alone — just changing the source hex is enough, the tints derive automatically. Don't refactor these into `rgba()`.

## 2. Semantic colours — NEVER repaint purple

These convey status, not brand, and stay exactly as they are on every page:
- **Green** `#10B981` / `#34D399` — revenue, confirmed status, active/success states, "on" toggle tracks.
- **Red** `#EF4444` / `#DC2626` — cancel, delete, error, overdue/expired.
- **Amber** `#F59E0B` — pending, past-due warnings.

**Contrast exception, not a hue change:** if a semantic colour was tuned for a dark background and is now unreadable on white (most often a pale red like `#FCA5A5` used as text), darken it to a same-hue value with better contrast (`#DC2626`) — the colour family stays the same, only the shade shifts for legibility. Established precedent: signup page error banner, dashboard table cancel/delete icons, and the login page's three status banners (`#34D399`→`#059669` green, `#FCD34D`→`#B45309` amber, `#F87171`→`#DC2626` red).

**Intentionally-dark visual objects stay dark.** Some surfaces are *depictions of a thing*, not dashboard chrome, and their white-on-dark text is correct by design. Convert the surrounding page but leave the object — brand-align its gradient if it was gold/indigo, keeping it dark so its white text stays readable. Precedent: the gift-card graphic in `gift-cards/page.tsx` (kept dark, gradient rebranded `#1E1B4B,#3730A3` → `#5B21B6,#7C3AED`, its 9 white-text values untouched). Same reasoning protects white overlays sitting on top of photos (`gallery/page.tsx` lightbox and thumbnail buttons at `rgba(255,255,255,0.9/0.2)`).

**Two ways to escape a shared class — pick by whether pseudo-states are involved.** Inline styles cannot express `:hover`, `:focus`, `::placeholder`, or descendant selectors (`th`/`td`). So: simple classes (a topbar, a card shell, a flex container) → **inline**; classes with pseudo-state or descendant rules → **a page-local `<style>` block** with a page-prefixed name (`bk-*` in `bookings`). The page-local route has a second benefit: an active-state class toggle like `` className={`elite-tab${view === v ? " active" : ""}`} `` becomes `` `bk-tab${…}` `` — the *condition stays byte-identical*, where converting to an inline style ternary would mean rewriting it. Precedent: `bookings/page.tsx` converted `elite-topbar`/`elite-tabs`/`elite-table-wrap` inline, and `elite-tab`/`elite-input`/`elite-btn-primary`/`elite-btn-ghost`/`elite-table` to `bk-*` page-local rules.

**Escaping a shared `.elite-*` class without touching `globals.css`:** replace the `className` with the equivalent inline style on that page only. Precedent: `settings/page.tsx`'s `elite-topbar` → `{ background:"#FFFFFF", borderBottom:"1px solid #ECE9F1", padding:"0 20px", minHeight:60, … }`. Two things the class supplied are lost and must be re-thought: `html.gpu-capable`'s `backdrop-filter: blur(18px)` (cosmetic, and Wave-1 perf gated it anyway) and the `@media (max-width:767px)` wrap rule — use `minHeight` rather than a fixed `height` so a wrapped second line isn't clipped.

**Bulk find-replace will over-convert dark hero cards.** A page can contain a deliberately dark gradient card whose text is white by design. A blanket map turns its text into light-theme greys → grey-on-dark, unreadable. `settings`' Booking-Link card (`linear-gradient(135deg,#0F0B2D,#3730A3,#C9A24B)`) hit exactly this: the fix is to keep the card dark, swap only the gold stop to `#7C3AED`, and restore its `rgba(255,255,255,·)` text and translucent buttons. **After any bulk convert, audit for both directions** — white text on a light background *and* dark text on a dark one.

**Generated HTML strings count as surfaces too.** `invoices/page.tsx` builds a printable invoice via `w.document.write(...)` with its own `<style>` block. It had `body{color:#F7F5EF}` — near-white text that printed invisibly on white paper. Restyling a page means grepping its template literals, not just its JSX.

**A page's own thematic accent is not brand gold either.** Where a page's primary CTA is coloured to match its subject rather than the brand — amber "+ Add to Waitlist", green "+ Record Tip" — leave it; only actual gold `#C9A24B` becomes purple. Precedent: `waitlist/page.tsx`, `tips/page.tsx`.

**Medal/podium colours are not brand gold.** A gold/silver/bronze triple like `["#F59E0B","#94A3B8","#CD7F32"]` paired with 🥇🥈🥉 conveys rank, not brand — leave it. Only a brand-gold *fallback* next to it (e.g. `COLS[i] || "#C9A24B"`) becomes purple. Precedent: `tips/page.tsx` staff leaderboard.

**One live inconsistency to know about, not fix silently:** the subscription-card status badge (`app/dashboard/page.tsx` ~line 624) is hardcoded purple regardless of actual `subStatus`, while the "Manage Subscription" button below it was deliberately changed (per explicit instruction) to always be purple too, ignoring `SUB_STATUS_MAP`. If a page has a similar "badge that's supposed to reflect live status but doesn't," flag it — don't silently make it dynamic (that's a logic change) and don't silently leave it inconsistent without saying so.

## 3. Safety rules

- **Change ONLY colours/styling**: inline `style={{}}` objects, `className`-targeted CSS, colocated `<style>` blocks. **Never touch**: Supabase queries (`.from()/.select()/.insert()/.update()/.delete()`), `useState`/`useEffect`/`useMemo`/`useCallback`, event handlers (`onClick`/`onSubmit`/`onChange`), form logic, conditions/ternaries that gate behaviour, data expressions, routing (`router.push`, `<Link href>`).
- **Do not change the *values* of `--dk-*` / `--text-*` / `--slate-*` / `--indigo*` CSS custom properties** — several pages consume these tokens directly (confirmed: `clients`, `clients/import`, `payments`, `staff`, `partners`, `services`). If a rule you're editing *references* one of these tokens (`var(--dk-bg)` etc.), replace the reference with a literal light value **on that selector only** — leave the token's definition in `:root`/`.ds-layout` untouched.
- **`globals.css` `!important` rules win the cascade.** Before assuming a component-level style edit will show up, `grep` the class name in `globals.css`. If there's a matching `!important` rule, edit both places with the same value or the component edit will visibly do nothing. This has bitten every restyle pass so far (topbar, mobile nav, skeleton) — assume it'll happen again.
- **Check for shared components the page imports**, not just the page file itself. The "gold Create Offer button" bug on the home page turned out to live in `EmptyState.tsx`, not `page.tsx` — the page file looked clean on a direct read. Grep the page's imports (`from "./components/..."` / `from "../components/..."` / `from "@/app/components/..."`) and check each one for dark/gold literals before declaring a page done.
- **`replace_all` can silently miss occurrences** that differ only in whitespace, indentation, or a trailing comma — this happened in `SkeletonLoader.tsx` where three structurally-identical card containers had two different indentation levels. After any `replace_all` edit, re-grep for the old value to confirm zero remain; don't trust the tool's success message alone.
- **Emoji icons ignore CSS `color` entirely** — a coloured emoji (🔒, 👁, gold-tinted glyphs, etc.) cannot be recoloured via `style`. If a page has an emoji that needs to become purple/grey to match the theme, it must be replaced with an inline SVG (small `<svg>` with `stroke`/`fill`) — flag this to the user rather than trying to force a CSS fix that won't work, or leaving it silently unrecoloured.
- **Data-conditional styling stays wired to its condition, only its *colour values* change.** Example: the staff-avatar palette `const colors = [...]` array (`page.tsx`) is indexed by `s.name.charCodeAt(0) % colors.length` — recolour the five hex values, never touch the indexing expression. Same pattern applies to any `status === X ? colorA : colorB` ternary: change `colorA`/`colorB`, never the condition.
- **`Modal.tsx` portals to `document.body`, so it sits OUTSIDE `.ds-layout`.** Every `var(--slate-*)` / `var(--indigo)` / `var(--text-*)` used *inside* a `<Modal>` therefore resolves to the `:root` LIGHT value, not the dark `.ds-layout` override — the opposite of what the same token does in the page body. Now that the modal panel is white this works *in your favour* for text tokens (they resolve dark), but `var(--indigo)` inside a modal is still the stale blue-indigo `#6366F1` rather than brand purple. **Use literal colours inside modal content, never tokens** — that's the only way to get a predictable result on both sides of the portal boundary. `Modal.tsx` itself is now fully literal for this reason.
- **A third, older palette exists on some pages** — blue-slate (`#1E293B` text, `#475569`/`#64748B` muted, `#94A3B8` faint, `#CBD5E1`/`#E2E8F0`/`#E8EAF0` borders, `#F8FAFC` surface). It predates the navy/gold rebrand, so a page can look "already light" while still clashing with the purple system. Map it to the §1 destinations (`#12101A` / `#6B6577` / `#9A94A8` / `#ECE9F1` / `#F5F3FF`, `#CBD5E1`→`#D6D1DE` since it doubles as a disabled tone). Precedent: `services/page.tsx`.
- **`Modal.tsx` is now a LIGHT shell** (white `#FFFFFF` panel, `#ECE9F1` border, dark translucent `rgba(18,16,26,0.5)` scrim). Its exported primitives — `FormGroup`, `Input`, `Select`, `BtnPrimary`, `BtnSecondary` — are light too. **This inverts the old rule:** modal content should now be styled *dark-on-light*, same as a page body. Any caller still using light-on-dark literals (`#F7F5EF`, `rgba(255,255,255,0.4–0.7)`) inside a `<Modal>` will render near-invisible on white and must be converted. Callers that use `var(--text-*)` tokens are already correct — because Modal portals to `document.body` (outside `.ds-layout`) those resolve to the `:root` light values, i.e. dark text.
  - **All callers converted.** `components/ServiceModal.tsx` (Add/Edit Service) and `bookings/page.tsx` (New Booking modal only — lines ~460–781) are now dark-on-light. `staff/page.tsx` and `partners/page.tsx` were already correct via `var(--text-*)` tokens.
  - **`bookings/page.tsx` is split-theme on purpose:** its `<Modal>` block is light, its `.elite-*` page body is still dark, pending the `.elite-*` decision. When restyling that body, edit only *outside* the `<Modal>` — and re-check the boundary line numbers first, since they shift. The gold/dark literals (`#C9A24B`, `#2a3350`, `#F7F5EF`, `#0E1320`) appear on **both** sides, so a `replace_all` on this file will corrupt one side or the other. Use a line-bounded edit and verify with `diff` that the untouched range is byte-identical.
- **Keep animations/keyframes/timing untouched** — `transition`, `animation`, `@keyframes` durations and easing curves are not colours. Only touch `background`, `color`, `border`, `box-shadow`, `fill`/`stroke` values within them.
- **The `.elite-*` system** (`bookings.tsx`, `settings.tsx`) is a second, separate glassmorphic dark theme defined in `globals.css` (~1120-1339), distinct from the plain-inline-style pattern every other page uses. Restyling these two pages means also deciding whether to convert `.elite-*` to light or replace its usage with the plain white-card pattern — flag this as a bigger decision before starting either page, don't treat it as a drop-in colour swap like the other 21 pages.

## 4. Process, per page

1. **Read the full page file.** Don't rely on memory from a prior recon — verify current state fresh (files can drift across a long session).
2. **Grep its imports** for shared components not yet restyled; read and fix those first if they're not covered by the "already restyled" list above.
3. **Map every dark/gold literal** found to the table in §1. Leave every match from §2 (semantic) untouched, applying the contrast-exception note where relevant.
4. **Apply edits** — colours/styling only, per the safety rules in §3.
5. **Verify:**
   - `npx tsc --noEmit -p .` — no new errors in the file(s) touched.
   - `grep` every handler/query/state name used on the page, before and after — identical counts.
   - `git diff --numstat` on the touched file(s) — insertions and deletions should be equal (or explainably close, if the file had pre-existing unrelated uncommitted changes before this session). A skewed ratio is a signal something structural changed, not just colours.
   - Re-grep for the old dark/gold hex values in the touched file(s) — zero remaining, except intentionally-left dark contexts (e.g. `Modal.tsx` content).
   - Confirm the dev server compiles the route with no console errors.
6. **Report**: exactly what changed, any judgment calls made (and why), anything flagged per §3 (emoji-needs-SVG, shared component also touched, `.elite-*` decision needed, etc.), and explicit confirmation that zero logic/handlers/queries were touched.
