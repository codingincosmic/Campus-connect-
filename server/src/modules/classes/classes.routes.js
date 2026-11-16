/**
 * Routes for classes, subjects and enrollment.
 *
 * Read routes are open to staff (ADMIN + TEACHER) because teachers need class
 * and subject lists to mark attendance later. Every write route is ADMIN only.
 */
import { Router } from 'express';
import * as controller from './classes.controller.js';
import * as schemas from './classes.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireAdmin, requireStaff } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

/* -------------------------------------------------------------------------- */
/* /api/classes                                                               */
/* -------------------------------------------------------------------------- */

export const classesRouter = Router();

// Everything below requires a logged-in staff member.
classesRouter.use(requireAuth, requireStaff);

classesRouter.get(
  '/',
  validate({ query: schemas.listClassesQuery }),
  asyncHandler(controller.listClasses)
);

classesRouter.post(
  '/',
  requireAdmin,
  validate({ body: schemas.createClassSchema }),
  asyncHandler(controller.createClass)
);

classesRouter.get(
  '/:id',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.getClass)
);

classesRouter.patch(
  '/:id',
  requireAdmin,
  validate({ params: schemas.idParam, body: schemas.updateClassSchema }),
  asyncHandler(controller.updateClass)
);

classesRouter.delete(
  '/:id',
  requireAdmin,
  validate({ params: schemas.idParam }),
  asyncHandler(controller.deleteClass)
);

/* --- Class roster --- */

classesRouter.get(
  '/:id/students',
  validate({ params: schemas.idParam, query: schemas.classStudentsQuery }),
  asyncHandler(controller.listClassStudents)
);

classesRouter.post(
  '/:id/students',
  requireAdmin,
  validate({ params: schemas.idParam, body: schemas.enrollStudentsSchema }),
  asyncHandler(controller.enrollStudents)
);

classesRouter.delete(
  '/:id/students/:studentId',
  requireAdmin,
  validate({ params: schemas.studentIdParam }),
  asyncHandler(controller.unenrollStudent)
);

/* -------------------------------------------------------------------------- */
/* /api/subjects                                                              */
/* -------------------------------------------------------------------------- */

export const subjectsRouter = Router();

subjectsRouter.use(requireAuth, requireStaff);

subjectsRouter.get(
  '/',
  validate({ query: schemas.listSubjectsQuery }),
  asyncHandler(controller.listSubjects)
);

subjectsRouter.post(
  '/',
  requireAdmin,
  validate({ body: schemas.createSubjectSchema }),
  asyncHandler(controller.createSubject)
);

subjectsRouter.patch(
  '/:id',
  requireAdmin,
  validate({ params: schemas.idParam, body: schemas.updateSubjectSchema }),
  asyncHandler(controller.updateSubject)
);

subjectsRouter.delete(
  '/:id',
  requireAdmin,
  validate({ params: schemas.idParam }),
  asyncHandler(controller.deleteSubject)
);
