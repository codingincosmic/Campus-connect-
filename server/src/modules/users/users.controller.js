/** Thin HTTP layer over users.service. */
import * as service from './users.service.js';

export async function listUsers(req, res) {
  res.json(await service.listUsers(req.query));
}

export async function getUser(req, res) {
  res.json(await service.getUser(req.params.id));
}

export async function createUser(req, res) {
  // `tempPassword` is non-null only when the server generated one. The admin
  // sees it once in the response; it is never stored in plain text.
  const { user, tempPassword } = await service.createUser(req.body, req.user.id);
  res.status(201).json({ user, tempPassword });
}

export async function updateUser(req, res) {
  res.json(await service.updateUser(req.params.id, req.body, req.user.id));
}

export async function resetPassword(req, res) {
  const { tempPassword } = await service.resetPassword(req.params.id, req.body.newPassword);
  res.json({ ok: true, tempPassword });
}

export async function deleteUser(req, res) {
  await service.deleteUser(req.params.id, req.user.id);
  res.status(204).end();
}

/* --- Parent <-> student links --- */

export async function listChildren(req, res) {
  res.json({ items: await service.listChildren(req.params.id) });
}

export async function linkChildren(req, res) {
  const { studentIds, relationship } = req.body;
  res.status(201).json(await service.linkChildren(req.params.id, studentIds, relationship));
}

export async function unlinkChild(req, res) {
  await service.unlinkChild(req.params.id, req.params.studentId);
  res.status(204).end();
}
