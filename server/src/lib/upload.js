/**
 * ---------------------------------------------------------------------------
 * FILE UPLOAD HANDLING (multer)
 * ---------------------------------------------------------------------------
 *
 * Files are parsed into MEMORY, not written to disk by multer. The buffer is
 * then handed to the storage adapter (src/lib/storage.js), which decides where
 * it actually lives. That indirection is what makes swapping local disk for S3
 * a one-file change.
 *
 * Memory storage is fine at this size — uploads are capped at MAX_UPLOAD_MB
 * (default 10 MB) and a Campus Connect has low upload concurrency.
 */
import multer from 'multer';
import path from 'node:path';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

/**
 * Extensions students and teachers legitimately need to exchange.
 *
 * This is an ALLOWLIST, not a blocklist: anything not named here is refused.
 * A blocklist would need to anticipate every dangerous extension, and would
 * miss the next one.
 */
export const ALLOWED_EXTENSIONS = [
  // documents
  '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt', '.md',
  // spreadsheets / slides
  '.xls', '.xlsx', '.ods', '.csv', '.ppt', '.pptx', '.odp',
  // images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic',
  // archives + code, for programming assignments
  '.zip', '.py', '.js', '.java', '.c', '.cpp', '.sql', '.ipynb',
];

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      badRequest(
        `"${ext || 'That file type'}" is not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  }

  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
    files: 1,
    // Guards against a request with thousands of text fields.
    fields: 20,
  },
  fileFilter,
});

/**
 * Middleware accepting one optional file under the given field name.
 *
 * Multer's own errors (file too large, unexpected field) are translated into
 * our standard AppError shape so the frontend gets a readable message rather
 * than a raw multer code.
 */
export function singleFile(fieldName = 'file') {
  const handler = upload.single(fieldName);

  return function uploadMiddleware(req, res, next) {
    handler(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(badRequest(`That file is too large. The maximum is ${env.maxUploadMb} MB.`));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(badRequest(`Unexpected file field "${err.field}". Upload one file as "${fieldName}".`));
        }
        return next(badRequest(`Upload failed: ${err.message}`));
      }

      // fileFilter rejections arrive here already as AppErrors.
      return next(err);
    });
  };
}
