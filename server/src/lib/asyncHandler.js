/**
 * Wraps an async route handler so that a rejected promise is passed to
 * Express's error handler instead of crashing the process.
 *
 * Express 4 does not catch async errors on its own, so every async controller
 * should be wrapped:
 *
 *   router.get('/', asyncHandler(controller.list));
 */
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
