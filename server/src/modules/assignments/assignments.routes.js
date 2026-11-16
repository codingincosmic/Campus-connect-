/**
 * Assignment routes, mounted at /api/assignments.
 *
 * Route order matters in Express: the literal paths `/mine` and
 * `/submissions/...` are declared BEFORE `/:id`, otherwise "mine" would be
 * matched as an assignment id.
 */
import { Router } from 'express';
import * as controller from './assignments.controller.js';
import * as schemas from './assignments.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff, requireRole } from '../../middleware/auth.js';
import { singleFile } from '../../lib/upload.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth);

/* -------------------------------------------------------------------------- */
/* Student / parent views — declared first (literal paths beat /:id)          */
/* -------------------------------------------------------------------------- */

/** A student's own assignments. */
assignmentsRouter.get(
  '/mine',
  requireRole('STUDENT'),
  validate({ query: schemas.myAssignmentsQuery }),
  asyncHandler(controller.myAssignments)
);

/** A specific student's assignments — scoped per role inside the service. */
assignmentsRouter.get(
  '/student/:studentId',
  validate({ params: schemas.studentIdParam, query: schemas.myAssignmentsQuery }),
  asyncHandler(controller.studentAssignments)
);

/* --- Submission-level routes --- */

assignmentsRouter.get(
  '/submissions/:submissionId/file',
  asyncHandler(controller.downloadSubmissionFile)
);

assignmentsRouter.patch(
  '/submissions/:submissionId/grade',
  requireStaff,
  validate({ body: schemas.gradeSubmissionSchema }),
  asyncHandler(controller.gradeSubmission)
);

/* -------------------------------------------------------------------------- */
/* Staff listing and creation                                                 */
/* -------------------------------------------------------------------------- */

assignmentsRouter.get(
  '/',
  requireStaff,
  validate({ query: schemas.listAssignmentsQuery }),
  asyncHandler(controller.listForStaff)
);

assignmentsRouter.post(
  '/',
  requireStaff,
  // Upload must run before validation: multer is what parses multipart bodies.
  singleFile('file'),
  validate({ body: schemas.createAssignmentSchema }),
  asyncHandler(controller.createAssignment)
);

/* -------------------------------------------------------------------------- */
/* Single assignment                                                          */
/* -------------------------------------------------------------------------- */

assignmentsRouter.get(
  '/:id/file',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.downloadAssignmentFile)
);

assignmentsRouter.get(
  '/:id/submissions',
  requireStaff,
  validate({ params: schemas.idParam }),
  asyncHandler(controller.listSubmissions)
);

/** Students upload their work here. */
assignmentsRouter.post(
  '/:id/submit',
  requireRole('STUDENT'),
  singleFile('file'),
  validate({ params: schemas.idParam }),
  asyncHandler(controller.submitAssignment)
);

assignmentsRouter.post(
  '/:id/publish',
  requireStaff,
  validate({ params: schemas.idParam, body: schemas.publishAllSchema }),
  asyncHandler(controller.publishAll)
);

assignmentsRouter.patch(
  '/:id',
  requireStaff,
  singleFile('file'),
  validate({ params: schemas.idParam, body: schemas.updateAssignmentSchema }),
  asyncHandler(controller.updateAssignment)
);

assignmentsRouter.delete(
  '/:id',
  requireStaff,
  validate({ params: schemas.idParam }),
  asyncHandler(controller.deleteAssignment)
);
