import type { SyncTable } from '@growsense/core'
import type { Cursor, Remote, RemoteRow } from '../src/data/sync'

/** In-memory server. Like Postgres now(), every row in one upsert call shares a timestamp. */
export class FakeRemote implements Remote {
  tables: Record<SyncTable, Map<string, RemoteRow>> = { children: new Map(), measurements: new Map() }
  clock = Date.parse('2026-10-12T00:00:00Z')
  upserts: { table: SyncTable; rows: Record<string, unknown>[] }[] = []
  failNext = false
  /** Runs after the server stored the rows, before the client hears back. */
  onUpsert?: () => Promise<void>

  private tick() {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  async upsert(table: SyncTable, rows: Record<string, unknown>[]) {
    if (this.failNext) {
      this.failNext = false
      throw new Error('network down')
    }
    this.upserts.push({ table, rows })
    const at = this.tick()
    for (const row of rows) {
      const id = row.id as string
      const existing = this.tables[table].get(id)
      this.tables[table].set(id, { ...existing, ...row, id, updated_at: at })
    }
    await this.onUpsert?.()
  }

  /** A write made on another device. */
  serverWrite(table: SyncTable, rows: Record<string, unknown>[]) {
    const at = this.tick()
    for (const row of rows) this.tables[table].set(row.id as string, { ...row, id: row.id as string, updated_at: at })
  }

  async pullSince(table: SyncTable, cursor: Cursor | null, limit: number) {
    return [...this.tables[table].values()]
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))
      .filter((r) => !cursor || r.updated_at > cursor.at || (r.updated_at === cursor.at && r.id > cursor.id))
      .slice(0, limit)
  }
}
