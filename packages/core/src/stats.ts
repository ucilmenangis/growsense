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

/** Health counts this small are hidden from Pemdes and Dinkes, so they cannot point at one family. */
export const SUPPRESS_BELOW = 3

const isSmall = (n: number | null) => n !== null && n > 0 && n < SUPPRESS_BELOW

/** Figures for a dusun, or for the whole puskesmas when `area` is null. Hidden counts are null. */
export interface AreaStat {
  area: string | null
  /** YYYY-MM, or YYYY-Qn for a quarter. */
  month: string
  sasaran: number
  ditimbang: number
  stunting: number | null
  sangat_pendek: number | null
  wasting: number | null
  underweight: number | null
  factors: Record<keyof Required<RiskFactors>, { no: number | null; answered: number }>
}

const COUNT_KEYS = ['stunting', 'sangat_pendek', 'wasting', 'underweight'] as const
const MEASURES = [...COUNT_KEYS, ...FACTOR_KEYS] as const
type MeasureKey = (typeof MEASURES)[number]
const isCount = (k: MeasureKey): k is (typeof COUNT_KEYS)[number] => (COUNT_KEYS as readonly string[]).includes(k)

const measure = (a: AreaStat, k: MeasureKey) => (isCount(k) ? a[k] : a.factors[k].no)

function hide(a: AreaStat, k: MeasureKey) {
  if (isCount(k)) a[k] = null
  else a.factors[k].no = null
}

/** Code point order, the same as `collate "C"` in SQL. */
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const sortAreas = (rows: AreaStat[]) =>
  rows.sort(
    (a, b) =>
      (a.area === null ? (b.area === null ? 0 : -1) : b.area === null ? 1 : byCodePoint(a.area, b.area)) ||
      a.month.localeCompare(b.month),
  )

function toArea(t: MonthlyStat, area: string | null, month: string): AreaStat {
  return {
    area,
    month,
    sasaran: t.sasaran,
    ditimbang: t.ditimbang,
    stunting: t.stunting,
    sangat_pendek: t.sangat_pendek,
    wasting: t.wasting,
    underweight: t.underweight,
    factors: Object.fromEntries(
      FACTOR_KEYS.map((k) => [k, { no: t.factors[k].no, answered: t.factors[k].answered }]),
    ) as AreaStat['factors'],
  }
}

/** YYYY-MM to YYYY-Qn. */
export const quarterOf = (month: string) =>
  `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`

/** The three YYYY-MM months of a YYYY-Qn quarter. */
export function quarterMonths(quarter: string): string[] {
  const first = (Number(quarter.slice(6)) - 1) * 3 + 1
  return [0, 1, 2].map((i) => `${quarter.slice(0, 4)}-${String(first + i).padStart(2, '0')}`)
}

/** The last quarter that ended before `today` (YYYY-MM-DD). */
export function lastCompletedQuarter(today: string): string {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const q = Math.floor((m - 1) / 3)
  return q === 0 ? `${y - 1}-Q4` : `${y}-Q${q}`
}

/**
 * Whole puskesmas per month, for Pemdes and Dinkes. `stats` must cover whole quarters around
 * `months`. With `suppress`, a health count is hidden for every month of a quarter when any
 * month of that quarter is 1 or 2. Same as village_monthly in the dashboard migration.
 */
export function villageMonthly(stats: MonthlyStat[], months: string[], suppress = true): AreaStat[] {
  const byMonth = new Map<string, MonthlyStat[]>()
  for (const s of stats) byMonth.set(s.month, [...(byMonth.get(s.month) ?? []), s])
  const rows = [...byMonth].map(([month, list]) => toArea(sumStats(list, 'total', month), null, month))
  if (suppress) {
    for (const k of MEASURES) {
      const smallQuarters = new Set(rows.filter((r) => isSmall(measure(r, k))).map((r) => quarterOf(r.month)))
      for (const r of rows) if (smallQuarters.has(quarterOf(r.month))) hide(r, k)
    }
  }
  return sortAreas(rows.filter((r) => months.includes(r.month)))
}

/**
 * Per dusun (the posyandu name when no dusun is set) plus the whole puskesmas, added up over one
 * quarter in child months. With `suppress`, a health count of 1 or 2 is hidden, and a count is
 * hidden for every dusun when any dusun is small. Same as dusun_quarterly in the migration, which
 * also only answers for completed quarters.
 */
export function dusunQuarter(
  posyandu: { id: string; name: string; dusun: string | null }[],
  stats: MonthlyStat[],
  quarter: string,
  suppress = true,
): AreaStat[] {
  const months = quarterMonths(quarter)
  const areaOf = new Map(posyandu.map((p) => [p.id, p.dusun ?? p.name]))
  const groups = new Map<string, MonthlyStat[]>()
  for (const s of stats) {
    const area = areaOf.get(s.posyandu_id)
    if (area === undefined || !months.includes(s.month)) continue
    for (const key of [area, '']) groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const rows = [...groups].map(([area, list]) => toArea(sumStats(list, area, quarter), area || null, quarter))
  if (suppress) {
    for (const k of MEASURES) {
      const anyDusun = rows.some((r) => r.area !== null && isSmall(measure(r, k)))
      for (const r of rows) if (isSmall(measure(r, k)) || (r.area !== null && anyDusun)) hide(r, k)
    }
  }
  return sortAreas(rows)
}
