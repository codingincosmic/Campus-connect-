/**
 * Admin oversight routes, mounted at /api/admin.
 *
 * Read-only and ADMIN-only. Nothing here mutates data — it exists so the
 * college office can see what teaching staff have been doing.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as service from './oversight.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const activityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  teacherId: z.string().min(1).optional(),
  type: z
    .enum([
      'ALL',
      'ASSIGNMENT_CREATED',
      'ATTENDANCE_MARKED',
      'ATTENDANCE_EDITED',
      'SUBMISSION_GRADED',
    ])
    .default('ALL'),
});

export const oversightRouter = Router();

oversightRouter.use(requireAuth, requireAdmin);

/** Headline numbers for the oversight dashboard. */
oversightRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    res.json(await service.overviewStats());
  })
);

/** One row per teacher, with activity counts. */
oversightRouter.get(
  '/teachers',
  asyncHandler(async (_req, res) => {
    res.json({ items: await service.teacherSummary() });
  })
);

/** Merged, reverse-chronological staff activity. */
oversightRouter.get(
  '/activity',
  validate({ query: activityQuery }),
  asyncHandler(async (req, res) => {
    res.json(await service.activityFeed(req.query));
  })
);
