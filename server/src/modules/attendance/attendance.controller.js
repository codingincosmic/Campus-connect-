/** Thin HTTP layer over attendance.service. */
import * as service from './attendance.service.js';

/* --- Marking (teacher/admin) --- */

export async function getSheet(req, res) {
  res.json(await service.getSheet(req.user, req.query));
}

export async function markAttendance(req, res) {
  res.json(await service.markAttendance(req.user, req.body));
}

/* --- Viewing --- */

/** A student viewing their own attendance. */
export async function myAttendance(req, res) {
  res.json(await service.getStudentAttendance(req.user, req.user.id, req.query));
}

/** A parent, teacher or admin viewing a specific student. */
export async function studentAttendance(req, res) {
  res.json(await service.getStudentAttendance(req.user, req.params.studentId, req.query));
}

/* --- Reports (teacher/admin) --- */

export async function report(req, res) {
  res.json(await service.getReport(req.user, req.query));
}

export async function defaulters(req, res) {
  res.json(await service.getDefaulters(req.user, req.query));
}

/**
 * CSV download. Content-Disposition tells the browser to save the file
 * rather than render it.
 */
export async function reportCsv(req, res) {
  const data = await service.getReport(req.user, req.query);
  const csv = service.reportToCsv(data);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${service.csvFilename(data)}"`);
  res.send(csv);
}
