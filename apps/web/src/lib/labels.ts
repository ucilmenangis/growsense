import type { Flag, RiskFactors } from '@growsense/core'

export const FACTOR_LABEL: Record<keyof Required<RiskFactors>, { no: string; topic: string }> = {
  asi_eksklusif: { no: 'Tidak ASI eksklusif', topic: 'ASI eksklusif' },
  mpasi_adekuat: { no: 'MP-ASI belum cukup', topic: 'MP-ASI cukup' },
  imunisasi_lengkap: { no: 'Imunisasi belum lengkap', topic: 'Imunisasi lengkap' },
  sanitasi_layak: { no: 'Sanitasi belum layak', topic: 'Sanitasi layak' },
}

/** Risk factors answered "no" at the last visit. */
export function unmetFactors(factors: RiskFactors | undefined): string[] {
  if (!factors) return []
  return (Object.keys(FACTOR_LABEL) as (keyof RiskFactors)[])
    .filter((k) => factors[k] === false)
    .map((k) => FACTOR_LABEL[k].no)
}

export const FLAG_LABEL: Record<Flag, string> = {
  haz_tidak_wajar: 'Tinggi tidak wajar untuk umur',
  waz_tidak_wajar: 'Berat tidak wajar untuk umur',
  whz_tidak_wajar: 'Berat tidak wajar untuk tinggi',
  tinggi_turun: 'Tinggi turun dari kunjungan lalu',
  tanggal_mundur: 'Tanggal ukur mundur',
}

export const sexLabel = (sex: 'male' | 'female') => (sex === 'male' ? 'Laki-laki' : 'Perempuan')
