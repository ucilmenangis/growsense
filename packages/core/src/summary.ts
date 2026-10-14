// One summary per child, shared by the PWA and the dashboard so both rank children the same way.
import { earlyWarning, type Warning } from './warning'
import type { ChildRow, MeasurementRow } from './records'
import { ageInDays, MAX_AGE_DAYS } from './zscore'

export interface ChildSummary<C extends ChildRow = ChildRow, M extends MeasurementRow = MeasurementRow> {
  child: C
  ageDays: number
  /** Not deleted, oldest first. */
  measurements: M[]
  latest: M | undefined
  measuredThisMonth: boolean
  warning: Warning
}

const RISK_ORDER = { tinggi: 0, sedang: 1, rendah: 2 } as const

/** Live children under five on `today` (YYYY-MM-DD), sorted by name. */
export function summarize<C extends ChildRow, M extends MeasurementRow>(
  children: C[],
  measurements: M[],
  today: string,
): ChildSummary<C, M>[] {
  const month = today.slice(0, 7)
  const byChild = new Map<string, M[]>()
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
      return {
        child,
        ageDays: ageInDays(child.birth_date, today),
        measurements: list,
        latest: list.at(-1),
        measuredThisMonth: list.some((m) => m.measured_at.startsWith(month)),
        warning: earlyWarning(list),
      }
    })
    .filter((s) => s.ageDays >= 0 && s.ageDays <= MAX_AGE_DAYS)
    .sort((a, b) => a.child.full_name.localeCompare(b.child.full_name, 'id'))
}

/** Most urgent first: risk level, then the largest fall in height for age. */
export function byPriority<S extends ChildSummary<ChildRow, MeasurementRow>>(list: S[]): S[] {
  const rank = (s: S) => (s.warning.level ? RISK_ORDER[s.warning.level] : 3)
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.warning.hazChange ?? 0) - (b.warning.hazChange ?? 0))
}

export const needsAttention = (s: ChildSummary<ChildRow, MeasurementRow>) =>
  s.warning.level === 'tinggi' || s.warning.level === 'sedang'
