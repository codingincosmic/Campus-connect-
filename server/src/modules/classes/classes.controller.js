/** Thin HTTP layer over classes.service. */
import * as service from './classes.service.js';

/* --- Classes --- */

export async function listClasses(req, res) {
  res.json({ items: await service.listClasses(req.user, req.query) });
}

export async function getClass(req, res) {
  res.json(await service.getClass(req.user, req.params.id));
}

export async function createClass(req, res) {
  res.status(201).json(await service.createClass(req.body));
}

export async function updateClass(req, res) {
  res.json(await service.updateClass(req.params.id, req.body));
}

export async function deleteClass(req, res) {
  await service.deleteClass(req.params.id);
  res.status(204).end();
}

/* --- Subjects --- */

export async function listSubjects(req, res) {
  res.json({ items: await service.listSubjects(req.user, req.query) });
}

export async function createSubject(req, res) {
  res.status(201).json(await service.createSubject(req.body));
}

export async function updateSubject(req, res) {
  res.json(await service.updateSubject(req.params.id, req.body));
}

export async function deleteSubject(req, res) {
  await service.deleteSubject(req.params.id);
  res.status(204).end();
}

/* --- Enrollment --- */

export async function listClassStudents(req, res) {
  res.json(await service.listClassStudents(req.user, req.params.id, req.query));
}

export async function enrollStudents(req, res) {
  res.status(201).json(await service.enrollStudents(req.params.id, req.body.studentIds));
}

export async function unenrollStudent(req, res) {
  await service.unenrollStudent(req.params.id, req.params.studentId);
  res.status(204).end();
}
