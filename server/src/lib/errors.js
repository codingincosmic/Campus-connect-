/**
 * A typed error that the global error handler turns into a clean JSON response.
 *
 * Throw these from services instead of writing to `res` directly — it keeps
 * business logic free of HTTP details and guarantees a consistent error shape:
 *
 *   { error: { message, code, details } }
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message Human-readable message (safe to show the user)
   * @param {object} [options]
   * @param {string} [options.code] Short machine-readable code
   * @param {unknown} [options.details] Extra info, e.g. field validation errors
   */
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code ?? httpCodeFor(status);
    this.details = details;
  }
}

/** 400 — the request itself is malformed or fails validation. */
export const badRequest = (message, details) =>
  new AppError(400, message, { code: 'BAD_REQUEST', details });

/** 401 — not logged in, or the token is missing/expired. */
export const unauthorized = (message = 'You are not logged in.') =>
  new AppError(401, message, { code: 'UNAUTHORIZED' });

/** 403 — logged in, but this role/user may not do this. */
export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError(403, message, { code: 'FORBIDDEN' });

/** 404 — the thing being addressed does not exist (or isn't visible to you). */
export const notFound = (message = 'Not found.') => new AppError(404, message, { code: 'NOT_FOUND' });

/** 409 — the request conflicts with existing data (e.g. duplicate email). */
export const conflict = (message, details) => new AppError(409, message, { code: 'CONFLICT', details });

function httpCodeFor(status) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE',
  };
  return map[status] ?? 'INTERNAL_ERROR';
}
