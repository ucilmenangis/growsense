import { describe, expect, it } from 'vitest'
import {
  dusunQuarter,
  monthlyStats,
  summarize,
  type ChildRow,
  type FollowUpRow,
  type MeasurementRow,
} from '@growsense/core'
import { cases } from '../src/lib/followUp'
import { fhirBundle } from '../src/lib/fhir'
import { programs } from '../src/lib/programs'

const child = (id: string): ChildRow => ({
  id,
  posyandu_id: 'p1',
  full_name: id,
  nik: null,
  sex: 'female',
  birth_date: '2024-10-01',
  mother_name: null,
  birth_weight_kg: null,
  consent_at: null,
  deleted_at: null,
})

const visit = (
  child_id: string,
  measured_at: string,
  haz: number,
  extra: Partial<MeasurementRow> = {},
): MeasurementRow => ({
  id: `${child_id}-${measured_at}`,
  child_id,
  measured_at,
  weight_kg: 10,
  height_cm: 80,
  position: 'standing',
  risk_factors: {},
  haz,
  waz: 0,
  whz: 0,
  flags: [],
  note: null,
  deleted_at: null,
  ...extra,
})

const note = (child_id: string, stage: FollowUpRow['stage'], done_at: string): FollowUpRow => ({
  id: `${child_id}-${stage}`,
  child_id,
  stage,
  done_at,
  next_at: null,
  actions: [],
  note: null,
  deleted_at: null,
})

describe('follow up board', () => {
  const kids = ['stunted', 'fine', 'open', 'closed', 'reopened'].map(child)
  const visits = [
    visit('stunted', '2026-10-05', -2.5),
    visit('fine', '2026-10-05', 0.2),
    visit('open', '2026-10-05', -2.5),
    visit('closed', '2026-10-05', -2.5),
    visit('reopened', '2026-10-05', -2.5),
  ]
  const notes = new Map([
    ['open', [note('open', 'rujukan', '2026-09-01'), note('open', 'intervensi', '2026-09-20')]],
    ['closed', [note('closed', 'selesai', '2026-10-06')]],
    ['reopened', [note('reopened', 'selesai', '2026-10-01')]],
  ])
  const board = new Map(cases(summarize(kids, visits, '2026-10-14'), notes).map((c) => [c.summary.child.id, c.column]))

  it('puts a warning without a note in the first column and an open case at its latest stage', () => {
    expect(board.get('stunted')).toBe('perlu')
    expect(board.get('open')).toBe('intervensi')
    expect(board.has('fine')).toBe(false)
  })

  it('keeps a closed case off the board until a newer visit still shows a warning', () => {
    expect(board.has('closed')).toBe(false)
    expect(board.get('reopened')).toBe('perlu')
  })
})

describe('programs', () => {
  const kids = Array.from({ length: 10 }, (_, i) => ({ ...child(`k${i}`), posyandu_id: i < 5 ? 'p1' : 'p2' }))
  const visits = kids.map((k, i) =>
    visit(k.id, '2026-08-05', 0, { risk_factors: { sanitasi_layak: i >= 4, mpasi_adekuat: i !== 0 } }),
  )
  const posyandu = [
    { id: 'p1', name: 'P1', dusun: 'A' },
    { id: 'p2', name: 'P2', dusun: 'B' },
  ]
  const total = (suppress: boolean) =>
    dusunQuarter(
      posyandu,
      monthlyStats(['p1', 'p2'], kids, visits, ['2026-07', '2026-08', '2026-09']),
      '2026-Q3',
      suppress,
    ).find((a) => a.area === null)!

  it('suggests a program when at least a fifth of the answers is no, and when coverage is low', () => {
    const keys = programs(total(false)).map((p) => p.key)
    // 4 of 10 without sanitation, 1 of 10 without MP-ASI, and 10 of 30 child months weighed.
    expect(keys).toEqual(['cakupan', 'sanitasi_layak'])
  })

  it('skips a factor whose count is hidden', () => {
    const hidden = { ...total(false), factors: { ...total(false).factors, sanitasi_layak: { no: null, answered: 10 } } }
    expect(programs(hidden).map((p) => p.key)).toEqual(['cakupan'])
  })
})

describe('fhir bundle', () => {
  it('has one weight and one height observation per visit with valid UUID urls and LOINC codes', () => {
    const list = summarize([child('a')], [visit('a', '2026-10-05', 0), visit('a', '2026-09-05', 0)], '2026-10-14')
    const bundle = fhirBundle(list, '2026-10')
    expect(bundle.entry).toHaveLength(2)
    for (const e of bundle.entry)
      expect(e.fullUrl).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(bundle.entry.map((e) => e.resource.code.coding[0]!.code)).toEqual(['29463-7', '8302-2'])
    expect(bundle.entry[0]!.resource.subject.reference).toBe('Patient/growsense-a')
  })
})
