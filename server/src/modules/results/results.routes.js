/**
 * Results / marksheet routes, mounted at /api/results.
 *
 * Everything here is read-only: marks are entered on the assignments screen and
 * released from there. This module only aggregates them.
 *
 * Literal paths come before `/:param` routes so "me" isn't read as an id.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as service from './results.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const studentIdParam = z.object({ studentId: z.string().min(1) });
const classIdParam = z.object({ classId: z.string().min(1) });
const subjectIdParam = z.object({ subjectId: z.string().min(1) });

export const resultsRouter = Router();

resultsRouter.use(requireAuth);

/** A student's own marksheet. */
resultsRouter.get(
  '/me',
  requireRole('STUDENT'),
  asyncHandler(async (req, res) => {
    res.json(await service.getStudentResults(req.user, req.user.id));
  })
);

/**
 * A specific student's marksheet. Open to every role because the service
 * decides whether THIS user may see THAT student — a parent only their own
 * children, a teacher only students in classes they teach.
 */
resultsRouter.get(
  '/student/:studentId',
  validate({ params: studentIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.getStudentResults(req.user, req.params.studentId));
  })
);

/** Whole-class gradebook. */
resultsRouter.get(
  '/class/:classId',
  requireStaff,
  validate({ params: classIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.getClassResults(req.user, req.params.classId));
  })
);

/** Whole-class gradebook as a CSV download. */
resultsRouter.get(
  '/class/:classId/csv',
  requireStaff,
  validate({ params: classIdParam }),
  asyncHandler(async (req, res) => {
    const data = await service.getClassResults(req.user, req.params.classId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${service.csvFilename(data)}"`);
    res.send(service.classResultsToCsv(data));
  })
);

/** One subject, assessment by assessment. */
resultsRouter.get(
  '/subject/:subjectId',
  requireStaff,
  validate({ params: subjectIdParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.getSubjectResults(req.user, req.params.subjectId));
  })
);
