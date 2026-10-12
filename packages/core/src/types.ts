export type Sex = 'male' | 'female'

/** recumbent = terlentang (PB), standing = berdiri (TB). */
export type Position = 'recumbent' | 'standing'

export interface MeasurementInput {
  sex: Sex
  /** ISO date, YYYY-MM-DD. */
  birthDate: string
  /** ISO date, YYYY-MM-DD. */
  measuredAt: string
  weightKg?: number
  heightCm?: number
  /** Defaults to the WHO recommendation for the age: recumbent under 24 months. */
  position?: Position
}

export type Level = 'severe' | 'moderate' | 'normal' | 'above'

export interface Category {
  code: string
  label: string
  level: Level
}

export interface IndicatorResult {
  z: number
  category: Category
}

export type Flag = 'haz_tidak_wajar' | 'waz_tidak_wajar' | 'whz_tidak_wajar' | 'tinggi_turun' | 'tanggal_mundur'

export interface Assessment {
  input: MeasurementInput
  ageDays: number
  position: Position
  /** Height after the WHO 0.7 cm position correction, null without a height. */
  heightCmAdjusted: number | null
  heightForAge: IndicatorResult | null
  weightForAge: IndicatorResult | null
  weightForHeight: IndicatorResult | null
  flags: Flag[]
}
