/**
 * ---------------------------------------------------------------------------
 * ATTENDANCE RULES — edit this file to change how percentages are calculated.
 * ---------------------------------------------------------------------------
 *
 * Colleges disagree about how LATE and EXCUSED should count, so the policy is
 * stated once here rather than being scattered through queries.
 *
 * Default policy:
 *   PRESENT  counts as attended
 *   LATE     counts as attended  (they turned up, just not on time)
 *   ABSENT   counts as NOT attended
 *   EXCUSED  excluded from the total entirely (medical leave, college event),
 *            so it neither helps nor harms the percentage
 *
 * percentage = attended / (all records - excused) * 100
 */

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

/** Statuses that count towards the numerator. */
export const COUNTS_AS_ATTENDED = ['PRESENT', 'LATE'];

/** Statuses removed from the denominator. */
export const EXCLUDED_FROM_TOTAL = ['EXCUSED'];

/** Display metadata, shared with the frontend via GET /api/config. */
export const STATUS_META = {
  PRESENT: { label: 'Present', short: 'P', tone: 'green' },
  ABSENT: { label: 'Absent', short: 'A', tone: 'rose' },
  LATE: { label: 'Late', short: 'L', tone: 'amber' },
  EXCUSED: { label: 'Excused', short: 'E', tone: 'slate' },
};

/**
 * Turn a list of attendance records into counts and a percentage.
 *
 * @param {{ status: string }[]} records
 * @returns {{ total: number, attended: number, excused: number, counted: number,
 *             percentage: number|null, breakdown: Record<string, number> }}
 *          `percentage` is null when nothing counts yet — that's different from
 *          0%, and the UI shows it as "—" rather than a scary red zero.
 */
export function summarise(records) {
  const breakdown = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const record of records) {
    breakdown[record.status] = (breakdown[record.status] ?? 0) + 1;
  }

  const total = records.length;
  const excused = EXCLUDED_FROM_TOTAL.reduce((sum, s) => sum + breakdown[s], 0);
  const counted = total - excused;
  const attended = COUNTS_AS_ATTENDED.reduce((sum, s) => sum + breakdown[s], 0);

  return {
    total,
    attended,
    excused,
    counted,
    percentage: counted === 0 ? null : round2((attended / counted) * 100),
    breakdown,
  };
}

/** Same as `summarise` but from pre-aggregated counts (used with groupBy). */
export function summariseCounts(breakdown) {
  const safe = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, ...breakdown };
  const total = Object.values(safe).reduce((a, b) => a + b, 0);
  const excused = EXCLUDED_FROM_TOTAL.reduce((sum, s) => sum + safe[s], 0);
  const counted = total - excused;
  const attended = COUNTS_AS_ATTENDED.reduce((sum, s) => sum + safe[s], 0);

  return {
    total,
    attended,
    excused,
    counted,
    percentage: counted === 0 ? null : round2((attended / counted) * 100),
    breakdown: safe,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
