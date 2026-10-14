// Read side for the screens: one summary per child, recomputed live from IndexedDB.
import { useLiveQuery } from 'dexie-react-hooks'
import { summarize, todayIso, type ChildSummary as CoreSummary } from '@growsense/core'
import type { GrowSenseDb, LocalChild, LocalMeasurement } from './db'

export { byPriority, needsAttention, summarize, todayIso } from '@growsense/core'

export type ChildSummary = CoreSummary<LocalChild, LocalMeasurement>

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
