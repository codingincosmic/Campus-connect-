/**
 * ---------------------------------------------------------------------------
 * API CLIENT — the only place in the frontend that calls fetch().
 * ---------------------------------------------------------------------------
 *
 * Every feature imports `api` from here, which gives us one place to handle
 * credentials, JSON encoding and error shapes.
 *
 * Note `credentials: 'include'`: this is what makes the browser send the
 * httpOnly auth cookie. Without it we'd be logged out on every request.
 */

/** Error thrown for any non-2xx response. Carries the server's details. */
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    /** e.g. { fieldErrors: { email: "That email is already in use." } } */
    this.details = details;
  }

  /** Convenience for showing errors under the matching form input. */
  get fieldErrors() {
    return this.details?.fieldErrors ?? {};
  }
}

/**
 * @param {string} path e.g. '/auth/login' (the '/api' prefix is added here)
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal }} [options]
 */
async function request(path, { method = 'GET', body, formData, signal } = {}) {
  let response;

  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      /**
       * Deliberately NO Content-Type header for FormData: the browser must set
       * it itself so it can include the multipart boundary. Setting it by hand
       * produces a body the server cannot parse.
       */
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: formData ?? (body ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (err) {
    // fetch only rejects on network-level failures, not on HTTP error codes.
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Is it running?', { code: 'NETWORK_ERROR' });
  }

  // 204 No Content has no body to parse.
  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A non-JSON body means something unexpected (proxy error page, crash).
      throw new ApiError('The server returned an unreadable response.', {
        status: response.status,
        code: 'BAD_RESPONSE',
      });
    }
  }

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(error.message ?? `Request failed (${response.status})`, {
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),

  /** Multipart upload, for endpoints that accept a file. */
  postForm: (path, formData, options) => request(path, { ...options, method: 'POST', formData }),
  patchForm: (path, formData, options) => request(path, { ...options, method: 'PATCH', formData }),
};

/**
 * Build a FormData body, skipping empty values so the server's "treat empty
 * string as not provided" rules line up with what the form actually sends.
 *
 * @param {Record<string, unknown>} fields
 * @param {{ name: string, file: File|null }} [fileField]
 */
export function toFormData(fields, fileField) {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    form.append(key, String(value));
  }

  if (fileField?.file) form.append(fileField.name, fileField.file);

  return form;
}
