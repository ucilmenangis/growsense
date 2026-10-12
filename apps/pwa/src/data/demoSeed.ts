// Example children for demo mode. Values are placed on chosen WHO z-score paths, so the
// statuses and warnings they produce are real outputs of @growsense/core.
import { ageInDays, referenceValue, type Sex } from '@growsense/core'
import type { GrowSenseDb } from './db'
import { todayIso } from './queries'
import { addChild, recordMeasurement } from './repo'

interface Example {
  name: string
  mother: string
  sex: Sex
  ageMonths: number
  /** Height for age z, weight for age z per visit, oldest first. Last visit is this month unless `skipThisMonth`. */
  path: [number, number][]
  skipThisMonth?: boolean
  factors: { asi_eksklusif: boolean; mpasi_adekuat: boolean; imunisasi_lengkap: boolean; sanitasi_layak: boolean }
}

const good = { asi_eksklusif: true, mpasi_adekuat: true, imunisasi_lengkap: true, sanitasi_layak: true }

// Monthly visits. Falling paths drop about 0.1 to 0.2 SD a month, so the child still grows, just slower.
const EXAMPLES: Example[] = [
  {
    name: 'Aisyah Putri',
    mother: 'Endang',
    sex: 'female',
    ageMonths: 14,
    path: [
      [0.2, 0.1],
      [0.25, 0.2],
      [0.2, 0.15],
      [0.25, 0.2],
    ],
    factors: good,
  },
  {
    name: 'Muhammad Rayhan',
    mother: 'Siti Fatimah',
    sex: 'male',
    ageMonths: 24,
    path: [
      [-0.95, -0.7],
      [-1.13, -0.82],
      [-1.32, -0.95],
      [-1.52, -1.08],
    ],
    factors: { ...good, mpasi_adekuat: false },
  },
  {
    name: 'Dimas Prasetyo',
    mother: 'Rina',
    sex: 'male',
    ageMonths: 18,
    path: [
      [-1.0, -0.8],
      [-1.08, -0.85],
      [-1.18, -0.9],
      [-1.32, -0.98],
    ],
    factors: { ...good, sanitasi_layak: false },
  },
  {
    name: 'Nayla Ramadhani',
    mother: 'Wulan',
    sex: 'female',
    ageMonths: 30,
    path: [
      [-2.3, -1.6],
      [-2.35, -1.65],
      [-2.4, -1.7],
      [-2.4, -1.75],
    ],
    factors: { ...good, imunisasi_lengkap: false },
  },
  {
    name: 'Fajar Maulana',
    mother: 'Sri Wahyuni',
    sex: 'male',
    ageMonths: 9,
    path: [
      [0.6, 0.4],
      [0.7, 0.5],
      [0.6, 0.5],
      [0.65, 0.5],
    ],
    factors: good,
  },
  {
    name: 'Zahra Aulia',
    mother: 'Nur Hasanah',
    sex: 'female',
    ageMonths: 36,
    path: [
      [-0.4, -0.3],
      [-0.45, -0.35],
      [-0.5, -0.4],
    ],
    skipThisMonth: true,
    factors: good,
  },
  {
    name: 'Rizky Saputra',
    mother: 'Yuliana',
    sex: 'male',
    ageMonths: 42,
    path: [
      [-0.2, 0.0],
      [-0.25, -0.05],
      [-0.3, -0.1],
    ],
    skipThisMonth: true,
    factors: good,
  },
  {
    name: 'Salsabila',
    mother: 'Dewi Lestari',
    sex: 'female',
    ageMonths: 6,
    path: [
      [0.0, -0.2],
      [-0.1, -0.3],
      [-0.05, -0.25],
      [-0.1, -0.2],
    ],
    factors: good,
  },
]

function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setMonth(d.getMonth() + months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const round1 = (n: number) => Math.round(n * 10) / 10

export async function seedDemo(db: GrowSenseDb, posyanduId: string): Promise<void> {
  const today = todayIso()
  for (const ex of EXAMPLES) {
    const child = await addChild(db, {
      posyandu_id: posyanduId,
      full_name: ex.name,
      sex: ex.sex,
      birth_date: shiftMonths(today, -ex.ageMonths),
      mother_name: ex.mother,
      consent_at: new Date().toISOString(),
    })
    const last = ex.skipThisMonth ? -1 : 0
    for (const [i, [haz, waz]] of ex.path.entries()) {
      const date = shiftMonths(today, last - (ex.path.length - 1 - i))
      const day = ageInDays(child.birth_date, date)
      await recordMeasurement(db, {
        child_id: child.id,
        measured_at: date,
        height_cm: round1(referenceValue('heightForAge', ex.sex, day, haz)!),
        weight_kg: round1(referenceValue('weightForAge', ex.sex, day, waz)!),
        risk_factors: ex.factors,
      })
    }
  }
}
