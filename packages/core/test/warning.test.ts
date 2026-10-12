import { describe, expect, it } from 'vitest'
import { earlyWarning } from '../src/warning'
import { referenceValue } from '../src/zscore'

const visit = (measured_at: string, haz: number | null, waz: number | null = 0, whz: number | null = 0) => ({
  measured_at,
  haz,
  waz,
  whz,
})

describe('referenceValue', () => {
  it('returns the WHO median and SD lines', () => {
    expect(referenceValue('heightForAge', 'male', 730, 0)).toBeCloseTo(87.8018, 4)
    expect(referenceValue('heightForAge', 'female', 365, -2)).toBeCloseTo(74.0049 * (1 - 2 * 0.03479), 4)
    expect(referenceValue('weightForAge', 'male', 730, 0)).toBeCloseTo(12.1482, 4)
  })

  it('returns null outside the table', () => {
    expect(referenceValue('heightForAge', 'male', 1827, 0)).toBeNull()
  })
})

describe('earlyWarning', () => {
  it('has no level without measurements', () => {
    expect(earlyWarning([]).level).toBeNull()
  })

  it('is low for a child growing along the median', () => {
    const w = earlyWarning([visit('2026-08-01', 0.1), visit('2026-09-01', 0.05), visit('2026-10-01', 0.1)])
    expect(w.level).toBe('rendah')
    expect(w.reasons).toEqual([])
  })

  it('is high when the child is already stunted', () => {
    const w = earlyWarning([visit('2026-10-01', -2.3)])
    expect(w.level).toBe('tinggi')
    expect(w.reasons.join(' ')).toMatch(/pendek/i)
  })

  it('is high when the child is wasted', () => {
    expect(earlyWarning([visit('2026-10-01', 0, -1, -2.4)]).level).toBe('tinggi')
  })

  it('is medium when height for age is falling before the child is stunted', () => {
    const w = earlyWarning([visit('2026-08-01', -1.2), visit('2026-10-01', -1.6)])
    expect(w.level).toBe('sedang')
    expect(w.hazChange).toBeCloseTo(-0.4, 6)
    expect(w.reasons.join(' ')).toMatch(/melambat/i)
  })

  it('is high when a fast fall brings the child near the stunting line', () => {
    expect(earlyWarning([visit('2026-08-01', -0.9), visit('2026-10-01', -1.7)]).level).toBe('tinggi')
  })

  it('compares against the latest earlier visit that has a height z-score', () => {
    const w = earlyWarning([visit('2026-08-01', -1.0), visit('2026-09-01', null), visit('2026-10-01', -1.5)])
    expect(w.hazChange).toBeCloseTo(-0.5, 6)
  })

  it('catches a steady slide over three months that no single month shows', () => {
    const w = earlyWarning([
      visit('2026-07-01', -0.9),
      visit('2026-08-01', -1.05),
      visit('2026-09-01', -1.2),
      visit('2026-10-01', -1.35),
    ])
    expect(w.hazChange).toBeCloseTo(-0.45, 6)
    expect(w.level).toBe('sedang')
    expect(w.reasons.join(' ')).toMatch(/3 bulan/)
  })

  it('ignores visits older than the window', () => {
    const w = earlyWarning([visit('2026-01-01', 0.5), visit('2026-09-01', -0.1), visit('2026-10-01', -0.1)])
    expect(w.hazChange).toBeCloseTo(0, 6)
    expect(w.level).toBe('rendah')
  })

  it('falls back to the last earlier visit when none is inside the window', () => {
    const w = earlyWarning([visit('2026-01-01', -1.0), visit('2026-10-01', -1.4)])
    expect(w.hazChange).toBeCloseTo(-0.4, 6)
  })

  it('sorts visits by date before comparing', () => {
    const w = earlyWarning([visit('2026-10-01', -1.5), visit('2026-08-01', -1.0)])
    expect(w.hazChange).toBeCloseTo(-0.5, 6)
  })
})
