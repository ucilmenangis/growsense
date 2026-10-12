import { describe, expect, it } from 'vitest'
import type { LocalChild, LocalMeasurement } from '../src/data/db'
import { byPriority, summarize } from '../src/data/queries'
import { monthlyCsv } from '../src/lib/exportCsv'
import { ageLabel, ageMonths, parseDecimal } from '../src/lib/format'
import { recommendations } from '../src/lib/recommendations'

const child = (id: string, name: string, birth = '2024-10-12'): LocalChild => ({
  id,
  posyandu_id: 'p',
  full_name: name,
  nik: null,
  sex: 'male',
  birth_date: birth,
  mother_name: 'Siti, "Ibu"',
  birth_weight_kg: null,
  consent_at: null,
  deleted_at: null,
  dirty: 0,
  rev: 1,
})

const measurement = (
  childId: string,
  date: string,
  haz: number,
  extra: Partial<LocalMeasurement> = {},
): LocalMeasurement => ({
  id: `${childId}-${date}`,
  child_id: childId,
  measured_at: date,
  weight_kg: 11,
  height_cm: 85,
  position: 'standing',
  risk_factors: {},
  haz,
  waz: 0,
  whz: 0,
  flags: [],
  note: null,
  deleted_at: null,
  dirty: 0,
  rev: 1,
  ...extra,
})

describe('format', () => {
  it('counts age in completed calendar months', () => {
    expect(ageMonths('2024-10-12', '2026-10-12')).toBe(24)
    expect(ageMonths('2024-10-12', '2026-10-11')).toBe(23)
    expect(ageLabel('2024-10-12', '2026-10-12')).toBe('2 th')
    expect(ageLabel('2024-07-12', '2026-10-12')).toBe('2 th 3 bln')
    expect(ageLabel('2025-08-01', '2026-10-12')).toBe('14 bln')
  })

  it('reads decimal comma and dot', () => {
    expect(parseDecimal('10,5')).toBe(10.5)
    expect(parseDecimal('10.5')).toBe(10.5)
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
  })
})

describe('summarize', () => {
  const kids = [
    child('a', 'Budi'),
    child('b', 'Ani'),
    child('c', 'Cici', '2020-01-01'),
    { ...child('d', 'Dodi'), deleted_at: 'x' },
  ]
  const list = summarize(
    kids,
    [
      measurement('a', '2026-07-12', -0.9),
      measurement('a', '2026-10-12', -1.6),
      measurement('b', '2026-09-12', 0.1),
      measurement('b', '2026-08-12', 0.0, { deleted_at: '2026-09-01' }),
    ],
    '2026-10-20',
  )

  it('drops deleted children, deleted measurements, and children over five years', () => {
    expect(list.map((s) => s.child.full_name)).toEqual(['Ani', 'Budi'])
    expect(list[0]!.measurements).toHaveLength(1)
  })

  it('marks who was weighed this month', () => {
    expect(list.find((s) => s.child.id === 'a')!.measuredThisMonth).toBe(true)
    expect(list.find((s) => s.child.id === 'b')!.measuredThisMonth).toBe(false)
  })

  it('puts the most urgent child first', () => {
    expect(byPriority(list)[0]!.child.full_name).toBe('Budi')
  })
})

describe('monthlyCsv', () => {
  it('exports only the month and quotes awkward cells', () => {
    const list = summarize(
      [child('a', 'Budi')],
      [measurement('a', '2026-09-12', -1), measurement('a', '2026-10-12', -2.3)],
      '2026-10-20',
    )
    const lines = monthlyCsv(list, '2026-10').split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"Siti, ""Ibu"""')
    expect(lines[1]).toContain('Pendek')
    expect(lines[1]).toContain(',24,')
  })
})

describe('recommendations', () => {
  it('turns unmet habits into advice, at most three', () => {
    const advice = recommendations(
      { level: 'sedang', reasons: [], hazChange: -0.3 },
      { mpasi_adekuat: false, sanitasi_layak: false, imunisasi_lengkap: false },
      2.1,
    )
    expect(advice).toHaveLength(3)
    expect(advice[0]!.title).toMatch(/protein/i)
  })

  it('gives nothing for a child growing well with good habits', () => {
    expect(recommendations({ level: 'rendah', reasons: [], hazChange: 0 }, { mpasi_adekuat: true }, 3.2)).toEqual([])
  })
})
