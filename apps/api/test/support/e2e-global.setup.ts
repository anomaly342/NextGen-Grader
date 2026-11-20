import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { E2E_DATABASE_URL } from './e2e-env.constants';

/** packages/prisma, where the migrations and prisma.config.ts live. */
const PRISMA_PACKAGE_DIR = resolve(__dirname, '../../../../packages/prisma');

/** Creates the e2e database if it doesn't exist yet. */
async function ensureDatabase(): Promise<void> {
  const url = new URL(E2E_DATABASE_URL);
  const databaseName = url.pathname.slice(1);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (!rowCount) await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }
}

/** Applies every pending migration to the e2e database (a no-op when up to date). */
function migrateDatabase(): void {
  execSync(`bunx prisma db migrate --db "${E2E_DATABASE_URL}" --yes`, {
    cwd: PRISMA_PACKAGE_DIR,
    stdio: 'inherit',
  });
}

/** Jest `globalSetup`: runs once before the e2e suite. */
export default async function setupE2e(): Promise<void> {
  await ensureDatabase();
  migrateDatabase();
}
