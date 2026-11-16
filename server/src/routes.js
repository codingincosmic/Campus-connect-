/**
 * Top-level API router. Every module plugs in here, so this file is a
 * one-screen table of contents for the whole API surface.
 */
import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { classesRouter, subjectsRouter } from './modules/classes/classes.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { assignmentsRouter } from './modules/assignments/assignments.routes.js';
import { noticesRouter } from './modules/notices/notices.routes.js';
import { resultsRouter } from './modules/results/results.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { oversightRouter } from './modules/oversight/oversight.routes.js';
import { env } from './config/env.js';
import { GRADE_BANDS, GPA_SCALE, PASS_PERCENTAGE } from './config/grading.js';
import { ATTENDANCE_STATUSES, STATUS_META } from './config/attendance.js';

export const apiRouter = Router();

/** Liveness probe — handy for deployment platforms and for checking setup. */
apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'college-portal-api', env: env.nodeEnv });
});

/**
 * Public, non-secret configuration the frontend needs to render consistently
 * (grade bands, the attendance threshold). Served from the backend so there is
 * only one source of truth.
 */
apiRouter.get('/config', (_req, res) => {
  res.json({
    attendanceThreshold: env.attendanceThreshold,
    attendanceEditWindowDays: env.attendanceEditWindowDays,
    maxUploadMb: env.maxUploadMb,
    grading: { bands: GRADE_BANDS, gpaScale: GPA_SCALE, passPercentage: PASS_PERCENTAGE },
    attendance: { statuses: ATTENDANCE_STATUSES, statusMeta: STATUS_META },
  });
});

apiRouter.use('/auth', authRouter);

// Phase 2 — academic structure and account management.
apiRouter.use('/classes', classesRouter); // classes, sections, rosters   (staff read / admin write)
apiRouter.use('/subjects', subjectsRouter); // subjects + teacher assignment (staff read / admin write)
apiRouter.use('/users', usersRouter); // accounts, parent links        (admin only)

// Phase 3 — attendance marking, viewing and reports.
apiRouter.use('/attendance', attendanceRouter);

// Phase 4 — assignments, submissions, grading and file downloads.
apiRouter.use('/assignments', assignmentsRouter);

// Phase 5 — notices, targeted at the college, a class or a section.
apiRouter.use('/notices', noticesRouter);

// Phase 6 — marksheet, SGPA and CGPA, derived from released assignment marks.
apiRouter.use('/results', resultsRouter);

// Phase 7 — per-role dashboard aggregates.
apiRouter.use('/dashboard', dashboardRouter);

// Admin oversight — read-only visibility of what teaching staff have done.
apiRouter.use('/admin', oversightRouter);

// --- Mounted in later phases -----------------------------------------------
// apiRouter.use('/assignments', assignmentsRouter); // Phase 4
// apiRouter.use('/notices',     noticesRouter);     // Phase 5
// apiRouter.use('/results',     resultsRouter);     // Phase 6
// apiRouter.use('/files',       filesRouter);       // Phase 4 (auth'd downloads)
