/** Validation schemas for the attendance module. */
import { z } from 'zod';
import { ATTENDANCE_STATUSES } from '../../config/attendance.js';
import { parseDateOnly } from '../../lib/dates.js';

/**
 * A calendar date as "YYYY-MM-DD", transformed into a Date at midnight UTC so
 * controllers never deal with timezone-sensitive strings.
 */
const dateOnly = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const parsed = parseDateOnly(value);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a valid date (YYYY-MM-DD).' });
      return z.NEVER;
    }
    return parsed;
  });

const status = z.enum(ATTENDANCE_STATUSES, {
  errorMap: () => ({ message: `Status must be one of: ${ATTENDANCE_STATUSES.join(', ')}.` }),
});

const periodNo = z.coerce.number().int().min(1).max(12).default(1);

export const idParam = z.object({ id: z.string().min(1) });
export const studentIdParam = z.object({ studentId: z.string().min(1) });

/* -------------------------------------------------------------------------- */
/* Marking                                                                    */
/* -------------------------------------------------------------------------- */

/** GET /attendance/sheet — the roster plus any marks already saved. */
export const sheetQuery = z.object({
  subjectId: z.string().min(1, 'Choose a subject.'),
  date: dateOnly,
  periodNo,
});

/**
 * POST /attendance/mark — save the whole sheet in one request.
 *
 * `editReason` is required only when overwriting existing records; the service
 * enforces that, because whether it's an edit depends on the database.
 */
export const markAttendanceSchema = z.object({
  subjectId: z.string().min(1, 'Choose a subject.'),
  date: dateOnly,
  periodNo,
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status,
      })
    )
    .min(1, 'Mark at least one student.')
    .max(300),
  editReason: z
    .string()
    .trim()
    .max(300, 'Keep the reason under 300 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

/* -------------------------------------------------------------------------- */
/* Viewing                                                                    */
/* -------------------------------------------------------------------------- */

/** Optional from/to range, defaulting to "everything". */
const dateRange = {
  from: dateOnly.optional(),
  to: dateOnly.optional(),
};

/** GET /attendance/student/:studentId — one student's full picture. */
export const studentAttendanceQuery = z.object({
  ...dateRange,
  subjectId: z.string().min(1).optional(),
});

/** GET /attendance/report — per-student stats for a subject or a whole class. */
export const reportQuery = z
  .object({
    ...dateRange,
    subjectId: z.string().min(1).optional(),
    classId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.subjectId || data.classId), {
    message: 'Provide either a subjectId or a classId.',
    path: ['subjectId'],
  });

/** GET /attendance/defaulters — students below the threshold. */
export const defaultersQuery = z.object({
  ...dateRange,
  classId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  /** Override the college-wide threshold for a one-off report. */
  threshold: z.coerce.number().min(0).max(100).optional(),
});
