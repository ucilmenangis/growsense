// Dashboard migration: Pemdes role, follow up notes, and posyandu_monthly against core's monthlyStats.
import type { PGlite } from '@electric-sql/pglite'
import {
  demoDataset,
  dusunQuarter,
  lastCompletedQuarter,
  lastMonths,
  monthlyStats,
  quarterMonths,
  todayIso,
  villageMonthly,
  type AreaStat,
  type MonthlyStat,
} from '@growsense/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, migratedDb } from './helpers'

// dusun_quarterly reads current_date, so the example data is built around the real date.
const TODAY = todayIso()
const data = demoDataset(TODAY)
const ids = {
  pkm2: '10000000-0000-4000-8000-000000000002',
  posOther: '20000000-0000-4000-8000-0000000000ff',
  kader: '30000000-0000-4000-8000-00000000000a',
  bidan: '30000000-0000-4000-8000-0000000000b1',
  pemdes: '30000000-0000-4000-8000-0000000000c1',
  otherBidan: '30000000-0000-4000-8000-0000000000b2',
}

let db: PGlite
const as = <T>(user: string, run: () => Promise<T>) => asUser(db, user, run)

async function insertMany(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0]!)
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const params: unknown[] = []
    const values = chunk.map(
      (row) =>
        `(${cols.map((c) => `$${params.push(c === 'risk_factors' ? JSON.stringify(row[c]) : row[c])}`).join(', ')})`,
    )
    await db.query(`insert into ${table} (${cols.join(', ')}) values ${values.join(', ')}`, params)
  }
}

beforeAll(async () => {
  db = await migratedDb()
  await db.exec(`
    insert into auth.users values ('${ids.kader}'), ('${ids.bidan}'), ('${ids.pemdes}'), ('${ids.otherBidan}');
    insert into puskesmas (id, name) values ('${data.puskesmas.id}', 'P1'), ('${ids.pkm2}', 'P2');
  `)
  await insertMany(
    'posyandu',
    data.posyandu.map((p) => ({ ...p, puskesmas_id: data.puskesmas.id })),
  )
  await db.exec(`
    insert into posyandu (id, puskesmas_id, name) values ('${ids.posOther}', '${ids.pkm2}', 'Lain');
    insert into profiles (id, role, full_name, puskesmas_id, posyandu_id) values
      ('${ids.kader}', 'kader', 'Kader', '${data.puskesmas.id}', '${data.posyandu[0]!.id}'),
      ('${ids.bidan}', 'bidan', 'Bidan', '${data.puskesmas.id}', null),
      ('${ids.pemdes}', 'pemdes', 'Kepala Desa', '${data.puskesmas.id}', null),
      ('${ids.otherBidan}', 'bidan', 'Bidan lain', '${ids.pkm2}', null);
  `)
  await insertMany(
    'children',
    data.children.map(({ created_at, updated_at, ...c }) => c),
  )
  await insertMany(
    'measurements',
    data.measurements.map(({ created_at, updated_at, ...m }) => m),
  )
})

const monthly = (from: string, to: string) =>
  db.query<Omit<MonthlyStat, 'factors'> & { factors: MonthlyStat['factors'] }>(
    'select * from posyandu_monthly($1, $2)',
    [from, to],
  )

