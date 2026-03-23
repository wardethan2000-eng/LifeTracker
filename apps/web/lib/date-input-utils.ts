/**
 * Timezone-aware date input utilities.
 *
 * All functions convert between UTC ISO strings (as stored in the DB) and
 * the HTML date/datetime-local input formats (YYYY-MM-DD / YYYY-MM-DDTHH:MM),
 * interpreting dates relative to the household's canonical timezone rather
 * than the browser's local timezone.
 */

/**
 * Extract the calendar date in the given timezone from a UTC ISO string.
 * Returns a "YYYY-MM-DD" string suitable for <input type="date">.
 * Falls back to UTC slice if parsing fails.
 */
export function toHouseholdDateInputValue(
  isoString: string | null | undefined,
  timezone: string
): string {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(isoString));
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Convert a "YYYY-MM-DD" date string (interpreted as start-of-day in the
 * given timezone) to a UTC ISO string.
 * Returns null for empty input.
 */
export function fromHouseholdDateInput(
  dateString: string,
  timezone: string
): string | null {
  if (!dateString) return null;

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const y = Number(yearStr);
  const m = Number(monthStr);
  const d = Number(dayStr);

  if (!y || !m || !d) return null;

  // Use noon UTC on this calendar date to compute the timezone's UTC offset
  // without hitting DST edge cases that can occur at midnight.
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(noonUtc);

  const p = Object.fromEntries(
    parts.filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)])
  ) as Record<string, number>;

  // The local "noon" expressed as a naive UTC timestamp
  const localNoonMs = Date.UTC(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!);
  // UTC offset: positive means the timezone is behind UTC
  const offsetMs = noonUtc.getTime() - localNoonMs;

  // Midnight local = midnight UTC + offset
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMs).toISOString();
}

/**
 * Extract a "YYYY-MM-DDTHH:MM" local datetime string (in the given timezone)
 * from a UTC ISO string. Suitable for <input type="datetime-local">.
 */
export function toHouseholdDateTimeInputValue(
  isoString: string | null | undefined,
  timezone: string
): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);

    const p = Object.fromEntries(
      parts.filter((x) => x.type !== "literal").map((x) => [x.type, x.value])
    );

    // en-CA format: "YYYY-MM-DD, HH:MM" — we combine the pieces explicitly
    return `${p["year"]!}-${p["month"]!}-${p["day"]!}T${p["hour"]!}:${p["minute"]!}`;
  } catch {
    return isoString.slice(0, 16);
  }
}

/**
 * Convert a "YYYY-MM-DDTHH:MM" datetime-local input value (interpreted in the
 * given timezone) to a UTC ISO string.
 * Returns null for empty input.
 */
export function fromHouseholdDateTimeInput(
  datetimeString: string,
  timezone: string
): string | null {
  if (!datetimeString) return null;

  const [datePart, timePart] = datetimeString.split("T");
  if (!datePart || !timePart) return null;

  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const [hourStr, minuteStr] = timePart.split(":");

  const y = Number(yearStr);
  const m = Number(monthStr);
  const d = Number(dayStr);
  const h = Number(hourStr ?? "0");
  const min = Number(minuteStr ?? "0");

  if (!y || !m || !d) return null;

  // Use noon UTC as an offset reference (avoids DST edge cases at midnight)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(noonUtc);

  const p = Object.fromEntries(
    parts.filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)])
  ) as Record<string, number>;

  const localNoonMs = Date.UTC(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!);
  const offsetMs = noonUtc.getTime() - localNoonMs;

  return new Date(Date.UTC(y, m - 1, d, h, min) + offsetMs).toISOString();
}

/**
 * Compute the start-of-day UTC timestamp for a "YYYY-MM-DD" string in a
 * given timezone. Equivalent to fromHouseholdDateInput but always returns
 * a string (throws on invalid input so callers can handle gracefully).
 */
export function toIsoStartOfDayInTimezone(dateString: string, timezone: string): string {
  return fromHouseholdDateInput(dateString, timezone) ?? new Date(`${dateString}T00:00:00.000Z`).toISOString();
}

/**
 * Compute the end-of-day UTC timestamp for a "YYYY-MM-DD" string in a
 * given timezone.
 */
export function toIsoEndOfDayInTimezone(dateString: string, timezone: string): string {
  const start = fromHouseholdDateInput(dateString, timezone);
  if (!start) return new Date(`${dateString}T23:59:59.999Z`).toISOString();
  // end-of-day = start-of-day + 24h - 1ms
  return new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}
