/**
 * Validation schemas for assignments and submissions.
 *
 * Note these bodies arrive as multipart/form-data (because of the file
 * upload), so every value is a STRING. `z.coerce` converts numbers and dates.
 */
import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

export const idParam = z.object({ id: z.string().min(1) });

/** Empty strings from form fields mean "not provided". */
const optionalText = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

/**
 * A due date and time. Accepts a full ISO string or the
 * "YYYY-MM-DDTHH:mm" value produced by <input type="datetime-local">.
 */
const dueDate = z.coerce
  .date({ errorMap: () => ({ message: 'Enter a valid due date.' }) })
  .refine((d) => !Number.isNaN(d.getTime()), 'Enter a valid due date.');

export const createAssignmentSchema = z.object({
  subjectId: z.string().min(1, 'Choose a subject.'),
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  description: optionalText(z.string().trim().max(5000)),
  dueDate,
  maxMarks: z.coerce
    .number({ errorMap: () => ({ message: 'Enter the maximum marks.' }) })
    .int('Maximum marks must be a whole number.')
    .min(1, 'Maximum marks must be at least 1.')
    .max(1000),
});

export const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalText(z.string().trim().max(5000)),
    dueDate: dueDate.optional(),
    maxMarks: z.coerce.number().int().min(1).max(1000).optional(),
    /** Send "true" to delete the current attachment. */
    removeFile: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

/** Teacher/admin listing. */
export const listAssignmentsQuery = z.object({
  ...paginationQuery,
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
});

/** Student/parent listing, filterable by the derived status. */
export const myAssignmentsQuery = z.object({
  status: z.enum(['ALL', 'PENDING', 'SUBMITTED', 'GRADED', 'OVERDUE']).default('ALL'),
  subjectId: z.string().min(1).optional(),
  /** Parents pass the child they are viewing. */
  studentId: z.string().min(1).optional(),
});

/* -------------------------------------------------------------------------- */
/* Grading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A real boolean, or the strings a form/query sends.
 *
 * NOT `z.coerce.boolean()`: that uses JavaScript truthiness, so the string
 * "false" would come through as `true` — which here would mean accidentally
 * publishing grades the teacher asked to keep hidden.
 */
const boolish = z.union([
  z.boolean(),
  z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1'),
]);

export const gradeSubmissionSchema = z.object({
  /**
   * Marks awarded. An empty value clears a grade entered by mistake, so ''
   * becomes null rather than being coerced to 0.
   */
  marksObtained: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v === null ? null : v),
    z.union([z.coerce.number().min(0, 'Marks cannot be negative.'), z.null()]).optional()
  ),
  feedback: optionalText(z.string().trim().max(2000)),
  /** Marks stay hidden from student and parent until this is true. */
  isPublished: boolish.optional(),
});

export const publishAllSchema = z.object({
  isPublished: boolish.default(true),
});

export const submissionIdParam = z.object({ submissionId: z.string().min(1) });
export const studentIdParam = z.object({ studentId: z.string().min(1) });
