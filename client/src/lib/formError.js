/**
 * Turns any thrown error into the two things a form needs to render:
 *
 *   fieldErrors — messages to show under individual inputs
 *   formError   — a banner message, used only when nothing maps to a field
 *                 (otherwise the user would see the same complaint twice)
 */
import { ApiError } from '../api/client.js';

export function readFormError(err) {
  if (err instanceof ApiError) {
    const fieldErrors = err.fieldErrors;
    return {
      fieldErrors,
      formError: Object.keys(fieldErrors).length > 0 ? '' : err.message,
    };
  }
  return { fieldErrors: {}, formError: 'Something went wrong. Please try again.' };
}

/** Message for a failed page-level load. */
export function readLoadError(err) {
  return err instanceof ApiError ? err.message : 'Could not load this page. Please try again.';
}
