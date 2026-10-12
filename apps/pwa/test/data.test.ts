import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { GrowSenseDb } from '../src/data/db'
import { addChild, measurementsOf, recordMeasurement, updateChild } from '../src/data/repo'
import { pull, push, sync } from '../src/data/sync'
import { FakeRemote } from './fakeRemote'

const POSYANDU = '20000000-0000-4000-8000-00000000000a'
let db: GrowSenseDb
let remote: FakeRemote
let n = 0

beforeEach(() => {
  db = new GrowSenseDb(`test-${++n}`)
  remote = new FakeRemote()
})

const newChild = () =>
  addChild(db, { posyandu_id: POSYANDU, full_name: ' Rayhan ', sex: 'male', birth_date: '2024-08-15' })

describe('recordMeasurement', () => {
  it('stores rounded z-scores computed by core', async () => {
    const child = await newChild()
    const { row } = await recordMeasurement(db, {
      child_id: child.id,
      measured_at: '2026-08-15',
      weight_kg: 12.1482,
      height_cm: 87.8018,
    })
    expect(row.haz).toBe(0)
    expect(row.waz).toBe(0)
    expect(row.position).toBe('recumbent')
    expect(row.dirty).toBe(1)
    expect(child.full_name).toBe('Rayhan')
  })

  it('flags a height drop against the previous visit', async () => {
    const child = await newChild()
    await recordMeasurement(db, { child_id: child.id, measured_at: '2026-09-14', height_cm: 82.8 })
    const { row } = await recordMeasurement(db, { child_id: child.id, measured_at: '2026-10-14', height_cm: 82.1 })
    expect(row.flags).toContain('tinggi_turun')
  })

  it('compares with the visit before the given date, not the latest entry', async () => {
    const child = await newChild()
    await recordMeasurement(db, { child_id: child.id, measured_at: '2026-10-14', height_cm: 90 })
    const { row } = await recordMeasurement(db, { child_id: child.id, measured_at: '2026-09-14', height_cm: 85 })
    expect(row.flags).not.toContain('tinggi_turun')
    expect((await measurementsOf(db, child.id)).map((m) => m.measured_at)).toEqual(['2026-09-14', '2026-10-14'])
  })

  it('rejects an unknown child', async () => {
    await expect(recordMeasurement(db, { child_id: 'nope', measured_at: '2026-10-14' })).rejects.toThrow()
  })
})

describe('push', () => {
  it('sends children before measurements and clears dirty', async () => {
    const child = await newChild()
    await recordMeasurement(db, { child_id: child.id, measured_at: '2026-10-14', weight_kg: 11 })
    expect(await push(db, remote)).toBe(2)
    expect(remote.upserts.map((u) => u.table)).toEqual(['children', 'measurements'])
    expect(await db.children.where('dirty').equals(1).count()).toBe(0)
    expect(await db.measurements.where('dirty').equals(1).count()).toBe(0)
  })

  it('never sends local bookkeeping or server owned columns', async () => {
    await newChild()
    await push(db, remote)
    const sent = remote.upserts[0]!.rows[0]!
    for (const column of ['dirty', 'rev', 'updated_at', 'created_at', 'created_by'])
      expect(sent).not.toHaveProperty(column)
  })

  it('keeps rows dirty when the request fails', async () => {
    await newChild()
    remote.failNext = true
    await expect(push(db, remote)).rejects.toThrow('network down')
    expect(await db.children.where('dirty').equals(1).count()).toBe(1)
  })

  it('resends a row edited while its push was in flight', async () => {
    const child = await newChild()
    let edited = false
    remote.onUpsert = async () => {
      if (edited) return
      edited = true
      await updateChild(db, child.id, { full_name: 'Rayhan Putra' })
    }
    await push(db, remote)
    expect(remote.upserts).toHaveLength(2)
    expect(remote.tables.children.get(child.id)?.full_name).toBe('Rayhan Putra')
    expect((await db.children.get(child.id))?.dirty).toBe(0)
  })
})

describe('pull', () => {
  const serverChild = (id: string, name: string) => ({
    id,
    posyandu_id: POSYANDU,
    full_name: name,
    nik: null,
    sex: 'female',
    birth_date: '2025-01-01',
    mother_name: null,
    birth_weight_kg: null,
    consent_at: null,
    deleted_at: null,
  })

  it('pages through more rows than one batch, even when they share a timestamp', async () => {
    const rows = Array.from({ length: 450 }, (_, i) =>
      serverChild(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, `Anak ${i}`),
    )
    remote.serverWrite('children', rows)
    expect(await pull(db, remote)).toBe(450)
    expect(await db.children.count()).toBe(450)
  })

  it('does not overwrite unsent local edits', async () => {
    const child = await newChild()
    remote.serverWrite('children', [serverChild(child.id, 'Versi server')])
    await pull(db, remote)
    expect((await db.children.get(child.id))?.full_name).toBe('Rayhan')
  })

  it('takes server changes made on another device after the last sync', async () => {
    const child = await newChild()
    await sync(db, remote)
    remote.serverWrite('children', [serverChild(child.id, 'Diubah bidan')])
    await sync(db, remote)
    const local = await db.children.get(child.id)
    expect(local?.full_name).toBe('Diubah bidan')
    expect(local?.dirty).toBe(0)
  })

  it('picks up a late commit carrying an older timestamp', async () => {
    remote.serverWrite('children', [serverChild('00000000-0000-4000-8000-0000000000b2', 'Baru')])
    await pull(db, remote)
    // Committed after the pull, but stamped 30 s before the newest row the client saw.
    const late = {
      ...serverChild('00000000-0000-4000-8000-0000000000a1', 'Telat'),
      updated_at: new Date(remote.clock - 30_000).toISOString(),
    }
    remote.tables.children.set(late.id, late)
    await pull(db, remote)
    expect((await db.children.get(late.id))?.full_name).toBe('Telat')
  })
})

describe('sync', () => {
  it('shares one run between concurrent calls', async () => {
    await newChild()
    const [a, b] = await Promise.all([sync(db, remote), sync(db, remote)])
    expect(a).toBe(b)
    expect(remote.upserts).toHaveLength(1)
  })
})
