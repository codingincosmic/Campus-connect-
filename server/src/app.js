/**
 * Express application setup: middleware order matters here.
 *
 * Request flow:
 *   cors -> body parsers -> cookies -> logging -> /api routes -> 404 -> errors
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { apiRouter } from './routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Render/Railway/nginx) this makes `secure` cookies and
  // req.ip work correctly.
  app.set('trust proxy', 1);

  /**
   * CORS with credentials so the auth cookie is accepted cross-origin.
   * `credentials: true` requires an explicit origin — "*" is not allowed.
   * In local dev the Vite proxy makes requests same-origin, so this mostly
   * matters once the frontend is deployed separately.
   */
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );

  // Body parsers. The limit guards against someone posting a huge JSON blob.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Populates req.cookies, which the auth middleware reads.
  app.use(cookieParser());

  // Concise request logging in dev; skip the noise in production.
  if (!env.isProduction) {
    app.use(morgan('dev'));
  }

  // Everything lives under /api so the frontend can be served from /.
  app.use('/api', apiRouter);

  // Unmatched route -> 404 JSON, then the central error formatter.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
