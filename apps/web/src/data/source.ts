// Where the dashboard data comes from: Supabase when configured, otherwise the demo dataset from
// core. A Pemdes session only ever receives counts per posyandu, never child rows.
import {
  demoDataset,
  dusunQuarter,
  lastCompletedQuarter,
  lastMonths,
  monthlyStats,
  quarterMonths,
  quarterOf,
  villageMonthly,
  todayIso,
  type AreaStat,
  type ChildRow,
  type FollowUpRow,
  type MeasurementRow,
  type MonthlyStat,
  type PosyanduInfo,
} from '@growsense/core'
import type { Session } from './auth'
import { supabase } from './supabase'

export interface Dataset {
  today: string
  /** The months shown in trends, oldest first, YYYY-MM. */
  months: string[]
  posyandu: PosyanduInfo[]
  /** Empty for Pemdes. */
  children: ChildRow[]
  measurements: MeasurementRow[]
  followUps: FollowUpRow[]
  /** Figures per posyandu per month in `months`. Empty for Pemdes. */
  stats: MonthlyStat[]
  /** Whole puskesmas per month in `months`. Small counts hidden for Pemdes. */
  village: AreaStat[]
  /** YYYY-Qn of the last completed quarter, used for figures per dusun. */
  quarter: string
  /** Per dusun plus the whole puskesmas (area null) for `quarter`, in child months. */
  dusun: AreaStat[]
}

/** The months of `months` widened to whole quarters, so hiding works on complete quarters. */
const wholeQuarters = (months: string[]) => [...new Set(months.flatMap((m) => quarterMonths(quarterOf(m))))]

export const TREND_MONTHS = 12
const DEMO_FOLLOW_UPS = 'growsense-web-demo-follow-ups'

function demoExtraFollowUps(): FollowUpRow[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_FOLLOW_UPS) ?? '[]') as FollowUpRow[]
  } catch {
    return []
  }
}

async function fetchAll<T>(table: string, columns = '*'): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase!
      .from(table)
      .select(columns)
      .order('id')
      .range(from, from + page - 1)
    if (error) throw error
    out.push(...(data as T[]))
    if (data.length < page) return out
  }
}

export async function loadDataset(session: Session): Promise<Dataset> {
  const today = todayIso()
  const months = lastMonths(today, TREND_MONTHS)

  const quarter = lastCompletedQuarter(today)
  // Twelve months plus whole quarters around them, and the last completed quarter.
  const statMonths = [...new Set([...wholeQuarters(months), ...quarterMonths(quarter)])].sort()

  if (session.demo) {
    const demo = demoDataset(today)
    const all = monthlyStats(
      demo.posyandu.map((p) => p.id),
      demo.children,
      demo.measurements,
      statMonths,
    )
    const pemdes = session.role === 'pemdes'
    const village = villageMonthly(all, months, pemdes ? today : false)
    const dusun = dusunQuarter(demo.posyandu, all, quarter, pemdes)
    if (pemdes)
      return {
        today,
        months,
        posyandu: demo.posyandu,
        children: [],
        measurements: [],
        followUps: [],
        stats: [],
        village,
        quarter,
        dusun,
      }
    const stats = all.filter((r) => months.includes(r.month))
    const followUps = [...demo.followUps, ...demoExtraFollowUps()]
    return { today, months, ...demo, followUps, stats, village, quarter, dusun }
  }

  const posyandu = (await fetchAll<PosyanduInfo>('posyandu', 'id, name, dusun, lat, lng')).sort((a, b) =>
    a.name.localeCompare(b.name, 'id', { numeric: true }),
  )
  if (session.role === 'pemdes') {
    const [monthly, quarterly] = await Promise.all([
      supabase!.rpc('village_monthly', { p_from: `${months[0]}-01`, p_to: today }),
      supabase!.rpc('dusun_quarterly', { p_quarter: `${quarterMonths(quarter)[0]}-01` }),
    ])
    if (monthly.error) throw monthly.error
    if (quarterly.error) throw quarterly.error
    return {
      today,
      months,
      posyandu,
      children: [],
      measurements: [],
      followUps: [],
      stats: [],
      village: monthly.data as AreaStat[],
      quarter,
      dusun: quarterly.data as AreaStat[],
    }
  }
  const [children, measurements, followUps] = await Promise.all([
    fetchAll<ChildRow>('children'),
    fetchAll<MeasurementRow>('measurements'),
    fetchAll<FollowUpRow>('follow_ups'),
  ])
  // numeric columns arrive as strings or numbers depending on the driver; keep them numbers.
  for (const m of measurements) {
    for (const k of ['weight_kg', 'height_cm', 'haz', 'waz', 'whz'] as const) if (m[k] !== null) m[k] = Number(m[k])
  }
  const all = monthlyStats(
    posyandu.map((p) => p.id),
    children,
    measurements,
    statMonths,
  )
  return {
    today,
    months,
    posyandu,
    children,
    measurements,
    followUps,
    stats: all.filter((r) => months.includes(r.month)),
    village: villageMonthly(all, months, false),
    quarter,
    dusun: dusunQuarter(posyandu, all, quarter, false),
  }
}

export type NewFollowUp = Omit<FollowUpRow, 'id' | 'deleted_at' | 'created_at' | 'updated_at' | 'recorded_by'>

export async function saveFollowUp(session: Session, input: NewFollowUp): Promise<FollowUpRow> {
  const row: FollowUpRow = { ...input, id: crypto.randomUUID(), deleted_at: null }
  if (session.demo) {
    localStorage.setItem(DEMO_FOLLOW_UPS, JSON.stringify([...demoExtraFollowUps(), row]))
    return row
  }
  const { data, error } = await supabase!.from('follow_ups').insert(row).select().single()
  if (error) throw error
  return data as FollowUpRow
}

export function resetDemoFollowUps() {
  localStorage.removeItem(DEMO_FOLLOW_UPS)
}
