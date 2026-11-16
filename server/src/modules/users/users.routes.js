/**
 * User management routes, mounted at /api/users.
 *
 * ADMIN only, without exception — this router creates accounts and resets
 * passwords, so the guard is applied once at the top rather than per route.
 */
import { Router } from 'express';
import * as controller from './users.controller.js';
import * as schemas from './users.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

usersRouter.get(
  '/',
  validate({ query: schemas.listUsersQuery }),
  asyncHandler(controller.listUsers)
);

usersRouter.post(
  '/',
  validate({ body: schemas.createUserSchema }),
  asyncHandler(controller.createUser)
);

usersRouter.get('/:id', validate({ params: schemas.idParam }), asyncHandler(controller.getUser));

usersRouter.patch(
  '/:id',
  validate({ params: schemas.idParam, body: schemas.updateUserSchema }),
  asyncHandler(controller.updateUser)
);

usersRouter.delete(
  '/:id',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.deleteUser)
);

/** v1 "forgot password": the office resets it and hands over a temp password. */
usersRouter.post(
  '/:id/reset-password',
  validate({ params: schemas.idParam, body: schemas.resetPasswordSchema }),
  asyncHandler(controller.resetPassword)
);

/* --- Parent <-> student links --- */

usersRouter.get(
  '/:id/children',
  validate({ params: schemas.idParam }),
  asyncHandler(controller.listChildren)
);

usersRouter.post(
  '/:id/children',
  validate({ params: schemas.idParam, body: schemas.linkChildrenSchema }),
  asyncHandler(controller.linkChildren)
);

usersRouter.delete(
  '/:id/children/:studentId',
  validate({ params: schemas.childParam }),
  asyncHandler(controller.unlinkChild)
);
