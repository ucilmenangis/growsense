// Example data for the dashboard demo: 15 posyandu with a year of monthly visits. Heights and
// weights are placed on WHO z-score paths and then run through assess(), so every status,
// warning and data quality flag shown in the demo is a real output of this package.
// Names, dusun and coordinates are invented placeholders.
import { assess, checkAgainstPrevious } from './assess'
import { isoDate, shiftMonths } from './format'
import type { ChildRow, FollowUpRow, FollowUpStage, MeasurementRow, RiskFactors } from './records'
import type { Sex } from './types'
import { ageInDays, referenceValue } from './zscore'

export interface PosyanduInfo {
  id: string
  name: string
  dusun: string | null
  lat: number | null
  lng: number | null
}

export interface DemoDataset {
  puskesmas: { id: string; name: string }
  posyandu: PosyanduInfo[]
  children: ChildRow[]
  measurements: MeasurementRow[]
  followUps: FollowUpRow[]
}

const BOYS = [
  'Rayhan',
  'Dimas',
  'Fajar',
  'Rizky',
  'Arkan',
  'Bima',
  'Gilang',
  'Hafiz',
  'Ilham',
  'Kevin',
  'Naufal',
  'Raka',
  'Satria',
  'Yusuf',
  'Zidan',
  'Alif',
  'Daffa',
  'Farhan',
]
const GIRLS = [
  'Aisyah',
  'Nayla',
  'Zahra',
  'Salsabila',
  'Alya',
  'Citra',
  'Dinda',
  'Fitri',
  'Kirana',
  'Laila',
  'Nabila',
  'Putri',
  'Qiana',
  'Rania',
  'Syifa',
  'Tiara',
  'Wulan',
  'Keisha',
]
const LAST = [
  'Pratama',
  'Ramadhan',
  'Saputra',
  'Maulana',
  'Hidayat',
  'Wijaya',
  'Kurniawan',
  'Lestari',
  'Rahmawati',
  'Anggraini',
  'Safitri',
  'Permata',
]
const MOTHERS = [
  'Siti Fatimah',
  'Endang',
  'Rina',
  'Wulan',
  'Sri Wahyuni',
  'Nur Hasanah',
  'Yuliana',
  'Dewi Lestari',
  'Sumiati',
  'Tutik',
  'Ani',
  'Lilik',
  'Musyarofah',
  'Holifah',
  'Suhartini',
  'Rohmah',
]
const DUSUN = ['Dusun A', 'Dusun B', 'Dusun C', 'Dusun D', 'Dusun E']

/** Small deterministic generator so the demo looks the same on every visit. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]!,
    normal: (mean: number, sd: number) =>
      mean + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
  }
}

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (z: number | undefined) => (z === undefined ? null : Math.round(z * 100) / 100 + 0)

type Pattern = 'baik' | 'melambat' | 'pendek' | 'pulih' | 'kurus'

export const DEMO_PUSKESMAS_ID = '00000000-0000-4000-8000-000000000001'

/** Months of history per child. */
const HISTORY = 12

