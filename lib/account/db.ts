import { neon } from "@neondatabase/serverless";

/**
 * Server-side account database (Neon Postgres).
 *
 * The connection string is a server-only secret: this module must never be
 * imported from client code. Every query uses parameterized statements.
 */

const readDatabaseUrl = (): string => {
  const value = process.env.DATABASE_URL;
  if (!value || value.trim().length === 0) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return value;
};

export const getSql = () => {
  if (!cachedSql) {
    // The neon template tag resolves to the row array for default (non-full)
    // queries; the driver's declared union type is narrowed here once so every
    // call site sees Record<string, unknown> rows.
    cachedSql = neon(readDatabaseUrl()) as unknown as SqlTag;
  }
  return cachedSql;
};

let cachedSql: SqlTag | null = null;

type QueryRow = Record<string, unknown>;

export type SqlTag = (
  strings: TemplateStringsArray,
  ...params: unknown[]
) => Promise<QueryRow[]>;

/**
 * Applies the account schema. Idempotent and cache-guarded per process: the
 * first call of a server instance runs the DDL and every later call awaits
 * that same promise, so request latency does not pay seven `CREATE TABLE IF
 * NOT EXISTS` statements per request.
 */
let schemaRunPromise: Promise<void> | null = null;

export const ensureAccountSchema = async (): Promise<void> => {
  // Pooling to a single run even under concurrent cold-start requests.
  if (!schemaRunPromise) {
    schemaRunPromise = runAccountSchema().catch((error: unknown) => {
      schemaRunPromise = null; // next request retries the bootstrap
      throw error;
    });
  }
  return schemaRunPromise;
};

const runAccountSchema = async (): Promise<void> => {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS account_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      recovery_token_hash TEXT,
      recovery_expires_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      device_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account_library (
      profile_id TEXT NOT NULL REFERENCES account_profiles(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_path TEXT,
      backdrop_path TEXT,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (profile_id, media_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account_progress (
      profile_id TEXT NOT NULL REFERENCES account_profiles(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      title TEXT NOT NULL,
      poster_path TEXT,
      backdrop_path TEXT,
      season INTEGER,
      episode INTEGER,
      chapter_id TEXT,
      position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
      duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
      percent INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (profile_id, media_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account_settings (
      profile_id TEXT NOT NULL REFERENCES account_profiles(id) ON DELETE CASCADE,
      settings JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (profile_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS account_sessions_user_idx ON account_sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS account_progress_profile_idx ON account_progress(profile_id)`;
};
