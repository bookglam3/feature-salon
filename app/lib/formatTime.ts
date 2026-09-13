/**
 * Single source of truth for how a time is DISPLAYED to a user.
 *
 * Output format, everywhere: "1:00 PM"
 *   - 12-hour clock
 *   - no leading zero on the hour
 *   - uppercase AM/PM, no periods, single normal space before it
 *
 * DISPLAY ONLY. Nothing here may be fed back into parsing, comparison or
 * storage. Times are stored and compared as 24-hour "HH:MM" or as UTC
 * timestamps, and that must not change — see the exclusions below.
 *
 * Deliberately NOT converted by this module:
 *   - slot-availability.ts utcToSalonTime  — its "HH:MM" output feeds a
 *     lexical string comparison (`hours.start <= slotStart`). "1:00 PM"
 *     sorts before "09:00", which would silently corrupt availability.
 *   - slot-availability.ts addMinutesToSlot — parses "HH:MM" with
 *     split(":").map(Number); Number("00 PM") is NaN.
 *   - TIME_SLOTS, and the selTime / newTime state values — these are
 *     submitted to fromZonedTime(`${date}T${time}:00`). Render a label
 *     from them; never change the value itself.
 *   - staff.working_hours jsonb — 24h in storage and in comparisons.
 *
 * Timezone is passed through untouched. Callers keep whatever behaviour
 * they have today (several dashboard sites are browser-local, which is a
 * known separate bug); this module does not silently change any zone.
 */

/** Trailing am/pm in any of the forms ICU may emit. */
const AMPM_SUFFIX = /\s*([AaPp])\.?\s*([Mm])\.?\s*$/;

/**
 * ICU is inconsistent across Node and browser versions: en-GB yields a
 * lowercase "pm", and newer ICU inserts U+202F (narrow no-break space)
 * rather than a normal space. Normalise both so the rendered string is
 * byte-identical everywhere.
 */
function normaliseMeridiem(s: string): string {
  return s
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(AMPM_SUFFIX, (_m, a: string, m: string) => ` ${a.toUpperCase()}${m.toUpperCase()}`)
    .trim();
}

/**
 * Normalise the am/pm of an already-formatted string.
 *
 * For call sites that render date AND time in one toLocaleString call:
 * add `hour: "numeric", minute: "2-digit", hour12: true` to the options
 * they already have and wrap the result in this, so the date portion and
 * the timeZone stay exactly as they were.
 */
export function withMeridiem(formatted: string): string {
  return normaliseMeridiem(formatted);
}

/**
 * Format a Date or an ISO timestamp for display.
 *
 * @param timeZone pass the value the call site already uses. Omit it to
 *        keep browser-local behaviour — do not add a zone here to "fix"
 *        a site; that is a separate change.
 */
export function formatTimeDisplay(
  input: Date | string | number | null | undefined,
  opts: { timeZone?: string } = {},
): string {
  if (input === null || input === undefined || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  return normaliseMeridiem(
    d.toLocaleTimeString("en-GB", {
      hour: "numeric",       // "numeric" not "2-digit" — no leading zero
      minute: "2-digit",
      hour12: true,
      ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
    }),
  );
}

/**
 * Format a bare 24-hour wall-clock string ("13:00") as a label.
 *
 * Intentionally does NOT build a Date: a bare "HH:MM" has no date and no
 * zone, so constructing one would invent both and could shift the value.
 * This is pure string arithmetic.
 *
 * Returns the input unchanged if it isn't "H:MM"/"HH:MM", so a malformed
 * value can never throw inside the booking flow.
 */
export function formatWallClock(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;

  const h = Number(m[1]);
  const min = m[2];
  if (h < 0 || h > 23 || Number(min) > 59) return hhmm;

  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;   // 00:30 -> 12:30 AM, 12:00 -> 12:00 PM
  return `${h12}:${min} ${suffix}`;
}
