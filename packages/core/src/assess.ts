import { classifyHeightForAge, classifyWeightForAge, classifyWeightForHeight } from './classify'
import type { Assessment, Category, Flag, IndicatorResult, MeasurementInput } from './types'
import {
  HEIGHT_AGE_DAYS,
  POSITION_CORRECTION_CM,
  adjustHeightForPosition,
  ageInDays,
  defaultPosition,
  zHeightForAge,
  zWeightForAge,
  zWeightForHeight,
} from './zscore'

/**
 * Height drop between visits treated as a likely input or measuring error.
 * Initial value, to be confirmed with the bidan during validation.
 */
export const HEIGHT_DROP_TOLERANCE_CM = 0.5

// WHO cut-offs for biologically implausible z-scores.
const PLAUSIBLE = {
  haz: [-6, 6],
  waz: [-6, 5],
  whz: [-5, 5],
} as const

function indicator(z: number | null, classify: (z: number) => Category): IndicatorResult | null {
  return z === null ? null : { z, category: classify(z) }
}

function outside(result: IndicatorResult | null, [min, max]: readonly [number, number]): boolean {
  return result !== null && (result.z < min || result.z > max)
}

export function assess(input: MeasurementInput): Assessment {
  const { sex, weightKg, heightCm } = input
  const ageDays = ageInDays(input.birthDate, input.measuredAt)
  const position = input.position ?? defaultPosition(ageDays)
  const height = heightCm === undefined ? null : adjustHeightForPosition(heightCm, ageDays, position)

  const heightForAge = indicator(height === null ? null : zHeightForAge(sex, ageDays, height), classifyHeightForAge)
  const weightForAge = indicator(weightKg === undefined ? null : zWeightForAge(sex, ageDays, weightKg), classifyWeightForAge)
  const weightForHeight = indicator(
    height === null || weightKg === undefined ? null : zWeightForHeight(sex, ageDays, height, weightKg),
    classifyWeightForHeight,
  )

  const flags: Flag[] = []
  if (outside(heightForAge, PLAUSIBLE.haz)) flags.push('haz_tidak_wajar')
  if (outside(weightForAge, PLAUSIBLE.waz)) flags.push('waz_tidak_wajar')
  if (outside(weightForHeight, PLAUSIBLE.whz)) flags.push('whz_tidak_wajar')

  return { input, ageDays, position, heightCmAdjusted: height, heightForAge, weightForAge, weightForHeight, flags }
}

/** Adjusted height expressed as a recumbent length, so visits either side of 24 months compare. */
function asLength(a: Assessment): number | null {
  if (a.heightCmAdjusted === null) return null
  return a.ageDays < HEIGHT_AGE_DAYS ? a.heightCmAdjusted : a.heightCmAdjusted + POSITION_CORRECTION_CM
}

/** Checks a new measurement against the previous one for the same child. */
export function checkAgainstPrevious(current: Assessment, previous: Assessment): Flag[] {
  const flags: Flag[] = []
  if (current.ageDays < previous.ageDays) flags.push('tanggal_mundur')
  const now = asLength(current)
  const before = asLength(previous)
  if (now !== null && before !== null && before - now > HEIGHT_DROP_TOLERANCE_CM) flags.push('tinggi_turun')
  return flags
}
