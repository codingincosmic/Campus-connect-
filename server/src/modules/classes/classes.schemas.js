/** Validation schemas for classes, subjects and enrollment. */
import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

const trimmed = (max) => z.string().trim().min(1).max(max);

/** "2025-26" or "2025-2026" — a small guard against typos like "2025". */
const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2,4}$/, 'Use a format like 2025-26.');

export const idParam = z.object({ id: z.string().min(1) });

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

export const createClassSchema = z.object({
  name: trimmed(80).describe('e.g. "BCA Year 2"'),
  section: trimmed(10).describe('e.g. "A"'),
  academicYear,
  semester: z.coerce.number().int().min(1).max(12).default(1),
});

/** Every field optional — PATCH only changes what you send. */
export const updateClassSchema = createClassSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update.' }
);

export const listClassesQuery = z.object({
  academicYear: z.string().trim().optional(),
  /** Free-text match on class name or section. */
  search: z.string().trim().max(80).optional(),
});

/* -------------------------------------------------------------------------- */
/* Subjects                                                                   */
/* -------------------------------------------------------------------------- */

export const createSubjectSchema = z.object({
  classId: z.string().min(1, 'Choose a class.'),
  name: trimmed(100),
  code: z.string().trim().max(20).optional().or(z.literal('').transform(() => undefined)),
  /** Credits weight the SGPA/CGPA calculation. */
  credits: z.coerce.number().int().min(1).max(12).default(3),
  /** Optional: a subject can exist before a teacher is assigned. */
  teacherId: z.string().min(1).nullish(),
});

export const updateSubjectSchema = createSubjectSchema
  .omit({ classId: true }) // moving a subject between classes is not supported
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listSubjectsQuery = z.object({
  classId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
});

/* -------------------------------------------------------------------------- */
/* Enrollment                                                                 */
/* -------------------------------------------------------------------------- */

export const enrollStudentsSchema = z.object({
  studentIds: z
    .array(z.string().min(1))
    .min(1, 'Select at least one student.')
    .max(200, 'Enroll at most 200 students at a time.'),
});

export const classStudentsQuery = z.object({
  ...paginationQuery,
  search: z.string().trim().max(80).optional(),
});

export const studentIdParam = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
});
