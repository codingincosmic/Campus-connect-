/** Thin HTTP layer over notices.service. */
import path from 'node:path';
import * as service from './notices.service.js';

export async function listNotices(req, res) {
  res.json(await service.listNotices(req.user, req.query));
}

export async function getNotice(req, res) {
  res.json(await service.getNotice(req.user, req.params.id));
}

export async function unreadCount(req, res) {
  res.json(await service.unreadCount(req.user));
}

export async function markRead(req, res) {
  res.json(await service.markRead(req.user, req.params.id));
}

export async function markAllRead(req, res) {
  res.json(await service.markAllRead(req.user));
}

export async function createNotice(req, res) {
  res.status(201).json(await service.createNotice(req.user, req.body, req.file));
}

export async function updateNotice(req, res) {
  res.json(await service.updateNotice(req.user, req.params.id, req.body, req.file));
}

export async function deleteNotice(req, res) {
  await service.deleteNotice(req.user, req.params.id);
  res.status(204).end();
}

/** Classes this user may address, for the compose form's audience picker. */
export async function targets(req, res) {
  res.json(await service.targetableClasses(req.user));
}

export async function downloadFile(req, res) {
  const { buffer, fileName } = await service.readNoticeFile(req.user, req.params.id);
  const safeName = path.basename(fileName || 'download').replace(/["\r\n]/g, '');

  // octet-stream + nosniff: never let an uploaded file execute as HTML on our origin.
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
