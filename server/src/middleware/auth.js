/**
 * ---------------------------------------------------------------------------
 * AUTHENTICATION + ROLE-BASED ACCESS CONTROL (backend half)
 * ---------------------------------------------------------------------------
 *
 * Frontend route guards are a convenience for the user, NOT security — anyone
 * can call the API directly. These middlewares are the real enforcement.
 *
 * Usage:
 *   router.get('/me',       requireAuth,                      handler)
 *   router.post('/classes', requireAuth, requireRole('ADMIN'), handler)
 */
import { prisma } from '../lib/prisma.js';
import { readToken, verifyToken } from '../lib/jwt.js';
import { unauthorized, forbidden } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';

/** Columns safe to send to the browser — note: no passwordHash. */
export const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  rollNo: true,
  phone: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
};

/**
 * Verifies the JWT and loads the user, putting it on `req.user`.
 *
 * We re-read the user from the database on every request rather than trusting
 * the token payload. It costs one indexed lookup but means a deactivated
 * account or changed role takes effect immediately, instead of when the token
 * happens to expire.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized('You need to log in to do that.');

  const payload = verifyToken(token);
  if (!payload?.sub) throw unauthorized('Your session has expired. Please log in again.');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: PUBLIC_USER_FIELDS,
  });

  if (!user) throw unauthorized('Your account no longer exists.');
  if (!user.isActive) throw forbidden('Your account has been deactivated. Contact the college office.');

  req.user = user;
  next();
});

/**
 * Restricts a route to one or more roles. Must run AFTER requireAuth.
 *
 * @param {...('ADMIN'|'TEACHER'|'STUDENT'|'PARENT')} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      // A programming mistake, not a user error: requireAuth was forgotten.
      return next(unauthorized('You need to log in to do that.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        forbidden(
          `This action is restricted to: ${allowedRoles.join(', ').toLowerCase()}.`
        )
      );
    }
    next();
  };
}

/** Shorthand guards for the common combinations. */
export const requireAdmin = requireRole('ADMIN');
export const requireStaff = requireRole('ADMIN', 'TEACHER');
