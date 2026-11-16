/**
 * Password hashing. All hashing goes through this module so the algorithm can
 * be changed in one place.
 *
 * bcryptjs is a pure-JavaScript implementation — it needs no native build
 * tools, which keeps `npm install` painless on Windows.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

/** Work factor. Higher = slower to hash = harder to brute force. */
const SALT_ROUNDS = 10;

/** @param {string} plainPassword */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a submitted password against a stored hash.
 * @param {string} plainPassword
 * @param {string} hash
 */
export async function verifyPassword(plainPassword, hash) {
  if (!hash) return false;
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Generate a temporary password for an account the admin is creating or
 * resetting. It is shown to the admin ONCE so they can pass it on, and the
 * account is flagged `mustChangePassword`.
 *
 * The alphabet deliberately omits look-alike characters (0/O, 1/l/I) because
 * these get read aloud or written on paper in a college office.
 */
export function generateTempPassword() {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*';
  const all = upper + lower + digits + symbols;

  // Guarantee one of each class so the result always passes a policy check.
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 8 }, () => pick(all));

  return shuffle([...required, ...rest]).join('');
}

/** Cryptographically random character from `chars` (no modulo bias concern at these sizes). */
function pick(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

/** Fisher-Yates using a CSPRNG, so the required characters aren't always first. */
function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
