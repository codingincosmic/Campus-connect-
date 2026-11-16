/**
 * TEMPORARY diagnostic: finds which Supabase connection variant works.
 *
 * Supabase has been migrating projects between shared poolers (aws-0 -> aws-1),
 * and the old hostname keeps accepting TCP because it is multi-tenant — so a
 * stale hostname looks exactly like an unreachable server.
 *
 * Never prints the password. Delete this file once the connection is fixed.
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const env = fs.readFileSync('./.env', 'utf8');
const current = (env.match(/^DATABASE_URL="?(.+?)"?\s*$/m) || [])[1];

if (!current) {
  console.log('Could not read DATABASE_URL from server/.env');
  process.exit(1);
}

const u = new URL(current);
const dbname = u.pathname.slice(1) || 'postgres';
const params = u.search || '?sslmode=require';

const hosts = ['aws-0-ap-south-1.pooler.supabase.com', 'aws-1-ap-south-1.pooler.supabase.com'];
const ports = [5432, 6543];

console.log('username :', decodeURIComponent(u.username));
console.log('database :', dbname);
console.log('');

let winner = null;

for (const host of hosts) {
  for (const port of ports) {
    const url = `postgresql://${u.username}:${u.password}@${host}:${port}/${dbname}${params}`;
    const client = new PrismaClient({ datasources: { db: { url } } });

    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      const mode = port === 5432 ? 'session' : 'transaction';
      console.log(`  WORKS  ${host}:${port}  (${mode} mode)`);
      if (!winner) winner = { host, port, url };
    } catch (err) {
      const msg = err.message ?? '';
      const reason = /password authentication failed/i.test(msg)
        ? 'auth failed — host is right, password wrong'
        : /Tenant or user not found/i.test(msg)
          ? 'tenant not found — wrong pooler for this project'
          : (err.errorCode ?? err.code ?? err.name);
      console.log(`  fails  ${host}:${port}  -> ${reason}`);
    } finally {
      await client.$disconnect().catch(() => {});
    }
  }
}

console.log('');
if (winner) {
  console.log(`RESULT: use host ${winner.host} port ${winner.port}`);
} else {
  console.log('RESULT: no variant worked — the credentials themselves are likely stale.');
}
