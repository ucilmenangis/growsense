// Nutritional status categories from Permenkes No. 2 Tahun 2020 tentang Standar Antropometri Anak.
import type { Category } from './types'

export function classifyHeightForAge(z: number): Category {
  if (z < -3) return { code: 'sangat_pendek', label: 'Sangat pendek', level: 'severe' }
  if (z < -2) return { code: 'pendek', label: 'Pendek', level: 'moderate' }
  if (z <= 3) return { code: 'normal', label: 'Normal', level: 'normal' }
  return { code: 'tinggi', label: 'Tinggi', level: 'above' }
}

export function classifyWeightForAge(z: number): Category {
  if (z < -3) return { code: 'bb_sangat_kurang', label: 'Berat badan sangat kurang', level: 'severe' }
  if (z < -2) return { code: 'bb_kurang', label: 'Berat badan kurang', level: 'moderate' }
  if (z <= 1) return { code: 'bb_normal', label: 'Berat badan normal', level: 'normal' }
  return { code: 'risiko_bb_lebih', label: 'Risiko berat badan lebih', level: 'above' }
}

export function classifyWeightForHeight(z: number): Category {
  if (z < -3) return { code: 'gizi_buruk', label: 'Gizi buruk', level: 'severe' }
  if (z < -2) return { code: 'gizi_kurang', label: 'Gizi kurang', level: 'moderate' }
  if (z <= 1) return { code: 'gizi_baik', label: 'Gizi baik', level: 'normal' }
  if (z <= 2) return { code: 'berisiko_gizi_lebih', label: 'Berisiko gizi lebih', level: 'above' }
  if (z <= 3) return { code: 'gizi_lebih', label: 'Gizi lebih', level: 'above' }
  return { code: 'obesitas', label: 'Obesitas', level: 'above' }
}
