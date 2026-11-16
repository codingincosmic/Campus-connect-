/**
 * Date helpers for calendar dates (no time component).
 *
 * Attendance is stored in a Postgres `date` column. Two separate concerns:
 *
 *   Storage  — every date is normalised to midnight UTC before it reaches the
 *              database, so "2026-08-15" is never saved as the 14th.
 *
 *   "Today"  — decided in the COLLEGE'S timezone, not the server's. A server
 *              running in UTC would otherwise still think it was yesterday
 *              until 05:30 IST, and would reject a teacher marking the
 *              morning's attendance as being "in the future".
 */
import { env } from '../config/env.js';

/**
 * Parse "YYYY-MM-DD" into a Date at exactly midnight UTC.
 * @param {string} value
 * @returns {Date|null} null when the string isn't a valid date
 */
export function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  // Rejects impossible dates that JS would otherwise roll over, e.g.
  // "2026-02-31" becoming 3 March.
  if (formatDateOnly(date) !== value) return null;

  return date;
}

/** Format a Date as "YYYY-MM-DD" using its UTC parts. */
export function formatDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Today's calendar date IN THE COLLEGE'S TIMEZONE, as a Date at midnight UTC.
 *
 * The 'en-CA' locale is used because it formats as YYYY-MM-DD, which is
 * exactly the shape parseDateOnly expects.
 *
 * @param {string} [timeZone] override, mainly for tests
 */
export function todayDateOnly(timeZone = env.timezone) {
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return parseDateOnly(local);
}

/**
 * Whole days between two calendar dates (later - earlier).
 * Both are midnight UTC, so this is exact — no daylight-saving surprises.
 */
export function daysBetween(earlier, later) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((new Date(later).getTime() - new Date(earlier).getTime()) / MS_PER_DAY);
}

/** Midnight UTC on the first day of the month containing `date`. */
export function startOfMonth(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** "2026-08" — used to group records into months. */
export function monthKey(date) {
  return formatDateOnly(date).slice(0, 7);
}
