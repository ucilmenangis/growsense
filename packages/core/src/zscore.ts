// WHO Child Growth Standards z-scores, following the method of the WHO anthro package.
import type { Position, Sex } from './types'
import type { Lms, LmsTable } from './who/types'
import { lengthForAge, weightForAge, weightForHeight, weightForLength } from './who/tables'

/** From this age (24 months) height is measured standing and the height tables apply. */
export const HEIGHT_AGE_DAYS = 731
export const MAX_AGE_DAYS = 1826
export const POSITION_CORRECTION_CM = 0.7
const DAY_MS = 86_400_000

export function ageInDays(birthDate: string, measuredAt: string): number {
  const days = Math.round((Date.parse(measuredAt) - Date.parse(birthDate)) / DAY_MS)
  if (Number.isNaN(days)) throw new Error(`Tanggal tidak valid: ${birthDate}, ${measuredAt}`)
  if (days < 0) throw new Error('Tanggal ukur sebelum tanggal lahir')
  return days
}

export function defaultPosition(ageDays: number): Position {
  return ageDays < HEIGHT_AGE_DAYS ? 'recumbent' : 'standing'
}

/** Converts a measurement to the position the WHO tables expect for this age. */
export function adjustHeightForPosition(heightCm: number, ageDays: number, position: Position): number {
  const expected = defaultPosition(ageDays)
  if (position === expected) return heightCm
  return expected === 'recumbent' ? heightCm + POSITION_CORRECTION_CM : heightCm - POSITION_CORRECTION_CM
}

function row(table: LmsTable, sex: Sex, index: number): Lms | null {
  const data = sex === 'male' ? table.male : table.female
  const i = index * 3
  if (index < 0 || i + 2 >= data.length) return null
  return { l: data[i]!, m: data[i + 1]!, s: data[i + 2]! }
}

/** LMS at `key`, interpolated linearly between table rows. */
function lmsAt(table: LmsTable, sex: Sex, key: number): Lms | null {
  const pos = (key - table.start) / table.step
  const rounded = Math.round(pos)
  if (Math.abs(pos - rounded) < 1e-9) return row(table, sex, rounded)
  const lo = row(table, sex, Math.floor(pos))
  const hi = row(table, sex, Math.ceil(pos))
  if (!lo || !hi) return null
  const t = pos - Math.floor(pos)
  return { l: lo.l + (hi.l - lo.l) * t, m: lo.m + (hi.m - lo.m) * t, s: lo.s + (hi.s - lo.s) * t }
}

const valueAt = ({ l, m, s }: Lms, z: number) => m * (1 + l * s * z) ** (1 / l)

function zPlain({ l, m, s }: Lms, y: number): number {
  return ((y / m) ** l - 1) / (l * s)
}

/** WHO restricted application for weight-based indicators beyond +-3 SD. */
function zRestricted(lms: Lms, y: number): number {
  const z = zPlain(lms, y)
  if (z > 3) {
    const sd3 = valueAt(lms, 3)
    return 3 + (y - sd3) / (sd3 - valueAt(lms, 2))
  }
  if (z < -3) {
    const sd3 = valueAt(lms, -3)
    return -3 + (y - sd3) / (valueAt(lms, -2) - sd3)
  }
  return z
}

const inAgeRange = (ageDays: number) => ageDays >= 0 && ageDays <= MAX_AGE_DAYS

/** Length/height for age (PB/U, TB/U). Expects a position-adjusted height. */
export function zHeightForAge(sex: Sex, ageDays: number, heightCm: number): number | null {
  if (!inAgeRange(ageDays)) return null
  const lms = lmsAt(lengthForAge, sex, Math.round(ageDays))
  return lms && zPlain(lms, heightCm)
}

/** Weight for age (BB/U). */
export function zWeightForAge(sex: Sex, ageDays: number, weightKg: number): number | null {
  if (!inAgeRange(ageDays)) return null
  const lms = lmsAt(weightForAge, sex, Math.round(ageDays))
  return lms && zRestricted(lms, weightKg)
}

/** Weight for length (under 24 months) or height (BB/PB, BB/TB). Expects a position-adjusted height. */
export function zWeightForHeight(sex: Sex, ageDays: number, heightCm: number, weightKg: number): number | null {
  if (!inAgeRange(ageDays)) return null
  const table = ageDays < HEIGHT_AGE_DAYS ? weightForLength : weightForHeight
  const lms = lmsAt(table, sex, heightCm)
  return lms && zRestricted(lms, weightKg)
}
