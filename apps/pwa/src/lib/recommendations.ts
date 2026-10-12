// Advice cards the kader passes on to the mother. Wording is a draft for the bidan to review.
import type { RiskFactors, Warning } from '@growsense/core'

export interface Advice {
  title: string
  body: string
}

export function recommendations(warning: Warning, factors: RiskFactors, birthWeightKg: number | null): Advice[] {
  const list: Advice[] = []
  const growthConcern = warning.level === 'tinggi' || warning.level === 'sedang'
  if (growthConcern || factors.mpasi_adekuat === false) {
    list.push({
      title: 'Protein hewani setiap hari',
      body: 'Beri 1 butir telur atau sepotong ikan setiap hari sebagai lauk MP-ASI.',
    })
  }
  if (factors.sanitasi_layak === false) {
    list.push({
      title: 'Air matang dan cuci tangan',
      body: 'Masak air minum sampai mendidih dan cuci tangan pakai sabun sebelum menyiapkan makanan anak.',
    })
  }
  if (factors.imunisasi_lengkap === false) {
    list.push({
      title: 'Lengkapi imunisasi',
      body: 'Bawa anak ke Posyandu untuk imunisasi yang belum diberikan sesuai jadwal.',
    })
  }
  if (birthWeightKg !== null && birthWeightKg < 2.5) {
    list.push({
      title: 'Timbang tiap bulan',
      body: 'Anak lahir dengan berat rendah. Usahakan tidak terlewat penimbangan bulanan.',
    })
  }
  return list.slice(0, 3)
}
