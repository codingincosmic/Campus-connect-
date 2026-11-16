/** Thin HTTP layer over assignments.service. */
import path from 'node:path';
import * as service from './assignments.service.js';

/* --- Teacher --- */

export async function listForStaff(req, res) {
  res.json({ items: await service.listForStaff(req.user, req.query) });
}

export async function createAssignment(req, res) {
  // req.file is populated by the upload middleware; it's optional.
  res.status(201).json(await service.createAssignment(req.user, req.body, req.file));
}

export async function updateAssignment(req, res) {
  res.json(await service.updateAssignment(req.user, req.params.id, req.body, req.file));
}

export async function deleteAssignment(req, res) {
  await service.deleteAssignment(req.user, req.params.id);
  res.status(204).end();
}

export async function listSubmissions(req, res) {
  res.json(await service.listSubmissions(req.user, req.params.id));
}

export async function gradeSubmission(req, res) {
  res.json(await service.gradeSubmission(req.user, req.params.submissionId, req.body));
}

export async function publishAll(req, res) {
  res.json(await service.publishAll(req.user, req.params.id, req.body.isPublished));
}

/* --- Student / parent --- */

export async function myAssignments(req, res) {
  res.json(await service.listForStudent(req.user, req.user.id, req.query));
}

export async function studentAssignments(req, res) {
  res.json(await service.listForStudent(req.user, req.params.studentId, req.query));
}

export async function submitAssignment(req, res) {
  res.status(201).json(await service.submitAssignment(req.user, req.params.id, req.file));
}

/* --- Downloads --- */

export async function downloadAssignmentFile(req, res) {
  const { buffer, fileName } = await service.readAssignmentFile(req.user, req.params.id);
  sendFile(res, buffer, fileName);
}

export async function downloadSubmissionFile(req, res) {
  const { buffer, fileName } = await service.readSubmissionFile(req.user, req.params.submissionId);
  sendFile(res, buffer, fileName);
}

/**
 * Send a file as a download.
 *
 * `Content-Type: application/octet-stream` plus `X-Content-Type-Options: nosniff`
 * stops the browser from interpreting an uploaded file as HTML and running it
 * in the context of our origin — which would be a stored-XSS hole.
 */
function sendFile(res, buffer, fileName) {
  const safeName = path.basename(fileName || 'download').replace(/["\r\n]/g, '');

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
