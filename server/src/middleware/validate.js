/**
 * Request validation using Zod schemas.
 *
 * Validating at the edge means controllers can trust their input, and the user
 * gets a precise per-field error message instead of a 500 from deeper down.
 *
 * Usage:
 *   router.post('/login', validate({ body: loginSchema }), controller.login)
 *
 * On success the parsed (and coerced) value REPLACES req.body / req.query /
 * req.params, so downstream code gets proper types — e.g. a real Date instead
 * of a date string.
 */
import { badRequest } from '../lib/errors.js';

/**
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
export function validate(schemas) {
  return function validator(req, _res, next) {
    for (const part of ['body', 'query', 'params']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return next(
          badRequest('Some of the details you entered are not valid.', formatZodError(result.error))
        );
      }
      req[part] = result.data;
    }
    next();
  };
}

/**
 * Flatten a Zod error into `{ fieldName: "message" }`, which the frontend can
 * drop straight next to the relevant input.
 */
function formatZodError(error) {
  /** @type {Record<string, string>} */
  const fieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    // Keep the first message per field — showing three at once is noise.
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors };
}
