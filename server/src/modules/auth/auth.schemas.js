/**
 * Zod schemas describing the shape of auth request bodies.
 * These double as documentation for what each endpoint accepts.
 */
import { z } from 'zod';

/** Shared password rule, so signup/reset/change all agree. */
export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password must be 72 characters or fewer.'); // bcrypt ignores bytes past 72

export const loginSchema = z.object({
  /** Either an email address or a username — we look up both. */
  identifier: z
    .string()
    .trim()
    .min(1, 'Enter your email or username.')
    .max(255)
    // Emails are stored lowercase; usernames are matched case-insensitively too.
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Enter your password.').max(72),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Your new password must be different from your current one.',
    path: ['newPassword'],
  });
