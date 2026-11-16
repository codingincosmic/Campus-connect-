/**
 * The single place where errors become HTTP responses.
 *
 * Every response has the same shape, so the frontend has exactly one thing
 * to parse:
 *
 *   { error: { message, code, details? } }
 */
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

/** 404 for any route that didn't match. Mount just before errorHandler. */
export function notFoundHandler(req, _res, next) {
  next(new AppError(404, `No API route matches ${req.method} ${req.originalUrl}`));
}

/* eslint-disable-next-line no-unused-vars -- Express needs all 4 args to treat this as an error handler */
export function errorHandler(err, req, res, next) {
  let status = err.status ?? 500;
  let message = err.message ?? 'Something went wrong.';
  let code = err.code ?? 'INTERNAL_ERROR';
  let details = err.details;

  // --- Translate Prisma's low-level errors into friendly messages ---------
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint violation, e.g. two users with the same email.
      const fields = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'value';
      status = 409;
      code = 'CONFLICT';
      message = `That ${humanizeField(fields)} is already in use.`;
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'The record you are trying to change no longer exists.';
    } else if (err.code === 'P2003') {
      status = 400;
      code = 'BAD_REQUEST';
      message = 'That action refers to a record that does not exist.';
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message =
      'Cannot reach the database. Check DATABASE_URL in server/.env and that migrations have run.';
  }

  // --- Log server-side faults; client mistakes are not worth the noise ----
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(status).json({
    error: {
      message,
      code,
      ...(details ? { details } : {}),
      // A stack trace is a gift to an attacker — dev only.
      ...(env.isProduction ? {} : { stack: err.stack }),
    },
  });
}

/** "users_email_key" / "email" -> "email" */
function humanizeField(raw) {
  return String(raw).replace(/_key$/, '').replace(/^users_/, '').replace(/_/g, ' ');
}
