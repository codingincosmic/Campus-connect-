/**
 * Server entry point.
 *
 * Run with:  npm run dev   (from server/, or `npm run dev` at the repo root
 *                           to start the API and the frontend together)
 */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { initStorage } from './lib/storage.js';

async function main() {
  // Make sure the upload folder exists before any request can use it.
  await initStorage();

  // Fail fast with a clear message if the database is unreachable, rather
  // than surfacing it as a confusing 500 on the first login attempt.
  try {
    await prisma.$connect();
    console.log('[db] connected');
  } catch (err) {
    // P1001 = reachable network, unreachable database. On a hosted free tier
    // that nearly always means the project has been paused for inactivity,
    // which is worth saying out loud — the default message sends people off
    // checking DATABASE_URL, which is usually fine.
    const paused = err?.errorCode === 'P1001' || /Can't reach database server/.test(err?.message ?? '');

    console.error(
      '\n[db] Could not connect to PostgreSQL.\n' +
        (paused
          ? '\n     The host resolved but the database did not answer. Most likely causes:\n' +
            '       1. Your hosted database is PAUSED (Supabase and Neon free tiers sleep\n' +
            '          after a period of inactivity). Open its dashboard and click Resume,\n' +
            '          wait a minute, then start this again. Your data is not lost.\n' +
            '       2. DATABASE_URL in server/.env points at the wrong host.\n' +
            '       3. A firewall or VPN is blocking outbound port 5432.\n\n' +
            '     To tell 1 apart from 3, check whether the port is even reachable:\n' +
            '       Test-NetConnection <your-db-host> -Port 5432\n' +
            '     If that succeeds but this still fails, it is almost certainly a paused project.\n'
          : '     Check DATABASE_URL in server/.env, then run: npm run db:migrate\n')
    );
    throw err;
  }

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[api] health check:   http://localhost:${env.port}/api/health`);
  });

  // Close the DB pool cleanly so hosted Postgres doesn't leak connections.
  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('[api] failed to start:', err.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
