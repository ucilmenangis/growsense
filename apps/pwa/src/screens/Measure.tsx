// m03: weighing form in three short steps. Results and checks are computed live before saving.
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, History, TriangleAlert } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  assess,
  checkAgainstPrevious,
  defaultPosition,
  ageInDays,
  type Flag,
  type Position,
  type RiskFactors,
} from '@growsense/core'
import { Button, Card, Choice, Field, inputClass, SubHeader } from '../components/ui'
import { db } from '../data/instance'
import { todayIso } from '../data/queries'
import { previousMeasurement, recordMeasurement } from '../data/repo'
import { ageLabel, dateLabel, levelTone, num, parseDecimal, zLabel } from '../lib/format'

export const flagText: Record<Flag, string> = {
  haz_tidak_wajar: 'Tinggi badan tidak wajar untuk umurnya. Ukur ulang.',
  waz_tidak_wajar: 'Berat badan tidak wajar untuk umurnya. Timbang ulang.',
  whz_tidak_wajar: 'Berat dan tinggi tidak cocok satu sama lain. Cek ulang keduanya.',
  tinggi_turun: 'Tinggi lebih rendah dari bulan lalu. Ukur ulang.',
  tanggal_mundur: 'Tanggal lebih awal dari penimbangan terakhir.',
}

const FACTORS: { key: keyof RiskFactors; label: string; hint: string; yes: string; no: string }[] = [
  {
    key: 'asi_eksklusif',
    label: 'ASI eksklusif 6 bulan',
    hint: 'Hanya ASI sampai umur 6 bulan',
    yes: 'Ya',
    no: 'Tidak',
  },
  {
    key: 'mpasi_adekuat',
    label: 'MP-ASI dan protein hewani',
    hint: 'Telur, ikan, atau daging setiap hari',
    yes: 'Cukup',
    no: 'Kurang',
  },
  {
    key: 'imunisasi_lengkap',
    label: 'Imunisasi dasar',
    hint: 'Sesuai umur, lihat buku KIA',
    yes: 'Lengkap',
    no: 'Belum',
  },
  { key: 'sanitasi_layak', label: 'Jamban dan air bersih', hint: 'Di rumah keluarga', yes: 'Layak', no: 'Tidak' },
]

const STEPS = ['Ukur', 'Kebiasaan', 'Periksa']