describe('posyandu_monthly', () => {
  it('gives the same figures as monthlyStats in core', async () => {
    const months = lastMonths(TODAY, 12)
    const sql = (await as(ids.bidan, () => monthly(`${months[0]}-01`, TODAY))).rows
    const core = monthlyStats(
      data.posyandu.map((p) => p.id),
      data.children,
      data.measurements,
      months,
    )
    const key = (r: { posyandu_id: string; month: string }) => `${r.posyandu_id}|${r.month}`
    expect(sql).toHaveLength(core.length)
    const byKey = new Map(sql.map((r) => [key(r), r]))
    for (const c of core) expect(byKey.get(key(c)), key(c)).toEqual(c)
    expect(core.some((c) => c.stunting > 0 && c.factors.sanitasi_layak.no > 0)).toBe(true)
  })

  it('is closed to pemdes and kader', async () => {
    expect((await as(ids.pemdes, () => monthly('2026-09-01', '2026-09-30'))).rows).toEqual([])
    expect((await as(ids.kader, () => monthly('2026-09-01', '2026-09-30'))).rows).toEqual([])
  })

  it('covers only the caller puskesmas', async () => {
    const other = (await as(ids.otherBidan, () => monthly('2026-09-01', '2026-09-30'))).rows
    expect(other.map((r) => r.posyandu_id)).toEqual([ids.posOther])
    expect(other[0]?.sasaran).toBe(0)
  })

  it('is not callable without login, and the internal helpers are not callable at all', async () => {
    await db.exec('set role anon')
    try {
      await expect(db.query(`select * from posyandu_monthly('2026-09-01', '2026-09-30')`)).rejects.toThrow(
        /permission denied/,
      )
    } finally {
      await db.exec('reset role')
    }
    await expect(
      as(ids.bidan, () =>
        db.query(`select * from monthly_counts($1, '2026-09-01', '2026-09-30')`, [data.puskesmas.id]),
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(ids.pemdes, () => db.query(`select * from area_counts('2026-09-01', '2026-09-30')`)),
    ).rejects.toThrow(/permission denied/)
  })
})

const allMonthly = (months: string[]) =>
  monthlyStats(
    data.posyandu.map((p) => p.id),
    data.children,
    data.measurements,
    months,
  )

const health = ['stunting', 'sangat_pendek', 'wasting', 'underweight'] as const
const factorKeys = ['asi_eksklusif', 'mpasi_adekuat', 'imunisasi_lengkap', 'sanitasi_layak'] as const
const valuesOf = (r: AreaStat) => [...health.map((k) => r[k]), ...factorKeys.map((k) => r.factors[k].no)]

describe('village_monthly', () => {
  const months = lastMonths(TODAY, 12)
  // Whole quarters around the twelve months, as the SQL does.
  const wide = [
    ...new Set(
      months.flatMap((m) => quarterMonths(`${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5)) - 1) / 3) + 1}`)),
    ),
  ]
  const core = villageMonthly(allMonthly(wide), months, TODAY)
  const running = quarterMonths(`${TODAY.slice(0, 4)}-Q${Math.floor((Number(TODAY.slice(5, 7)) - 1) / 3) + 1}`)

  it('gives pemdes the same figures as core', async () => {
    const sql = (
      await as(ids.pemdes, () =>
        db.query<AreaStat>('select * from village_monthly($1, $2)', [`${months[0]}-01`, TODAY]),
      )
    ).rows
    expect(sql).toEqual(core)
    expect(core).toHaveLength(12 - running.filter((m) => months.includes(m)).length)
    expect(core.every((r) => r.area === null && !running.includes(r.month))).toBe(true)
  })

  it('hides a count for the whole quarter or not at all', () => {
    const byQuarter = new Map<string, AreaStat[]>()
    for (const r of core) {
      const q = `${r.month.slice(0, 4)}-${Math.floor((Number(r.month.slice(5)) - 1) / 3)}`
      byQuarter.set(q, [...(byQuarter.get(q) ?? []), r])
    }
    let hidden = 0
    for (const rows of byQuarter.values()) {
      for (let i = 0; i < 8; i++) {
        const n = rows.filter((r) => valuesOf(r)[i] === null).length
        expect([0, rows.length]).toContain(n)
        hidden += n
      }
    }
    expect(hidden).toBeGreaterThan(0)
  })

  it('gives kader nothing', async () => {
    expect(
      (await as(ids.kader, () => db.query('select * from village_monthly($1, $2)', [`${months[0]}-01`, TODAY]))).rows,
    ).toEqual([])
  })
})

describe('dusun_quarterly', () => {
  const quarter = lastCompletedQuarter(TODAY)
  const core = dusunQuarter(data.posyandu, allMonthly(quarterMonths(quarter)), quarter)
  const call = (date: string) => db.query<AreaStat>('select * from dusun_quarterly($1)', [date])

  it('gives pemdes the same figures as core for the last completed quarter', async () => {
    const sql = (await as(ids.pemdes, () => call(`${quarterMonths(quarter)[1]}-15`))).rows
    expect(sql).toEqual(core)
    expect(core).toHaveLength(6)
    expect(core.filter((r) => r.area !== null).every((r) => r.stunting !== null)).toBe(true)
  })

  it('hides a count for every dusun or none', () => {
    const dusun = core.filter((r) => r.area !== null)
    for (let i = 0; i < 8; i++) expect([0, dusun.length]).toContain(dusun.filter((r) => valuesOf(r)[i] === null).length)
  })

  it('answers nothing for the quarter still running', async () => {
    expect((await as(ids.pemdes, () => call(TODAY))).rows).toEqual([])
  })

  it('gives kader nothing', async () => {
    expect((await as(ids.kader, () => call(`${quarterMonths(quarter)[0]}-01`))).rows).toEqual([])
  })
})

describe('pemdes', () => {
  it('sees the posyandu list but no child and no measurement', async () => {
    const counts = await as(ids.pemdes, async () => ({
      posyandu: (await db.query('select id from posyandu')).rows.length,
      children: (await db.query('select id from children')).rows.length,
      measurements: (await db.query('select id from measurements')).rows.length,
    }))
    expect(counts).toEqual({ posyandu: 15, children: 0, measurements: 0 })
  })
})

describe('follow_ups', () => {
  const child = data.children.find((c) => c.posyandu_id === data.posyandu[0]!.id)!
  const add = (id: string) =>
    db.query(`insert into follow_ups (id, child_id, stage, done_at, actions) values ($1, $2, 'rujukan', $3, $4)`, [
      id,
      child.id,
      TODAY,
      ['Rujuk ke dokter Puskesmas'],
    ])

  it('bidan writes a note and the server stamps the author', async () => {
    const id = '60000000-0000-4000-8000-000000000001'
    await as(ids.bidan, () => add(id))
    const row = (await db.query<{ recorded_by: string }>('select recorded_by from follow_ups where id = $1', [id]))
      .rows[0]
    expect(row?.recorded_by).toBe(ids.bidan)
  })

  it('kader can read the notes of their posyandu but not write', async () => {
    await expect(as(ids.kader, () => add('60000000-0000-4000-8000-000000000002'))).rejects.toThrow(/row-level security/)
    const seen = await as(ids.kader, () => db.query('select id from follow_ups'))
    expect(seen.rows).toHaveLength(1)
  })

  it('a bidan of another puskesmas cannot write', async () => {
    await expect(as(ids.otherBidan, () => add('60000000-0000-4000-8000-000000000003'))).rejects.toThrow(
      /row-level security/,
    )
  })
})
