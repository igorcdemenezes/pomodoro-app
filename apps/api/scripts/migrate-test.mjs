/**
 * Applies pending migrations to the test database.
 *
 * Runs as a `pretest` hook so a schema change can never be forgotten before a
 * suite runs, which would otherwise surface as unrelated 500s. The redirect
 * happens here rather than in the npm script because a shell-portable way to
 * override one variable would need an extra dependency.
 */
import { spawnSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error('TEST_DATABASE_URL or DATABASE_URL must be set');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