export function demoDataset(today: string, seed = 7): DemoDataset {
  const r = rng(seed)
  const posyandu: PosyanduInfo[] = Array.from({ length: 15 }, (_, i) => ({
    id: uuid('d1000000', i + 1),
    name: `Posyandu ${String(i + 1).padStart(2, '0')}`,
    dusun: DUSUN[Math.floor(i / 3)]!,
    // Placeholder layout: dusun spread west to east, posyandu around each dusun centre.
    lat: Math.round((-8.06 + (Math.floor(i / 3) % 2) * 0.012 + r.normal(0, 0.004)) * 1e5) / 1e5,
    lng: Math.round((113.4 + Math.floor(i / 3) * 0.014 + r.normal(0, 0.004)) * 1e5) / 1e5,
  }))

  const children: ChildRow[] = []
  const measurements: MeasurementRow[] = []
  const followUps: FollowUpRow[] = []
  let childN = 0
  let measureN = 0
  let followN = 0
  const [, , todayDay] = today.split('-').map(Number) as [number, number, number]

  for (const [pi, pos] of posyandu.entries()) {
    const dusunIndex = Math.floor(pi / 3)
    // Dusun C is the area with poorer sanitation and more stunting in the example.
    const hazBias = dusunIndex === 2 ? -0.45 : dusunIndex === 4 ? -0.2 : 0
    const sanitationGood = dusunIndex === 2 ? 0.45 : dusunIndex === 4 ? 0.7 : 0.88
    const attendance = 0.72 + r.next() * 0.24
    const day = r.int(3, 12)
    const count = r.int(10, 15)

    for (let k = 0; k < count; k++) {
      const sex: Sex = r.next() < 0.5 ? 'male' : 'female'
      // Up to 70 months so that some children age out of the under five group during the year.
      const ageMonths = r.int(1, 70)
      const birth = shiftMonths(today, -ageMonths)
      const birthDate = isoDate(new Date(Date.parse(`${birth}T00:00:00`) - r.int(0, 27) * 86_400_000))
      const roll = r.next()
      const pattern: Pattern =
        roll < 0.56 ? 'baik' : roll < 0.71 ? 'melambat' : roll < 0.86 ? 'pendek' : roll < 0.93 ? 'pulih' : 'kurus'
      const child: ChildRow = {
        id: uuid('d2000000', ++childN),
        posyandu_id: pos.id,
        full_name: `${r.pick(sex === 'male' ? BOYS : GIRLS)} ${r.pick(LAST)}`,
        nik: r.next() < 0.75 ? `350900${String(r.int(0, 9_999_999_999)).padStart(10, '0')}` : null,
        sex,
        birth_date: birthDate,
        mother_name: r.pick(MOTHERS),
        birth_weight_kg: r.next() < 0.8 ? round1(r.normal(3.0, 0.4)) : null,
        consent_at: `${shiftMonths(today, -HISTORY)}T08:00:00Z`,
        deleted_at: null,
      }
      children.push(child)

      const factors: RiskFactors = {
        asi_eksklusif: r.next() < 0.7,
        mpasi_adekuat: r.next() < (pattern === 'baik' ? 0.85 : 0.45),
        imunisasi_lengkap: r.next() < 0.85,
        sanitasi_layak: r.next() < sanitationGood,
      }

      const start =
        r.normal(
          pattern === 'pendek' ? -2.55 : pattern === 'pulih' ? -2.35 : pattern === 'melambat' ? -0.75 : 0.1,
          0.3,
        ) + hazBias
      let previous: ReturnType<typeof assess> | null = null
      for (let i = 0; i < HISTORY; i++) {
        const monthsBack = HISTORY - 1 - i
        if (monthsBack === 0 && day > todayDay) continue
        const date = shiftMonths(`${today.slice(0, 8)}${String(day).padStart(2, '0')}`, -monthsBack)
        if (date < child.birth_date) continue
        const ageDays = ageInDays(child.birth_date, date)
        if (ageDays > 1826) continue
        if (r.next() > attendance) continue

        let haz = start + r.normal(0, 0.05)
        if (pattern === 'melambat') haz -= Math.max(0, 4 - monthsBack) * 0.15
        if (pattern === 'pulih') haz += i * 0.04
        if (pattern === 'baik') haz += r.normal(0, 0.08)
        const waz = pattern === 'kurus' ? haz - 1.6 + r.normal(0, 0.1) : haz * 0.6 + r.normal(0, 0.15)

        let height = round1(referenceValue('heightForAge', sex, ageDays, haz)!)
        let weight = round1(referenceValue('weightForAge', sex, ageDays, waz)!)
        // A few typing slips, so the data quality checks have something to find.
        const slip = r.next()
        if (slip < 0.006) weight = round1(weight / 10)
        else if (slip < 0.012 && previous?.heightCmAdjusted) height = round1(height - 2.5)

        const a = assess({ sex, birthDate: child.birth_date, measuredAt: date, weightKg: weight, heightCm: height })
        const flags = previous ? [...a.flags, ...checkAgainstPrevious(a, previous)] : a.flags
        previous = a
        measurements.push({
          id: uuid('d3000000', ++measureN),
          child_id: child.id,
          measured_at: date,
          weight_kg: weight,
          height_cm: height,
          position: a.position,
          risk_factors: factors,
          haz: round2(a.heightForAge?.z),
          waz: round2(a.weightForAge?.z),
          whz: round2(a.weightForHeight?.z),
          flags,
          note: null,
          deleted_at: null,
          updated_at: `${date}T09:00:00Z`,
        })
      }

      // Some children with a long standing problem already have follow up notes from the bidan.
      if ((pattern === 'pendek' || pattern === 'kurus') && r.next() < 0.6) {
        const stages: FollowUpStage[] = ['rujukan', 'intervensi', 'kunjungan', 'evaluasi']
        const reached = r.int(1, stages.length)
        for (let s = 0; s < reached; s++) {
          const doneAt = shiftMonths(today, -(reached - s) - 1)
          followUps.push({
            id: uuid('d4000000', ++followN),
            child_id: child.id,
            stage: stages[s]!,
            done_at: doneAt,
            next_at: s === reached - 1 ? shiftMonths(today, 1) : null,
            actions: FOLLOW_UP_ACTIONS[stages[s]!].slice(0, 2),
            note: FOLLOW_UP_NOTES[stages[s]!],
            deleted_at: null,
          })
        }
      }
    }
  }

  return {
    puskesmas: { id: DEMO_PUSKESMAS_ID, name: 'Puskesmas Rowotengah' },
    posyandu,
    children,
    measurements,
    followUps,
  }
}

/** Suggested actions per stage, shown as checkboxes in the follow up form. */
export const FOLLOW_UP_ACTIONS: Record<FollowUpStage, string[]> = {
  rujukan: ['Rujuk ke dokter Puskesmas', 'Cek penyakit penyerta', 'Konsultasi ahli gizi'],
  intervensi: ['PMT lokal protein hewani', 'Edukasi MP-ASI ke ibu', 'Suplemen gizi mikro'],
  kunjungan: ['Kunjungan rumah', 'Cek sanitasi dan air bersih', 'Cek pola makan keluarga'],
  evaluasi: ['Timbang ulang', 'Evaluasi 30 hari', 'Kesepakatan pemantauan dengan kader'],
  selesai: ['Tumbuh kembali sesuai kurva', 'Dipantau rutin oleh kader'],
}

const FOLLOW_UP_NOTES: Record<FollowUpStage, string> = {
  rujukan: 'Dirujuk ke dokter Puskesmas untuk pemeriksaan lanjutan.',
  intervensi: 'Mulai PMT lokal 90 hari, ibu sudah diberi edukasi MP-ASI.',
  kunjungan: 'Kunjungan rumah, sanitasi dan pola makan sudah dicek bersama kader.',
  evaluasi: 'Timbang ulang setelah 30 hari, dipantau bersama kader.',
  selesai: 'Kasus ditutup.',
}
