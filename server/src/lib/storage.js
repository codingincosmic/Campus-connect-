/**
 * ---------------------------------------------------------------------------
 * FILE STORAGE ADAPTER
 * ---------------------------------------------------------------------------
 *
 * Feature code (assignments, notices) only ever calls this module — it never
 * touches `fs` or an S3 SDK directly. That means switching from local disk to
 * S3/R2/Spaces later is a change to THIS FILE ONLY:
 *
 *   1. add an `s3` driver object with the same four methods
 *   2. set STORAGE_DRIVER=s3 in .env
 *
 * Every driver exposes:
 *   save({ buffer, originalName, folder })  -> { key, fileName, size }
 *   read(key)                              -> Buffer
 *   remove(key)                            -> void
 *   urlFor(key)                            -> string the browser can fetch
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Absolute path to the upload root, e.g. <server>/uploads */
const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploadDir);

/**
 * Turn a user-supplied filename into something safe to put on disk, and make
 * it unique so two students uploading "homework.pdf" don't collide.
 */
function buildStorageKey(originalName, folder) {
  const ext = path.extname(originalName).toLowerCase().slice(0, 12);
  const base = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9-_]/g, '_') // strip anything that could confuse a path
    .slice(0, 40);
  const unique = crypto.randomBytes(8).toString('hex');
  // Forward slashes on purpose: the key is a logical path, not an OS path.
  return `${folder}/${base}_${unique}${ext}`;
}

/**
 * Guard against path traversal: a crafted key like "../../.env" must never
 * escape the upload root.
 */
function resolveSafe(key) {
  const target = path.resolve(UPLOAD_ROOT, key);
  if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error(`Refusing to access a path outside the upload root: ${key}`);
  }
  return target;
}

const localDriver = {
  name: 'local',

  async save({ buffer, originalName, folder = 'misc' }) {
    const key = buildStorageKey(originalName, folder);
    const target = resolveSafe(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return { key, fileName: originalName, size: buffer.length };
  },

  async read(key) {
    return fs.readFile(resolveSafe(key));
  },

  async remove(key) {
    try {
      await fs.unlink(resolveSafe(key));
    } catch (err) {
      // Already gone is fine — deleting is idempotent.
      if (err.code !== 'ENOENT') throw err;
    }
  },

  /**
   * Files are streamed through an authenticated Express route rather than
   * served statically, so that only the right roles can download them.
   */
  urlFor(key) {
    return `/api/files/${encodeURIComponent(key)}`;
  },
};

/**
 * TODO (later): implement an S3 driver with the same shape, e.g.
 *
 * const s3Driver = {
 *   name: 's3',
 *   async save({ buffer, originalName, folder }) { ...PutObjectCommand... },
 *   async read(key) { ...GetObjectCommand... },
 *   async remove(key) { ...DeleteObjectCommand... },
 *   urlFor(key) { return signedUrl(key); },
 * };
 */
const drivers = {
  local: localDriver,
};

const driver = drivers[env.storageDriver];
if (!driver) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${env.storageDriver}". Available: ${Object.keys(drivers).join(', ')}`
  );
}

export const storage = driver;

/** Ensure the upload directory exists at boot. */
export async function initStorage() {
  if (driver.name === 'local') {
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  }
}
