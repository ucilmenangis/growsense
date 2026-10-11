// Offline sync: push local changes first, then pull server changes. Last write wins.
import { SERVER_COLUMNS, type SyncTable } from '@growsense/core'
import type { GrowSenseDb, LocalFields } from './db'

/** Keyset position in a table ordered by (updated_at, id). */
export interface Cursor {
  at: string
  id: string
}

export interface RemoteRow {
  id: string
  updated_at: string
  [column: string]: unknown
}

export interface Remote {
  upsert(table: SyncTable, rows: Record<string, unknown>[]): Promise<void>
  /** Rows after `cursor` in (updated_at, id) order, at most `limit`. */
  pullSince(table: SyncTable, cursor: Cursor | null, limit: number): Promise<RemoteRow[]>
}

/** Parents before children so foreign keys hold on the server. */
const TABLES: SyncTable[] = ['children', 'measurements']
const BATCH = 200
export const MIN_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Each pull re-reads this window before the saved cursor. A transaction that started
 * earlier but committed later carries an older updated_at and would otherwise be skipped.
 */
export const REWIND_MS = 2 * 60_000

type LocalRow = { id: string } & LocalFields

function toRemote(row: LocalRow): Record<string, unknown> {
  const { dirty: _dirty, rev: _rev, ...rest } = row
  const out: Record<string, unknown> = rest
  for (const column of SERVER_COLUMNS) delete out[column]
  return out
}

export async function push(db: GrowSenseDb, remote: Remote): Promise<number> {
  let pushed = 0
  for (const name of TABLES) {
    const table = db.table<LocalRow, string>(name)
    for (;;) {
      const batch = await table.where('dirty').equals(1).limit(BATCH).toArray()
      if (batch.length === 0) break
      await remote.upsert(name, batch.map(toRemote))
      await db.transaction('rw', table, async () => {
        for (const sent of batch) {
          const current = await table.get(sent.id)
          // Edited again while the request was in flight: keep it dirty for the next round.
          if (current && current.rev === sent.rev) await table.update(sent.id, { dirty: 0 })
        }
      })
      pushed += batch.length
    }
  }
  return pushed
}

function rewind(cursor: Cursor): Cursor {
  return { at: new Date(Date.parse(cursor.at) - REWIND_MS).toISOString(), id: MIN_ID }
}

export async function pull(db: GrowSenseDb, remote: Remote): Promise<number> {
  let pulled = 0
  for (const name of TABLES) {
    const table = db.table<LocalRow, string>(name)
    const key = `cursor:${name}`
    const saved = await db.meta.get(key)
    let cursor: Cursor | null = saved ? rewind(JSON.parse(saved.value) as Cursor) : null
    let last: Cursor | null = saved ? (JSON.parse(saved.value) as Cursor) : null

    for (;;) {
      const rows = await remote.pullSince(name, cursor, BATCH)
      await db.transaction('rw', table, async () => {
        for (const row of rows) {
          const local = await table.get(row.id)
          // Unsent local edits win; they reach the server on the next push.
          if (local?.dirty) continue
          await table.put({ ...row, dirty: 0, rev: local?.rev ?? 0 } as LocalRow)
        }
      })
      pulled += rows.length
      const tail = rows.at(-1)
      if (tail) {
        cursor = { at: tail.updated_at, id: tail.id }
        if (!last || Date.parse(tail.updated_at) >= Date.parse(last.at)) last = cursor
      }
      if (rows.length < BATCH) break
    }
    if (last) await db.meta.put({ key, value: JSON.stringify(last) })
  }
  return pulled
}

const running = new WeakMap<GrowSenseDb, Promise<{ pushed: number; pulled: number }>>()

/** Push then pull. Concurrent calls share the run already in progress. */
export function sync(db: GrowSenseDb, remote: Remote): Promise<{ pushed: number; pulled: number }> {
  const current = running.get(db)
  if (current) return current
  const run = (async () => {
    const pushed = await push(db, remote)
    const pulled = await pull(db, remote)
    return { pushed, pulled }
  })().finally(() => running.delete(db))
  running.set(db, run)
  return run
}
