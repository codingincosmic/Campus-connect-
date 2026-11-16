/**
 * Attendance routes, mounted at /api/attendance.
 *
 * Marking and reports are staff-only. Viewing is open to all four roles, but
 * every view is scoped by `assertCanViewStudent` in the service — a parent can
 * only ever load their own child, a student only themselves.
 */
import { Router } from 'express';
import * as controller from './attendance.controller.js';
import * as schemas from './attendance.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

/* --- Marking: teachers (for their own subjects) and admins --- */

attendanceRouter.get(
  '/sheet',
  requireStaff,
  validate({ query: schemas.sheetQuery }),
  asyncHandler(controller.getSheet)
);

attendanceRouter.post(
  '/mark',
  requireStaff,
  validate({ body: schemas.markAttendanceSchema }),
  asyncHandler(controller.markAttendance)
);

/* --- Reports: staff only --- */

attendanceRouter.get(
  '/report',
  requireStaff,
  validate({ query: schemas.reportQuery }),
  asyncHandler(controller.report)
);

attendanceRouter.get(
  '/report.csv',
  requireStaff,
  validate({ query: schemas.reportQuery }),
  asyncHandler(controller.reportCsv)
);

attendanceRouter.get(
  '/defaulters',
  requireStaff,
  validate({ query: schemas.defaultersQuery }),
  asyncHandler(controller.defaulters)
);

/* --- Viewing --- */

/** A student's own attendance. */
attendanceRouter.get(
  '/me',
  requireRole('STUDENT'),
  validate({ query: schemas.studentAttendanceQuery }),
  asyncHandler(controller.myAttendance)
);

/**
 * A specific student's attendance. Open to every role because the service
 * decides whether THIS user may see THAT student.
 */
attendanceRouter.get(
  '/student/:studentId',
  validate({ params: schemas.studentIdParam, query: schemas.studentAttendanceQuery }),
  asyncHandler(controller.studentAttendance)
);
