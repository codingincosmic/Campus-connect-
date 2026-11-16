/**
 * Auth routes, mounted at /api/auth
 *
 * Note there is deliberately NO public signup route: the college creates all
 * student and parent accounts (Phase 2), so nobody can self-register.
 */
import { Router } from 'express';
import * as controller from './auth.controller.js';
import { loginSchema, changePasswordSchema } from './auth.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(controller.login));

authRouter.post('/logout', asyncHandler(controller.logout));

authRouter.get('/me', requireAuth, asyncHandler(controller.me));

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword)
);
