import { describe, expect, it } from 'vitest'
import { assess, checkAgainstPrevious } from '../src/assess'
import { classifyHeightForAge, classifyWeightForAge, classifyWeightForHeight } from '../src/classify'

describe('classification (Permenkes 2/2020)', () => {
  it('height for age', () => {
    expect(classifyHeightForAge(-3.01).code).toBe('sangat_pendek')
    expect(classifyHeightForAge(-3).code).toBe('pendek')
    expect(classifyHeightForAge(-2.01).code).toBe('pendek')
    expect(classifyHeightForAge(-2).code).toBe('normal')
    expect(classifyHeightForAge(3).code).toBe('normal')
    expect(classifyHeightForAge(3.01).code).toBe('tinggi')
  })

  it('weight for age', () => {
    expect(classifyWeightForAge(-3.5).code).toBe('bb_sangat_kurang')
    expect(classifyWeightForAge(-2.5).code).toBe('bb_kurang')
    expect(classifyWeightForAge(1).code).toBe('bb_normal')
    expect(classifyWeightForAge(1.01).code).toBe('risiko_bb_lebih')
  })

  it('weight for height', () => {
    expect(classifyWeightForHeight(-3.2).code).toBe('gizi_buruk')
    expect(classifyWeightForHeight(-2.2).code).toBe('gizi_kurang')
    expect(classifyWeightForHeight(1).code).toBe('gizi_baik')
    expect(classifyWeightForHeight(1.5).code).toBe('berisiko_gizi_lebih')
    expect(classifyWeightForHeight(2.5).code).toBe('gizi_lebih')
    expect(classifyWeightForHeight(3.1).code).toBe('obesitas')
  })
})

describe('assess', () => {
  it('computes all three indicators for a normal boy at 2 years', () => {
    const r = assess({
      sex: 'male',
      birthDate: '2024-08-15',
      measuredAt: '2026-08-15',
      weightKg: 12.1482,
      heightCm: 87.8018,
      position: 'recumbent',
    })
    expect(r.ageDays).toBe(730)
    expect(r.heightForAge?.z).toBeCloseTo(0, 3)
    expect(r.heightForAge?.category.code).toBe('normal')
    expect(r.weightForAge?.z).toBeCloseTo(0, 3)
    expect(r.weightForHeight?.category.code).toBe('gizi_baik')
    expect(r.flags).toEqual([])
  })

  it('defaults the position from age', () => {
    const r = assess({ sex: 'male', birthDate: '2024-08-15', measuredAt: '2026-08-16', heightCm: 87.1303 })
    expect(r.position).toBe('standing')
    expect(r.heightForAge?.z).toBeCloseTo(0, 3)
  })

  it('leaves out indicators whose input is missing', () => {
    const r = assess({ sex: 'female', birthDate: '2025-10-01', measuredAt: '2026-10-01', weightKg: 8.9462 })
    expect(r.heightForAge).toBeNull()
    expect(r.weightForHeight).toBeNull()
    expect(r.weightForAge?.z).toBeCloseTo(0, 3)
  })

  it('flags biologically implausible values (WHO cut-offs)', () => {
    const r = assess({ sex: 'male', birthDate: '2024-08-15', measuredAt: '2026-08-15', weightKg: 4 })
    expect(r.flags).toContain('waz_tidak_wajar')
  })
})

describe('checkAgainstPrevious', () => {
  const base = { sex: 'male' as const, birthDate: '2024-08-15', weightKg: 12 }

  it('flags a height drop beyond tolerance', () => {
    const prev = assess({ ...base, measuredAt: '2026-09-14', heightCm: 82.8 })
    const curr = assess({ ...base, measuredAt: '2026-10-14', heightCm: 82.1 })
    expect(checkAgainstPrevious(curr, prev)).toContain('tinggi_turun')
  })

  it('compares heights after position adjustment', () => {
    // Lying 87.5 at 23 months, then standing 86.9 (= lying 87.6) at 24 months: no drop.
    const prev = assess({ ...base, measuredAt: '2026-07-20', heightCm: 87.5, position: 'recumbent' })
    const curr = assess({ ...base, measuredAt: '2026-08-20', heightCm: 86.9, position: 'standing' })
    expect(checkAgainstPrevious(curr, prev)).not.toContain('tinggi_turun')
  })

  it('flags a measurement dated before the previous one', () => {
    const prev = assess({ ...base, measuredAt: '2026-10-14', heightCm: 82 })
    const curr = assess({ ...base, measuredAt: '2026-10-01', heightCm: 82 })
    expect(checkAgainstPrevious(curr, prev)).toContain('tanggal_mundur')
  })
})
