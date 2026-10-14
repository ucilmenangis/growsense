// Display helpers for counts that may be hidden for Pemdes (null).
import { num, type AreaStat } from '@growsense/core'

export const HIDDEN = 'disamarkan'

/** Share of a count that may be hidden; null stays null. */
export const shareOf = (n: number | null, d: number) => (n === null ? null : d ? n / d : 0)

export const pctOrHidden = (n: number | null, d: number) => {
  const v = shareOf(n, d)
  return v === null ? HIDDEN : d ? `${num(v * 100)}%` : 'n/a'
}

export const countOrHidden = (n: number | null) => (n === null ? HIDDEN : String(n))

const ROMAN = ['I', 'II', 'III', 'IV']

/** 2026-Q3 to Triwulan III 2026 (Juli sampai September). */
export function quarterLabel(q: string, long = false) {
  const i = Number(q.slice(6)) - 1
  const months = ['Januari sampai Maret', 'April sampai Juni', 'Juli sampai September', 'Oktober sampai Desember']
  return `Triwulan ${ROMAN[i]} ${q.slice(0, 4)}${long ? ` (${months[i]})` : ''}`
}

export type Indicator = 'stunting' | 'wasting' | 'underweight' | 'cakupan' | 'sanitasi'

export const INDICATORS: { value: Indicator; label: string; good?: boolean }[] = [
  { value: 'stunting', label: 'Prevalensi pendek (TB/U)' },
  { value: 'wasting', label: 'Gizi kurang (BB/TB)' },
  { value: 'underweight', label: 'Berat badan kurang (BB/U)' },
  { value: 'sanitasi', label: 'Sanitasi belum layak' },
  { value: 'cakupan', label: 'Cakupan penimbangan (D/S)', good: true },
]

export function indicatorValue(a: AreaStat, k: Indicator): number | null {
  if (k === 'cakupan') return a.sasaran ? a.ditimbang / a.sasaran : 0
  if (k === 'sanitasi') return shareOf(a.factors.sanitasi_layak.no, a.factors.sanitasi_layak.answered)
  return shareOf(a[k], a.ditimbang)
}
