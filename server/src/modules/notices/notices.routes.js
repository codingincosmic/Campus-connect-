/**
 * Notice routes, mounted at /api/notices.
 *
 * Reading is open to every logged-in role — the service scopes the feed to the
 * user's audience. Writing is staff-only, with further checks in the service
 * (teachers may only address sections they teach).
 *
 * Literal paths are declared before `/:id` so "unread-count" isn't parsed as an id.
 */
import { Router } from 'express';
import * as controller from './notices.controller.js';
import * as schemas from './notices.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { singleFile } from '../../lib/upload.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const noticesRouter = Router();

noticesRouter.use(requireAuth);

/* --- Literal paths first --- */

noticesRouter.get('/unread-count', asyncHandler(controller.unreadCount));

noticesRouter.post('/read-all', asyncHandler(controller.markAllRead));

/** Audience options for the compose form. */
noticesRouter.get('/targets', requireStaff, asyncHandler(controller.targets));

/* --- Feed --- */

noticesRouter.get(
  '/',
  validate({ query: schemas.listNoticesQuery }),
  asyncHandler(controller.listNotices)
);

noticesRouter.post(
  '/',
  requireStaff,
  // Upload middleware must run first: it is what parses the multipart body.
  singleFile('file'),
  validate({ body: schemas.createNoticeSchema }),
  asyncHandler(controller.createNotice)
);

/* --- Single notice --- */

noticesRouter.get(
  '/:id',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.getNotice)
);

noticesRouter.get(
  '/:id/file',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.downloadFile)
);

noticesRouter.post(
  '/:id/read',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.markRead)
);

noticesRouter.patch(
  '/:id',
  requireStaff,
  singleFile('file'),
  validate({ params: schemas.idParam, body: schemas.updateNoticeSchema }),
  asyncHandler(controller.updateNotice)
);

noticesRouter.delete(
  '/:id',
  requireStaff,
  validate({ params: schemas.idParam }),
  asyncHandler(controller.deleteNotice)
);
