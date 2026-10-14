// Program suggestions for village planning, from counts only. The shares that trigger each
// program are first guesses and need to be agreed with the bidan and Pemdes.
import { FACTOR_KEYS, type AreaStat } from '@growsense/core'

export const PROGRAM_THRESHOLDS = {
  /** Share of answers "no" from which a factor becomes a program. */
  factorShare: 0.2,
  /** Weighing coverage below this needs a coverage program. */
  coverage: 0.8,
}

export interface Program {
  key: string
  title: string
  sector: string
  reason: string
  share: number
}

const FACTOR_PROGRAM: Record<(typeof FACTOR_KEYS)[number], { title: string; sector: string; reason: string }> = {
  sanitasi_layak: {
    title: 'Jamban sehat dan air bersih',
    sector: 'Pemdes, PUPR, Sanitarian Puskesmas',
    reason: 'keluarga balita belum punya sanitasi layak',
  },
  mpasi_adekuat: {
    title: 'PMT lokal protein hewani dan kelas MP-ASI',
    sector: 'Puskesmas, PKK, Dana Desa',
    reason: 'balita belum mendapat MP-ASI yang cukup',
  },
  imunisasi_lengkap: {
    title: 'Sweeping imunisasi',
    sector: 'Puskesmas, kader Posyandu',
    reason: 'balita belum imunisasi lengkap',
  },
  asi_eksklusif: {
    title: 'Pendampingan ASI eksklusif',
    sector: 'Bidan desa, Kelompok Pendukung ASI',
    reason: 'balita tidak mendapat ASI eksklusif',
  },
}

/** Programs for one area (or the whole village), largest share first. */
export function programs(area: AreaStat): Program[] {
  const out: Program[] = []
  for (const k of FACTOR_KEYS) {
    const f = area.factors[k]
    if (!f.answered || f.no === null) continue
    const share = f.no / f.answered
    if (share >= PROGRAM_THRESHOLDS.factorShare) out.push({ key: k, ...FACTOR_PROGRAM[k], share })
  }
  const coverage = area.sasaran ? area.ditimbang / area.sasaran : 1
  if (coverage < PROGRAM_THRESHOLDS.coverage)
    out.push({
      key: 'cakupan',
      title: 'Jemput timbang dan insentif kader',
      sector: 'Pemdes, kader Posyandu',
      reason: 'balita belum ditimbang bulan ini',
      share: 1 - coverage,
    })
  return out.sort((a, b) => b.share - a.share)
}
