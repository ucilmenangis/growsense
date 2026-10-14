// PGlite with a minimal stand-in for Supabase auth and every migration applied.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const dir = join(import.meta.dirname, '..', 'migrations')

const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
`

export async function migratedDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(AUTH_STUB)
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'))
  }
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
  `)
  return db
}

/** Runs `run` as the given user under the authenticated role, the way PostgREST does. */
export async function asUser<T>(db: PGlite, user: string, run: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user])
  await db.exec('set role authenticated')
  try {
    return await run()
  } finally {
    await db.exec('reset role')
  }
}
