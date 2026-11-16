/**
 * A single shared PrismaClient instance for the whole app.
 *
 * Creating a new PrismaClient per request would open a new pool of database
 * connections each time and quickly exhaust the limit on hosted Postgres.
 * The `globalThis` cache keeps one instance alive across `node --watch`
 * restarts during development.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    // Log queries in dev only; they're noisy in production.
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.__prisma = prisma;
}
