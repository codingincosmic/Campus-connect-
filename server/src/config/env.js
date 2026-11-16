/**
 * Loads and validates environment variables ONCE, at startup.
 *
 * Why validate here? So that a missing DATABASE_URL or JWT_SECRET fails
 * immediately with a clear message, instead of causing a confusing error
 * deep inside a request handler later on.
 */
import 'dotenv/config';

/** Read a required string env var, or exit with a helpful message. */
function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(
      `\n[config] Missing required environment variable: ${name}\n` +
        `Copy server/.env.example to server/.env and fill it in.\n`
    );
    process.exit(1);
  }
  return value;
}

/** Read an optional env var with a fallback default. */
function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}

/** Read an env var that must parse as a number. */
function num(name, fallback) {
  const parsed = Number(optional(name, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  port: num('PORT', 4000),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),

  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),

  storageDriver: optional('STORAGE_DRIVER', 'local'),
  uploadDir: optional('UPLOAD_DIR', 'uploads'),
  maxUploadMb: num('MAX_UPLOAD_MB', 10),

  attendanceThreshold: num('ATTENDANCE_THRESHOLD', 75),
  attendanceEditWindowDays: num('ATTENDANCE_EDIT_WINDOW_DAYS', 7),

  /**
   * The college's local timezone, used to decide what "today" is.
   *
   * This matters: a server running in UTC would consider it still "yesterday"
   * until 05:30 IST, and would reject a teacher marking the morning's
   * attendance as being "in the future".
   */
  timezone: validTimezone(optional('COLLEGE_TIMEZONE', 'Asia/Kolkata')),

  seedPassword: optional('SEED_PASSWORD', 'Password@123'),
};

/**
 * Fail at startup on a bad timezone name rather than throwing later, deep
 * inside a request, from Intl.
 */
function validTimezone(name) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: name });
    return name;
  } catch {
    console.error(
      `\n[config] COLLEGE_TIMEZONE "${name}" is not a valid IANA timezone.\n` +
        `Use something like "Asia/Kolkata", "Europe/London" or "UTC".\n`
    );
    process.exit(1);
  }
}

/** Name of the cookie that carries the JWT. */
export const AUTH_COOKIE = 'college_portal_token';
