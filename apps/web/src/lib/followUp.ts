// Case stages on the follow up board. A child with an early warning and no open case waits in
// the first column; a case closes with the stage "selesai".
import { needsAttention, type ChildSummary, type FollowUpRow, type FollowUpStage } from '@growsense/core'

export type Column = 'perlu' | Exclude<FollowUpStage, 'selesai'>

export const COLUMNS: { key: Column; title: string; hint: string }[] = [
  { key: 'perlu', title: 'Perlu tindak lanjut', hint: 'Peringatan dini tinggi atau sedang, belum ada catatan bidan' },
  { key: 'rujukan', title: 'Rujukan', hint: 'Dirujuk ke dokter atau ahli gizi Puskesmas' },
  { key: 'intervensi', title: 'Intervensi dan PMT', hint: 'PMT, edukasi MP-ASI, suplemen' },
  { key: 'kunjungan', title: 'Kunjungan rumah', hint: 'Cek pola makan, sanitasi, air bersih' },
  { key: 'evaluasi', title: 'Evaluasi 30 hari', hint: 'Timbang ulang dan nilai hasilnya' },
]

export const STAGE_LABEL: Record<FollowUpStage, string> = {
  rujukan: 'Rujukan',
  intervensi: 'Intervensi dan PMT',
  kunjungan: 'Kunjungan rumah',
  evaluasi: 'Evaluasi 30 hari',
  selesai: 'Selesai',
}

export interface Case {
  summary: ChildSummary
  column: Column
  latest: FollowUpRow | undefined
}

/** The board: every child with an open case, and every child with a warning but no case yet. */
export function cases(summaries: ChildSummary[], followUps: Map<string, FollowUpRow[]>): Case[] {
  const out: Case[] = []
  for (const s of summaries) {
    const latest = followUps.get(s.child.id)?.at(-1)
    // A closed case opens again when a warning appears after it was closed.
    const closed = latest?.stage === 'selesai' && (s.latest?.measured_at ?? '') <= latest.done_at
    if (latest && latest.stage !== 'selesai') out.push({ summary: s, column: latest.stage, latest })
    else if (needsAttention(s) && !closed) out.push({ summary: s, column: 'perlu', latest })
  }
  return out
}
