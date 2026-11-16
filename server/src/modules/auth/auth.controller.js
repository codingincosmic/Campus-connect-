/**
 * Auth controllers: translate HTTP <-> service calls. No business rules here.
 */
import * as authService from './auth.service.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../../lib/jwt.js';

/**
 * POST /api/auth/login
 * Body: { identifier, password }
 * Sets the httpOnly auth cookie and returns the user + role context.
 */
export async function login(req, res) {
  const user = await authService.authenticate(req.body);

  setAuthCookie(res, signToken(user));

  const context = await authService.getContextFor(user);
  res.json({ user, context });
}

/**
 * POST /api/auth/logout
 * Clearing the cookie is all that's needed — the token is never stored server-side.
 */
export async function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

/**
 * GET /api/auth/me
 * Used on page load to restore the session (the client cannot read the cookie).
 */
export async function me(req, res) {
  const context = await authService.getContextFor(req.user);
  res.json({ user: req.user, context });
}

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export async function changePassword(req, res) {
  await authService.changeOwnPassword(req.user.id, req.body);

  // Re-issue the cookie so the token reflects a fresh session.
  const user = await authService.getPublicUser(req.user.id);
  setAuthCookie(res, signToken(user));

  res.json({ ok: true, user });
}
