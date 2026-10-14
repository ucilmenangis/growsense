import { describe, expect, it } from 'vitest'
import {
  byPriority,
  demoDataset,
  lastMonths,
  monthEnd,
  monthlyStats,
  needsAttention,
  sumStats,
  summarize,
  type ChildRow,
  type MeasurementRow,
} from '../src'

const child = (id: string, birth: string, extra: Partial<ChildRow> = {}): ChildRow => ({
  id,
  posyandu_id: 'p1',
  full_name: id,
  nik: null,
  sex: 'male',
  birth_date: birth,
  mother_name: null,
  birth_weight_kg: null,
  consent_at: null,
  deleted_at: null,
  ...extra,
})

const visit = (
  child_id: string,
  measured_at: string,
  z: [number, number, number],
  extra: Partial<MeasurementRow> = {},
) =>
  ({
    id: `${child_id}-${measured_at}`,
    child_id,
    measured_at,
    weight_kg: 10,
    height_cm: 80,
    position: 'recumbent',
    risk_factors: {},
    haz: z[0],
    waz: z[1],
    whz: z[2],
    flags: [],
    note: null,
    deleted_at: null,
    ...extra,
  }) as MeasurementRow

describe('month helpers', () => {
  it('lists months across a year boundary', () => {
    expect(lastMonths('2026-02-14', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthEnd('2024-02')).toBe('2024-02-29')
  })
})

describe('monthlyStats', () => {
  const kids = [
    child('a', '2025-01-10'),
    child('b', '2021-09-01'), // turns five in September 2026
    child('c', '2026-10-20'), // born after the end of September
    child('d', '2025-01-01', { deleted_at: '2026-01-01' }),
  ]
  const visits = [
    visit('a', '2026-09-03', [-1.5, -1, -1]),
    visit('a', '2026-09-20', [-2.4, -2.1, -2.2], { risk_factors: { sanitasi_layak: false, mpasi_adekuat: true } }),
    visit('b', '2026-08-05', [-3.5, -1, 0], { flags: [] }),
    visit('b', '2026-09-05', [-7, -1, 0], { flags: ['haz_tidak_wajar'] }),
    visit('d', '2026-09-05', [-3, -3, -3]),
  ]
  const [aug, sep] = monthlyStats(['p1'], kids, visits, ['2026-08', '2026-09'])

  it('counts children under five at the end of the month', () => {
    expect(aug!.sasaran).toBe(2)
    expect(sep!.sasaran).toBe(1)
  })

  it('uses the last visit of the month and leaves out implausible values', () => {
    expect(sep).toMatchObject({ ditimbang: 1, stunting: 1, sangat_pendek: 0, wasting: 1, underweight: 1 })
    expect(aug).toMatchObject({ ditimbang: 1, stunting: 1, sangat_pendek: 1 })
    expect(sep!.factors.sanitasi_layak).toEqual({ no: 1, answered: 1 })
    expect(sep!.factors.mpasi_adekuat).toEqual({ no: 0, answered: 1 })
    expect(sep!.factors.asi_eksklusif).toEqual({ no: 0, answered: 0 })
  })

  it('sums rows', () => {
    expect(sumStats([aug!, sep!])).toMatchObject({ sasaran: 3, ditimbang: 2, stunting: 2 })
  })
})

describe('demoDataset', () => {
  const data = demoDataset('2026-10-14')

  it('is the same on every call', () => {
    expect(demoDataset('2026-10-14').measurements).toEqual(data.measurements)
  })

  it('has 15 posyandu, a spread of risk levels and some flagged entries', () => {
    expect(data.posyandu).toHaveLength(15)
    const list = summarize(data.children, data.measurements, '2026-10-14')
    expect(list.length).toBeGreaterThan(120)
    const levels = new Set(list.map((s) => s.warning.level))
    for (const level of ['tinggi', 'sedang', 'rendah'] as const) expect(levels.has(level)).toBe(true)
    expect(list.filter(needsAttention).length).toBeGreaterThan(15)
    expect(byPriority(list)[0]!.warning.level).toBe('tinggi')
    expect(data.measurements.some((m) => m.flags.length > 0)).toBe(true)
    expect(data.followUps.length).toBeGreaterThan(5)
  })

  it('keeps stunting prevalence in a believable range', () => {
    const month = '2026-09'
    const total = sumStats(
      monthlyStats(
        data.posyandu.map((p) => p.id),
        data.children,
        data.measurements,
        [month],
      ),
    )
    const prevalence = total.stunting / total.ditimbang
    expect(prevalence).toBeGreaterThan(0.1)
    expect(prevalence).toBeLessThan(0.4)
    expect(total.ditimbang / total.sasaran).toBeGreaterThan(0.6)
  })
})
