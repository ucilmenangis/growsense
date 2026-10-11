import Dexie, { type EntityTable } from 'dexie'
import type { ChildRow, MeasurementRow } from '@growsense/core'

/** dirty is 1 until the server has the latest local version; rev counts local edits. */
export interface LocalFields {
  dirty: 0 | 1
  rev: number
}

export type LocalChild = ChildRow & LocalFields
export type LocalMeasurement = MeasurementRow & LocalFields

export interface Meta {
  key: string
  value: string
}

export class GrowSenseDb extends Dexie {
  children!: EntityTable<LocalChild, 'id'>
  measurements!: EntityTable<LocalMeasurement, 'id'>
  meta!: EntityTable<Meta, 'key'>

  constructor(name = 'growsense') {
    super(name)
    this.version(1).stores({
      children: 'id, posyandu_id, dirty',
      measurements: 'id, child_id, [child_id+measured_at], dirty',
      meta: 'key',
    })
  }
}
