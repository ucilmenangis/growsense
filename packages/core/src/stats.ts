// Monthly figures per posyandu without any child identity, for the Pemdes and Dinkes views and
// the monthly report. supabase/migrations/*_dashboard.sql has the same rules as SQL
// (posyandu_monthly); supabase/test checks both give the same numbers.
import type { ChildRow, MeasurementRow, RiskFactors } from './records'
import { MAX_AGE_DAYS, ageInDays } from './zscore'
import { monthEnd } from './format'

export interface FactorCount {
  /** Answered "no". */
  no: number
  /** Answered at all. */
  answered: number
}

export interface MonthlyStat {
  posyandu_id: string
  /** YYYY-MM */
  month: string
  /** S: children under five at the end of the month. */
  sasaran: number
  /** D: children with at least one measurement in the month. */
  ditimbang: number
  /** From the last measurement of the month; implausible values flagged by core are left out. */
  stunting: number
  sangat_pendek: number
  wasting: number
  underweight: number
  factors: Record<keyof Required<RiskFactors>, FactorCount>
}

export const FACTOR_KEYS = ['asi_eksklusif', 'mpasi_adekuat', 'imunisasi_lengkap', 'sanitasi_layak'] as const

const emptyFactors = () =>
  Object.fromEntries(FACTOR_KEYS.map((k) => [k, { no: 0, answered: 0 }])) as MonthlyStat['factors']

/** Figures for each posyandu and each month in `months` (YYYY-MM). */
export function monthlyStats(
  posyanduIds: string[],
  children: ChildRow[],
  measurements: MeasurementRow[],
  months: string[],
): MonthlyStat[] {
  const live = children.filter((c) => !c.deleted_at)
  const lastOfMonth = new Map<string, MeasurementRow>()
  for (const m of measurements) {
    if (m.deleted_at) continue
    const key = `${m.child_id}|${m.measured_at.slice(0, 7)}`
    const current = lastOfMonth.get(key)
    if (!current || m.measured_at > current.measured_at || (m.measured_at === current.measured_at && m.id > current.id))
      lastOfMonth.set(key, m)
  }

  const out: MonthlyStat[] = []
  for (const posyandu_id of posyanduIds) {
    const kids = live.filter((c) => c.posyandu_id === posyandu_id)
    for (const month of months) {
      const end = monthEnd(month)
      const stat: MonthlyStat = {
        posyandu_id,
        month,
        sasaran: 0,
        ditimbang: 0,
        stunting: 0,
        sangat_pendek: 0,
        wasting: 0,
        underweight: 0,
        factors: emptyFactors(),
      }
      for (const c of kids) {
        if (c.birth_date > end || ageInDays(c.birth_date, end) > MAX_AGE_DAYS) continue
        stat.sasaran++
        const m = lastOfMonth.get(`${c.id}|${month}`)
        if (!m) continue
        stat.ditimbang++
        if (m.haz !== null && !m.flags.includes('haz_tidak_wajar')) {
          if (m.haz < -2) stat.stunting++
          if (m.haz < -3) stat.sangat_pendek++
        }
        if (m.whz !== null && !m.flags.includes('whz_tidak_wajar') && m.whz < -2) stat.wasting++
        if (m.waz !== null && !m.flags.includes('waz_tidak_wajar') && m.waz < -2) stat.underweight++
        for (const k of FACTOR_KEYS) {
          const answer = m.risk_factors[k]
          if (answer === undefined || answer === null) continue
          stat.factors[k].answered++
          if (answer === false) stat.factors[k].no++
        }
      }
      out.push(stat)
    }
  }
  return out
}

/** Sums rows, e.g. all posyandu of one month or one dusun. */
export function sumStats(rows: MonthlyStat[], posyandu_id = 'total', month = rows[0]?.month ?? ''): MonthlyStat {
  const total: MonthlyStat = {
    posyandu_id,
    month,
    sasaran: 0,
    ditimbang: 0,
    stunting: 0,
    sangat_pendek: 0,
    wasting: 0,
    underweight: 0,
    factors: emptyFactors(),
  }
  for (const r of rows) {
    total.sasaran += r.sasaran
    total.ditimbang += r.ditimbang
    total.stunting += r.stunting
    total.sangat_pendek += r.sangat_pendek
    total.wasting += r.wasting
    total.underweight += r.underweight
    for (const k of FACTOR_KEYS) {
      total.factors[k].no += r.factors[k].no
      total.factors[k].answered += r.factors[k].answered
    }
  }
  return total
}
