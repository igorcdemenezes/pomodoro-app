/**
 * Integration specs must never touch the development database.
 *
 * The root .env is loaded by dotenv-cli in the npm script; this redirects the
 * connection to TEST_DATABASE_URL so a suite that truncates tables cannot
 * destroy data the developer is looking at.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set to run the test suite');
}
