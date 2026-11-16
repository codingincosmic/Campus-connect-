/**
 * ---------------------------------------------------------------------------
 * GRADING CONFIGURATION  —  edit this file to change your college's scheme.
 * ---------------------------------------------------------------------------
 *
 * The results module converts a mark into:
 *
 *   marks -> percentage -> letter grade -> grade point
 *
 * and then combines grade points with subject credits to produce
 * SGPA (per semester) and CGPA (overall) on a 10-point scale.
 *
 * Bands are checked from the top down, so keep them in descending order.
 */

/** @typedef {{ min: number, grade: string, point: number, label: string }} GradeBand */

/** @type {GradeBand[]} */
export const GRADE_BANDS = [
  { min: 90, grade: 'A+', point: 10, label: 'Outstanding' },
  { min: 80, grade: 'A', point: 9, label: 'Excellent' },
  { min: 70, grade: 'B+', point: 8, label: 'Very Good' },
  { min: 60, grade: 'B', point: 7, label: 'Good' },
  { min: 50, grade: 'C', point: 6, label: 'Average' },
  { min: 40, grade: 'D', point: 5, label: 'Pass' },
  { min: 0, grade: 'F', point: 0, label: 'Fail' },
];

/** Minimum percentage required to pass a subject. */
export const PASS_PERCENTAGE = 40;

/** Maximum grade point, i.e. the GPA scale (10-point here). */
export const GPA_SCALE = 10;

/**
 * Map a percentage (0-100) to its grade band.
 * @param {number} percentage
 * @returns {GradeBand}
 */
export function bandForPercentage(percentage) {
  const pct = Number.isFinite(percentage) ? percentage : 0;
  // Bands are ordered high -> low, so the first match is the right one.
  return GRADE_BANDS.find((band) => pct >= band.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
}

/**
 * Convert raw marks into a full grade description.
 * @param {number} marksObtained
 * @param {number} maxMarks
 */
export function gradeFromMarks(marksObtained, maxMarks) {
  if (!maxMarks || maxMarks <= 0) {
    return { percentage: 0, ...bandForPercentage(0), passed: false };
  }
  const percentage = round2((marksObtained / maxMarks) * 100);
  const band = bandForPercentage(percentage);
  return { percentage, ...band, passed: percentage >= PASS_PERCENTAGE };
}

/**
 * Credit-weighted GPA:  sum(gradePoint * credits) / sum(credits)
 *
 * @param {{ point: number, credits: number }[]} entries
 * @returns {number|null} null when there is nothing to average yet
 */
export function weightedGpa(entries) {
  const usable = entries.filter((e) => Number.isFinite(e.point) && e.credits > 0);
  if (usable.length === 0) return null;

  const totalCredits = usable.reduce((sum, e) => sum + e.credits, 0);
  if (totalCredits === 0) return null;

  const totalPoints = usable.reduce((sum, e) => sum + e.point * e.credits, 0);
  return round2(totalPoints / totalCredits);
}

/** Round to 2 decimal places without floating-point noise. */
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
