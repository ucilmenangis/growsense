import { describe, expect, it } from 'vitest'
import {
  adjustHeightForPosition,
  ageInDays,
  zHeightForAge,
  zWeightForAge,
  zWeightForHeight,
} from '../src/zscore'

// Measurement value at a given z for one LMS row (inverse of the LMS formula).
const atZ = (z: number, l: number, m: number, s: number) => m * (1 + l * s * z) ** (1 / l)

describe('ageInDays', () => {
  it('counts calendar days between ISO dates', () => {
    expect(ageInDays('2024-08-15', '2026-10-14')).toBe(790)
    expect(ageInDays('2026-10-14', '2026-10-14')).toBe(0)
  })

  it('rejects a measurement before birth', () => {
    expect(() => ageInDays('2026-10-14', '2026-10-13')).toThrow()
  })
})

describe('adjustHeightForPosition', () => {
  it('adds 0.7 cm when a child under 24 months is measured standing', () => {
    expect(adjustHeightForPosition(80, 700, 'standing')).toBeCloseTo(80.7, 10)
  })

  it('subtracts 0.7 cm when a child from 24 months is measured lying down', () => {
    expect(adjustHeightForPosition(88, 731, 'recumbent')).toBeCloseTo(87.3, 10)
  })

  it('keeps the value when the position matches the age', () => {
    expect(adjustHeightForPosition(80, 700, 'recumbent')).toBe(80)
    expect(adjustHeightForPosition(88, 731, 'standing')).toBe(88)
  })
})

describe('zHeightForAge', () => {
  it('is 0 at the WHO median (boy, 730 days, length 87.8018)', () => {
    expect(zHeightForAge('male', 730, 87.8018)).toBeCloseTo(0, 4)
  })

  it('switches from length to height at 731 days (median 87.1303)', () => {
    expect(zHeightForAge('male', 731, 87.1303)).toBeCloseTo(0, 4)
  })

  it('hits -2 on the WHO -2 SD line', () => {
    expect(zHeightForAge('female', 365, atZ(-2, 1, 74.0049, 0.03479))).toBeCloseTo(-2, 4)
  })

  it('returns null outside 0 to 1826 days', () => {
    expect(zHeightForAge('male', 1827, 110)).toBeNull()
    expect(zHeightForAge('male', -1, 50)).toBeNull()
  })
})

describe('zWeightForAge', () => {
  const [l, m, s] = [-0.0136, 12.1482, 0.11425] // boy, 730 days

  it('is 0 at the median', () => {
    expect(zWeightForAge('male', 730, m)).toBeCloseTo(0, 4)
  })

  it('uses the plain LMS formula inside +-3 SD', () => {
    expect(zWeightForAge('male', 730, atZ(-2.5, l, m, s))).toBeCloseTo(-2.5, 4)
  })

  it('uses the WHO restricted method beyond +3 SD', () => {
    const sd3 = atZ(3, l, m, s)
    const sd23 = sd3 - atZ(2, l, m, s)
    expect(zWeightForAge('male', 730, sd3 + sd23)).toBeCloseTo(4, 4)
  })

  it('uses the WHO restricted method beyond -3 SD', () => {
    const sd3 = atZ(-3, l, m, s)
    const sd23 = atZ(-2, l, m, s) - sd3
    expect(zWeightForAge('male', 730, sd3 - sd23)).toBeCloseTo(-4, 4)
  })
})

describe('zWeightForHeight', () => {
  it('uses weight for length under 731 days', () => {
    expect(zWeightForHeight('male', 500, 80, 10.4475)).toBeCloseTo(0, 4)
  })

  it('uses weight for height from 731 days', () => {
    expect(zWeightForHeight('male', 800, 87, 12.1645)).toBeCloseTo(0, 4)
  })

  it('interpolates LMS between 0.1 cm rows', () => {
    expect(zWeightForHeight('male', 500, 80.05, (10.4475 + 10.466) / 2)).toBeCloseTo(0, 3)
  })

  it('returns null outside the table range', () => {
    expect(zWeightForHeight('male', 500, 44.9, 3)).toBeNull()
    expect(zWeightForHeight('male', 800, 64.9, 7)).toBeNull()
  })
})
