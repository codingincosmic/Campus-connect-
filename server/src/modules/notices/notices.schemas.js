/** Validation schemas for the notices module. */
import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';

export const idParam = z.object({ id: z.string().min(1) });

/** Empty form fields mean "not provided". */
const optionalText = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const TARGET_TYPES = ['ALL', 'CLASS', 'SECTION'];

/**
 * Notices arrive as multipart/form-data because of the optional attachment,
 * so every field is a string on the way in.
 *
 *   ALL     -> everyone in the college          (admin only)
 *   CLASS   -> every section of one class name, in one academic year
 *   SECTION -> one specific class+section row
 */
export const createNoticeSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a title.').max(200),
    body: z.string().trim().min(1, 'Enter the notice text.').max(10000),
    targetType: z.enum(TARGET_TYPES, {
      errorMap: () => ({ message: 'Choose who this notice is for.' }),
    }),
    /** Required for SECTION; for CLASS it identifies the name + year to target. */
    targetClassId: optionalText(z.string().min(1)),
  })
  .superRefine((data, ctx) => {
    if (data.targetType !== 'ALL' && !data.targetClassId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetClassId'],
        message:
          data.targetType === 'SECTION'
            ? 'Choose the section this notice is for.'
            : 'Choose the class this notice is for.',
      });
    }
  });

export const updateNoticeSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    targetType: z.enum(TARGET_TYPES).optional(),
    targetClassId: optionalText(z.string().min(1)),
    /** Send "true" to drop the current attachment. */
    removeFile: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listNoticesQuery = z.object({
  ...paginationQuery,
  /** 'true' shows only notices this user has not read yet. */
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().max(120).optional(),
});
