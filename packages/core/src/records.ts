// Row shapes shared by the PWA (IndexedDB) and Supabase. Field names match the SQL columns.
import type { Flag, Position, Sex } from './types'

/** Columns filled by the server. The client never sends them. */
export const SERVER_COLUMNS = ['created_at', 'updated_at', 'created_by', 'recorded_by'] as const

interface ServerOwned {
  created_at?: string
  /** Set by the server on every write. Drives incremental pulls. */
  updated_at?: string
  deleted_at: string | null
}

export interface ChildRow extends ServerOwned {
  id: string
  posyandu_id: string
  full_name: string
  nik: string | null
  sex: Sex
  /** YYYY-MM-DD */
  birth_date: string
  mother_name: string | null
  birth_weight_kg: number | null
  consent_at: string | null
}

/** Answers from the form; a missing key means the kader did not ask. */
export interface RiskFactors {
  asi_eksklusif?: boolean
  mpasi_adekuat?: boolean
  imunisasi_lengkap?: boolean
  sanitasi_layak?: boolean
}

export interface MeasurementRow extends ServerOwned {
  id: string
  child_id: string
  /** YYYY-MM-DD */
  measured_at: string
  weight_kg: number | null
  height_cm: number | null
  position: Position | null
  risk_factors: RiskFactors
  haz: number | null
  waz: number | null
  whz: number | null
  flags: Flag[]
  note: string | null
}

export type SyncTable = 'children' | 'measurements'

/**
 * Follow up stages after an early warning. Each note the bidan writes is one row; the latest
 * row of a child gives the current stage, so the history stays readable.
 */
export type FollowUpStage = 'rujukan' | 'intervensi' | 'kunjungan' | 'evaluasi' | 'selesai'

export interface FollowUpRow extends ServerOwned {
  id: string
  child_id: string
  stage: FollowUpStage
  /** YYYY-MM-DD the action took place. */
  done_at: string
  /** YYYY-MM-DD of the next planned check, if any. */
  next_at: string | null
  actions: string[]
  note: string | null
  recorded_by?: string | null
}
