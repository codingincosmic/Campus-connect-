/**
 * JWT creation and the httpOnly cookie that carries it.
 *
 * Why a cookie instead of localStorage?
 *   An httpOnly cookie cannot be read by JavaScript, so a cross-site scripting
 *   bug on the frontend cannot steal the token. The browser attaches it
 *   automatically, so the client never handles the token at all.
 */
import jwt from 'jsonwebtoken';
import { env, AUTH_COOKIE } from '../config/env.js';

/**
 * Sign a token containing only what middleware needs. Never put anything
 * secret in here — a JWT payload is readable by anyone holding the token.
 *
 * @param {{ id: string, role: string }} user
 */
export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Verify a token and return its payload, or null when invalid/expired.
 * @param {string} token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

/** Attach the auth cookie to a response. */
export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript
    sameSite: 'lax', // sent on top-level navigation, blocks most CSRF
    secure: env.isProduction, // HTTPS only in production
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches the default JWT lifetime
    path: '/',
  });
}

/** Remove the auth cookie (logout). Options must match setAuthCookie. */
export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
  });
}

/**
 * Pull the token out of the request. Prefers the cookie, but also accepts an
 * `Authorization: Bearer <token>` header so the API stays usable from tools
 * like curl or Postman.
 */
export function readToken(req) {
  const fromCookie = req.cookies?.[AUTH_COOKIE];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);

  return null;
}
