// Local writes. Every change marks the row dirty so the next sync sends it.
import Dexie from 'dexie'
import {
  assess,
  checkAgainstPrevious,
  type Assessment,
  type ChildRow,
  type MeasurementRow,
  type Position,
  type RiskFactors,
} from '@growsense/core'
import type { GrowSenseDb, LocalChild, LocalMeasurement } from './db'

export interface NewChild {
  posyandu_id: string
  full_name: string
  sex: ChildRow['sex']
  birth_date: string
  nik?: string
  mother_name?: string
  birth_weight_kg?: number
  consent_at?: string
}

export interface NewMeasurement {
  child_id: string
  measured_at: string
  weight_kg?: number
  height_cm?: number
  position?: Position
  risk_factors?: RiskFactors
  note?: string
}

export type ChildChanges = Partial<Omit<ChildRow, 'id' | 'created_at' | 'updated_at'>>

// Same precision as the numeric(5, 2) columns. Adding 0 turns -0 into 0.
const round2 = (z: number | undefined) => (z === undefined ? null : Math.round(z * 100) / 100 + 0)

export async function addChild(db: GrowSenseDb, input: NewChild): Promise<LocalChild> {
  const row: LocalChild = {
    id: crypto.randomUUID(),
    posyandu_id: input.posyandu_id,
    full_name: input.full_name.trim(),
    nik: input.nik ?? null,
    sex: input.sex,
    birth_date: input.birth_date,
    mother_name: input.mother_name ?? null,
    birth_weight_kg: input.birth_weight_kg ?? null,
    consent_at: input.consent_at ?? null,
    deleted_at: null,
    dirty: 1,
    rev: 1,
  }
  await db.children.add(row)
  return row
}

export async function updateChild(db: GrowSenseDb, id: string, changes: ChildChanges): Promise<void> {
  await db.transaction('rw', db.children, async () => {
    const current = await db.children.get(id)
    if (!current) throw new Error('Data balita tidak ditemukan')
    await db.children.put({ ...current, ...changes, dirty: 1, rev: current.rev + 1 })
  })
}

function toAssessment(
  child: ChildRow,
  m: Pick<MeasurementRow, 'measured_at' | 'weight_kg' | 'height_cm' | 'position'>,
) {
  return assess({
    sex: child.sex,
    birthDate: child.birth_date,
    measuredAt: m.measured_at,
    weightKg: m.weight_kg ?? undefined,
    heightCm: m.height_cm ?? undefined,
    position: m.position ?? undefined,
  })
}

/** Latest measurement of the child dated before `date`, ignoring deleted ones. */
export async function previousMeasurement(
  db: GrowSenseDb,
  childId: string,
  date: string,
): Promise<LocalMeasurement | undefined> {
  return db.measurements
    .where('[child_id+measured_at]')
    .between([childId, Dexie.minKey], [childId, date], true, false)
    .reverse()
    .filter((m) => m.deleted_at === null)
    .first()
}

/** Computes z-scores and validation flags with @growsense/core, then stores the measurement. */
export async function recordMeasurement(
  db: GrowSenseDb,
  input: NewMeasurement,
): Promise<{ row: LocalMeasurement; assessment: Assessment }> {
  const child = await db.children.get(input.child_id)
  if (!child) throw new Error('Data balita tidak ditemukan')

  const values = {
    measured_at: input.measured_at,
    weight_kg: input.weight_kg ?? null,
    height_cm: input.height_cm ?? null,
    position: input.position ?? null,
  }
  const assessment = toAssessment(child, values)
  const previous = await previousMeasurement(db, child.id, input.measured_at)
  const flags = previous
    ? [...assessment.flags, ...checkAgainstPrevious(assessment, toAssessment(child, previous))]
    : assessment.flags

  const row: LocalMeasurement = {
    id: crypto.randomUUID(),
    child_id: child.id,
    ...values,
    position: assessment.position,
    risk_factors: input.risk_factors ?? {},
    haz: round2(assessment.heightForAge?.z),
    waz: round2(assessment.weightForAge?.z),
    whz: round2(assessment.weightForHeight?.z),
    flags,
    note: input.note ?? null,
    deleted_at: null,
    dirty: 1,
    rev: 1,
  }
  await db.measurements.add(row)
  return { row, assessment }
}

export function measurementsOf(db: GrowSenseDb, childId: string): Promise<LocalMeasurement[]> {
  return db.measurements
    .where('[child_id+measured_at]')
    .between([childId, Dexie.minKey], [childId, Dexie.maxKey])
    .filter((m) => m.deleted_at === null)
    .toArray()
}
