// Applies the migrations to PGlite, then checks RLS.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, migratedDb } from './helpers'

const ids = {
  pkm1: '10000000-0000-4000-8000-000000000001',
  pkm2: '10000000-0000-4000-8000-000000000002',
  posA: '20000000-0000-4000-8000-00000000000a',
  posB: '20000000-0000-4000-8000-00000000000b',
  posC: '20000000-0000-4000-8000-00000000000c',
  kaderA: '30000000-0000-4000-8000-00000000000a',
  bidan1: '30000000-0000-4000-8000-0000000000b1',
  childA: '40000000-0000-4000-8000-00000000000a',
  childB: '40000000-0000-4000-8000-00000000000b',
  childC: '40000000-0000-4000-8000-00000000000c',
}

let db: PGlite

const as = <T>(user: string, run: () => Promise<T>) => asUser(db, user, run)

const childNames = async () =>
  (await db.query<{ full_name: string }>('select full_name from children order by full_name')).rows.map(
    (r) => r.full_name,
  )

beforeAll(async () => {
  db = await migratedDb()
  await db.exec(`
    insert into auth.users values ('${ids.kaderA}'), ('${ids.bidan1}');
    insert into puskesmas (id, name) values ('${ids.pkm1}', 'P1'), ('${ids.pkm2}', 'P2');
    insert into posyandu (id, puskesmas_id, name) values
      ('${ids.posA}', '${ids.pkm1}', 'A'), ('${ids.posB}', '${ids.pkm1}', 'B'), ('${ids.posC}', '${ids.pkm2}', 'C');
    insert into profiles (id, role, full_name, puskesmas_id, posyandu_id) values
      ('${ids.kaderA}', 'kader', 'Kader A', '${ids.pkm1}', '${ids.posA}'),
      ('${ids.bidan1}', 'bidan', 'Bidan 1', '${ids.pkm1}', null);
    insert into children (id, posyandu_id, full_name, sex, birth_date) values
      ('${ids.childA}', '${ids.posA}', 'Anak A', 'male', '2025-01-01'),
      ('${ids.childB}', '${ids.posB}', 'Anak B', 'female', '2025-01-01'),
      ('${ids.childC}', '${ids.posC}', 'Anak C', 'male', '2025-01-01');
  `)
})

describe('row level security', () => {
  it('kader sees only children of their own posyandu', async () => {
    expect(await as(ids.kaderA, childNames)).toEqual(['Anak A'])
  })

  it('bidan sees every posyandu under their puskesmas', async () => {
    expect(await as(ids.bidan1, childNames)).toEqual(['Anak A', 'Anak B'])
  })

  it('kader cannot add a child to another posyandu', async () => {
    await expect(
      as(ids.kaderA, () =>
        db.query(
          `insert into children (id, posyandu_id, full_name, sex, birth_date)
           values (gen_random_uuid(), $1, 'Titipan', 'male', '2025-01-01')`,
          [ids.posB],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('kader cannot record a measurement for a child outside their posyandu', async () => {
    await expect(
      as(ids.kaderA, () =>
        db.query(`insert into measurements (id, child_id, measured_at) values (gen_random_uuid(), $1, '2026-10-01')`, [
          ids.childC,
        ]),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('kader can upsert a measurement for their own child and recorded_by is filled', async () => {
    const id = '50000000-0000-4000-8000-000000000001'
    const upsert = `
      insert into measurements (id, child_id, measured_at, weight_kg) values ($1, $2, '2026-10-01', $3)
      on conflict (id) do update set weight_kg = excluded.weight_kg`
    await as(ids.kaderA, () => db.query(upsert, [id, ids.childA, 9.1]))
    await as(ids.kaderA, () => db.query(upsert, [id, ids.childA, 9.2]))
    const row = (
      await db.query<{ weight_kg: string; recorded_by: string }>(
        'select weight_kg, recorded_by from measurements where id = $1',
        [id],
      )
    ).rows[0]
    expect(Number(row?.weight_kg)).toBe(9.2)
    expect(row?.recorded_by).toBe(ids.kaderA)
  })
})

describe('authorship', () => {
  it('ignores a forged recorded_by and created_at on insert', async () => {
    const id = '50000000-0000-4000-8000-000000000002'
    await as(ids.kaderA, () =>
      db.query(
        `insert into measurements (id, child_id, measured_at, recorded_by, created_at)
         values ($1, $2, '2026-10-02', $3, '2000-01-01')`,
        [id, ids.childA, ids.bidan1],
      ),
    )
    const row = (
      await db.query<{ recorded_by: string; created_at: Date }>(
        'select recorded_by, created_at from measurements where id = $1',
        [id],
      )
    ).rows[0]
    expect(row?.recorded_by).toBe(ids.kaderA)
    expect(row!.created_at.getFullYear()).toBeGreaterThan(2000)
  })

  it('keeps the original author when another user edits', async () => {
    const id = '40000000-0000-4000-8000-0000000000a2'
    await as(ids.kaderA, () =>
      db.query(
        `insert into children (id, posyandu_id, full_name, sex, birth_date) values ($1, $2, 'Anak A2', 'male', '2025-02-01')`,
        [id, ids.posA],
      ),
    )
    await as(ids.bidan1, () =>
      db.query(`update children set full_name = 'Anak A2 edit', created_by = $2 where id = $1`, [id, ids.bidan1]),
    )
    const row = (
      await db.query<{ created_by: string; full_name: string }>(
        'select created_by, full_name from children where id = $1',
        [id],
      )
    ).rows[0]
    expect(row).toEqual({ created_by: ids.kaderA, full_name: 'Anak A2 edit' })
  })
})

describe('updated_at', () => {
  it('ignores the client value and uses the server clock', async () => {
    await db.query(`update children set full_name = 'Anak A', updated_at = '2000-01-01' where id = $1`, [ids.childA])
    const row = (await db.query<{ updated_at: Date }>('select updated_at from children where id = $1', [ids.childA]))
      .rows[0]
    expect(row!.updated_at.getFullYear()).toBeGreaterThan(2000)
  })
})

describe('constraints', () => {
  it('rejects a malformed NIK', async () => {
    await expect(db.query(`update children set nik = '12345' where id = $1`, [ids.childA])).rejects.toThrow(
      /check constraint/,
    )
  })
})
