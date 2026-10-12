// Read side for the screens: one summary per child, recomputed live from IndexedDB.
import { useLiveQuery } from 'dexie-react-hooks'
import { ageInDays, earlyWarning, MAX_AGE_DAYS, type Warning } from '@growsense/core'
import type { GrowSenseDb, LocalChild, LocalMeasurement } from './db'

export interface ChildSummary {
  child: LocalChild
  ageDays: number
  measurements: LocalMeasurement[]
  latest: LocalMeasurement | undefined
  measuredThisMonth: boolean
  warning: Warning
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RISK_ORDER = { tinggi: 0, sedang: 1, rendah: 2 } as const

export function summarize(children: LocalChild[], measurements: LocalMeasurement[], today: string): ChildSummary[] {
  const month = today.slice(0, 7)
  const byChild = new Map<string, LocalMeasurement[]>()
  for (const m of measurements) {
    if (m.deleted_at) continue
    const list = byChild.get(m.child_id) ?? []
    list.push(m)
    byChild.set(m.child_id, list)
  }
  return children
    .filter((c) => !c.deleted_at)
    .map((child) => {
      const list = (byChild.get(child.id) ?? []).sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      const latest = list.at(-1)
      return {
        child,
        ageDays: ageInDays(child.birth_date, today),
        measurements: list,
        latest,
        measuredThisMonth: list.some((m) => m.measured_at.startsWith(month)),
        warning: earlyWarning(list),
      }
    })
    .filter((s) => s.ageDays <= MAX_AGE_DAYS)
    .sort((a, b) => a.child.full_name.localeCompare(b.child.full_name, 'id'))
}

/** Most urgent first: risk level, then the largest fall in height for age. */
export function byPriority(list: ChildSummary[]): ChildSummary[] {
  const rank = (s: ChildSummary) => (s.warning.level ? RISK_ORDER[s.warning.level] : 3)
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.warning.hazChange ?? 0) - (b.warning.hazChange ?? 0))
}

export const needsAttention = (s: ChildSummary) => s.warning.level === 'tinggi' || s.warning.level === 'sedang'

export function useChildSummaries(db: GrowSenseDb, posyanduId: string): ChildSummary[] | undefined {
  return useLiveQuery(async () => {
    const children = await db.children.where('posyandu_id').equals(posyanduId).toArray()
    const measurements = await db.measurements
      .where('child_id')
      .anyOf(children.map((c) => c.id))
      .toArray()
    return summarize(children, measurements, todayIso())
  }, [db, posyanduId])
}

export function useChildSummary(db: GrowSenseDb, childId: string | undefined): ChildSummary | null | undefined {
  return useLiveQuery(async () => {
    if (!childId) return null
    const child = await db.children.get(childId)
    if (!child) return null
    const measurements = await db.measurements.where('child_id').equals(childId).toArray()
    return summarize([child], measurements, todayIso())[0] ?? null
  }, [db, childId])
}
