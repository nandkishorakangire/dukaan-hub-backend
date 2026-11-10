/**
 * Environment used by e2e tests. These are throwaway values; no real database
 * is required because the health endpoint tolerates a down connection.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://dukaanhub:dukaanhub@127.0.0.1:5432/dukaanhub?schema=public&connect_timeout=1';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-characters-long';
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads-test';
process.env.PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? 'test-webhook-secret';