export function Measure() {
  const { id } = useParams()
  const navigate = useNavigate()
  const child = useLiveQuery(() => db.children.get(id ?? ''), [id])
  const [step, setStep] = useState(0)
  const [date, setDate] = useState(todayIso())
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [position, setPosition] = useState<Position>()
  const [factors, setFactors] = useState<RiskFactors>({})
  const [saving, setSaving] = useState(false)

  const previous = useLiveQuery(() => (id ? previousMeasurement(db, id, date) : undefined), [id, date])
  const ageDays = child ? ageInDays(child.birth_date, date) : 0
  const recommended = defaultPosition(ageDays)

  // Carry over last visit's habits so the kader only changes what changed.
  useEffect(() => {
    if (previous) setFactors((f) => (Object.keys(f).length ? f : previous.risk_factors))
  }, [previous])

  const w = parseDecimal(weight)
  const h = parseDecimal(height)
  const result = useMemo(() => {
    if (!child || (w === undefined && h === undefined)) return null
    const input = { sex: child.sex, birthDate: child.birth_date }
    const now = assess({ ...input, measuredAt: date, weightKg: w, heightCm: h, position })
    const flags = [...now.flags]
    if (previous) {
      const before = assess({
        ...input,
        measuredAt: previous.measured_at,
        weightKg: previous.weight_kg ?? undefined,
        heightCm: previous.height_cm ?? undefined,
        position: previous.position ?? undefined,
      })
      flags.push(...checkAgainstPrevious(now, before))
    }
    return { now, flags }
  }, [child, date, w, h, position, previous])

  if (child === undefined) return null
  if (child === null) return <p className="p-6">Data balita tidak ditemukan.</p>

  const canNext = step !== 0 || (w !== undefined && h !== undefined && w > 0 && h > 0)

  async function save() {
    if (!child) return
    setSaving(true)
    await recordMeasurement(db, {
      child_id: child.id,
      measured_at: date,
      weight_kg: w,
      height_cm: h,
      position: position ?? recommended,
      risk_factors: factors,
    })
    navigate(`/balita/${child.id}`, { replace: true })
  }

  const delta = (now: number | undefined, before: number | null | undefined, unit: string) =>
    now !== undefined && before != null ? `${now - before >= 0 ? '+' : ''}${num(now - before)} ${unit}` : null

  return (
    <>
      <SubHeader
        title={child.full_name}
        subtitle={`${ageLabel(child.birth_date, date)} · ${child.sex === 'male' ? 'Laki-laki' : 'Perempuan'}`}
      />
      <div className="space-y-4 px-4 pb-10">
        <ol className="grid grid-cols-3 gap-2 text-center">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-xl p-2 text-xs font-semibold ${
                i === step
                  ? 'bg-primary text-on-primary'
                  : i < step
                    ? 'bg-surface-container text-primary'
                    : 'bg-surface-low text-on-surface-variant'
              }`}
            >
              <span className="mx-auto mb-0.5 flex size-6 items-center justify-center rounded-full bg-white/20">
                {i < step ? <Check size={14} /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card className="space-y-5">
            <Field label="Tanggal timbang">
              <input
                className={inputClass}
                type="date"
                value={date}
                min={child.birth_date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field
              label="Berat badan (kg)"
              hint={
                previous?.weight_kg != null && (
                  <span className="flex items-center gap-1">
                    <History size={12} /> Bulan lalu {num(previous.weight_kg)} kg
                    {delta(w, previous.weight_kg, 'kg') && ` · ${delta(w, previous.weight_kg, 'kg')}`}
                  </span>
                )
              }
            >
              <input
                className={`${inputClass} text-lg`}
                inputMode="decimal"
                placeholder="0,0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>
            <Field
              label="Panjang atau tinggi badan (cm)"
              hint={
                previous?.height_cm != null && (
                  <span className="flex items-center gap-1">
                    <History size={12} /> Bulan lalu {num(previous.height_cm)} cm
                    {delta(h, previous.height_cm, 'cm') && ` · ${delta(h, previous.height_cm, 'cm')}`}
                  </span>
                )
              }
            >
              <input
                className={`${inputClass} text-lg`}
                inputMode="decimal"
                placeholder="0,0"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
            <Field
              group
              label="Cara ukur"
              hint={`Disarankan ${recommended === 'recumbent' ? 'terlentang untuk anak di bawah 2 tahun' : 'berdiri untuk anak 2 tahun ke atas'}.`}
            >
              <Choice
                value={position ?? recommended}
                onChange={setPosition}
                options={[
                  { value: 'recumbent', label: 'Terlentang' },
                  { value: 'standing', label: 'Berdiri' },
                ]}
              />
            </Field>
            {result && result.flags.length > 0 && <FlagList flags={result.flags} />}
          </Card>
        )}

        {step === 1 && (
          <Card className="space-y-5">
            <p className="text-sm text-on-surface-variant">
              Tanyakan ke ibu. Jawaban bulan lalu sudah terisi, ubah kalau berbeda.
            </p>
            {FACTORS.map((f) => (
              <Field key={f.key} group label={f.label} hint={f.hint}>
                <Choice
                  value={factors[f.key]}
                  onChange={(v) => setFactors({ ...factors, [f.key]: v })}
                  options={[
                    { value: true, label: f.yes },
                    { value: false, label: f.no },
                  ]}
                />
              </Field>
            ))}
          </Card>
        )}

        {step === 2 && result && (
          <Card className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-surface-low p-3">
                <p className="text-xs text-on-surface-variant">Berat</p>
                <p className="text-lg font-semibold">{w !== undefined ? `${num(w)} kg` : 'n/a'}</p>
              </div>
              <div className="rounded-xl bg-surface-low p-3">
                <p className="text-xs text-on-surface-variant">
                  {(position ?? recommended) === 'recumbent' ? 'Panjang' : 'Tinggi'}
                </p>
                <p className="text-lg font-semibold">{h !== undefined ? `${num(h)} cm` : 'n/a'}</p>
              </div>
            </div>
            <ul className="space-y-2">
              {(
                [
                  ['Tinggi menurut umur', result.now.heightForAge],
                  ['Berat menurut umur', result.now.weightForAge],
                  ['Berat menurut tinggi', result.now.weightForHeight],
                ] as const
              ).map(([label, r]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-2 rounded-xl bg-surface-low px-3 py-2.5"
                >
                  <span className="text-sm">{label}</span>
                  {r ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelTone[r.category.level]}`}>
                      {r.category.label} ({zLabel(r.z)})
                    </span>
                  ) : (
                    <span className="text-xs text-on-surface-variant">Tidak dihitung</span>
                  )}
                </li>
              ))}
            </ul>
            {result.flags.length > 0 && <FlagList flags={result.flags} />}
            <p className="text-xs text-on-surface-variant">Tanggal timbang {dateLabel(date)}.</p>
          </Card>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" className="w-1/3" onClick={() => setStep(step - 1)}>
              Kembali
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Lanjut <ArrowRight size={18} />
            </Button>
          ) : (
            <Button onClick={() => void save()} disabled={saving}>
              <Check size={18} /> Simpan
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

function FlagList({ flags }: { flags: Flag[] }) {
  return (
    <div role="alert" className="space-y-1.5 rounded-xl bg-warn-container p-3 text-sm text-warn">
      <p className="flex items-center gap-1.5 font-semibold">
        <TriangleAlert size={16} /> Cek ulang sebelum simpan
      </p>
      <ul className="list-disc space-y-0.5 pl-5">
        {flags.map((f) => (
          <li key={f}>{flagText[f]}</li>
        ))}
      </ul>
    </div>
  )
}
