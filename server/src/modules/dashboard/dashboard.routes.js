/**
 * Dashboard routes, mounted at /api/dashboard.
 *
 * One read-only endpoint per role, each returning everything that role's
 * landing page needs in a single request.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as service from './dashboard.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const studentIdParam = z.object({ studentId: z.string().min(1) });

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/teacher',
  requireRole('TEACHER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    res.json(await service.teacherDashboard(req.user));
  })
);

dashboardRouter.get(
  '/student',
  requireRole('STUDENT'),
  asyncHandler(async (req, res) => {
    res.json(await service.studentDashboard(req.user));
  })
);

/** Summary row per linked child. */
dashboardRouter.get(
  '/parent',
  requireRole('PARENT'),
  asyncHandler(async (req, res) => {
    res.json(await service.parentDashboard(req.user));
  })
);

/**
 * The full dashboard for one child. Open to any role because the service
 * checks whether THIS user may view THAT student.
 */
dashboardRouter.get(
  '/child/:studentId',
  validate({ params: studentIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.childDashboard(req.user, req.params.studentId));
  })
);
