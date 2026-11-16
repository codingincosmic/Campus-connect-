/** Validation schemas for user management (admin only). */
import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';
import { passwordRule } from '../auth/auth.schemas.js';

export const ROLES = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

export const idParam = z.object({ id: z.string().min(1) });

export const childParam = z.object({
  id: z.string().min(1),
  studentId: z.string().min(1),
});

/** Emails are stored lowercase so lookups are reliably case-insensitive. */
const email = z
  .string()
  .trim()
  .min(1, 'Enter an email address.')
  .max(255)
  .email('Enter a valid email address.')
  .transform((v) => v.toLowerCase());

/** Usernames: letters, numbers, dot, underscore, hyphen. Lowercased. */
const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use only letters, numbers, dots, underscores or hyphens.')
  .transform((v) => v.toLowerCase());

/** Treat an empty string from a form field as "not provided". */
const optionalText = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name.').max(120),
    email,
    username: optionalText(username),
    role: z.enum(ROLES, { errorMap: () => ({ message: 'Choose a role.' }) }),
    rollNo: optionalText(z.string().trim().max(30)),
    phone: optionalText(z.string().trim().max(20)),
    /**
     * Optional. When omitted the server generates a temporary password and
     * returns it once, so the admin can hand it to the user.
     */
    password: optionalText(passwordRule),
    /** Optionally enroll a new student straight into a class. */
    classId: optionalText(z.string().min(1)),
    /** Optionally link a new parent to students immediately. */
    childIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    // A roll number is how students are identified day to day.
    if (data.role === 'STUDENT' && !data.rollNo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rollNo'],
        message: 'A roll number is required for student accounts.',
      });
    }
    // These extras only make sense for the matching role.
    if (data.classId && data.role !== 'STUDENT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classId'],
        message: 'Only student accounts can be enrolled in a class.',
      });
    }
    if (data.childIds?.length && data.role !== 'PARENT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['childIds'],
        message: 'Only parent accounts can be linked to students.',
      });
    }
  });

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: email.optional(),
    username: optionalText(username),
    rollNo: optionalText(z.string().trim().max(30)),
    phone: optionalText(z.string().trim().max(20)),
    isActive: z.boolean().optional(),
  })
  // Role changes are deliberately not supported: a student who became a teacher
  // would carry attendance records and submissions into the wrong role.
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listUsersQuery = z.object({
  ...paginationQuery,
  role: z.enum(ROLES).optional(),
  search: z.string().trim().max(80).optional(),
  /** Only students enrolled in this class. */
  classId: z.string().min(1).optional(),
  /** Only students NOT enrolled in this class — powers the "add students" picker. */
  notInClassId: z.string().min(1).optional(),
  /** 'true' / 'false' from the query string. */
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const resetPasswordSchema = z
  .object({
    /** Omit to have the server generate a temporary password. */
    newPassword: optionalText(passwordRule),
  })
  .default({});

export const linkChildrenSchema = z.object({
  studentIds: z
    .array(z.string().min(1))
    .min(1, 'Select at least one student.')
    .max(20, 'Link at most 20 students at a time.'),
  relationship: optionalText(z.string().trim().max(30)),
});
