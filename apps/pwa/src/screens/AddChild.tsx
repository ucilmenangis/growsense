// Register a child. Parental consent is required before any data is stored (laporan bagian etika).
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, Choice, Field, inputClass, SubHeader } from '../components/ui'
import { db } from '../data/instance'
import { todayIso } from '../data/queries'
import { addChild } from '../data/repo'
import { useAppState } from '../lib/appState'
import { parseDecimal } from '../lib/format'

export function AddChild() {
  const { session } = useAppState()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>()
  const [birthDate, setBirthDate] = useState('')
  const [mother, setMother] = useState('')
  const [nik, setNik] = useState('')
  const [birthWeight, setBirthWeight] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')

  const today = todayIso()
  const minDate = `${Number(today.slice(0, 4)) - 5}${today.slice(4)}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!sex) return setError('Pilih jenis kelamin')
    if (nik && !/^\d{16}$/.test(nik)) return setError('NIK harus 16 angka, atau kosongkan')
    const weight = parseDecimal(birthWeight)
    if (birthWeight && (weight === undefined || weight < 0.3 || weight > 7))
      return setError('Berat lahir tidak wajar (kg)')
    const child = await addChild(db, {
      posyandu_id: session.posyanduId,
      full_name: name,
      sex,
      birth_date: birthDate,
      mother_name: mother.trim() || undefined,
      nik: nik || undefined,
      birth_weight_kg: weight,
      consent_at: new Date().toISOString(),
    })
    navigate(`/balita/${child.id}/timbang`, { replace: true })
  }

  return (
    <>
      <SubHeader title="Balita baru" subtitle={session.posyanduName} />
      <form onSubmit={submit} className="space-y-5 px-4 pb-10 pt-2">
        <Field label="Nama balita">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
          />
        </Field>
        <Field group label="Jenis kelamin">
          <Choice
            value={sex}
            onChange={setSex}
            options={[
              { value: 'male', label: 'Laki-laki' },
              { value: 'female', label: 'Perempuan' },
            ]}
          />
        </Field>
        <Field label="Tanggal lahir">
          <input
            className={inputClass}
            type="date"
            value={birthDate}
            min={minDate}
            max={today}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Nama ibu">
          <input className={inputClass} value={mother} onChange={(e) => setMother(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="NIK balita" hint="Boleh dikosongkan kalau belum ada.">
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={16}
            value={nik}
            onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Berat lahir (kg)" hint="Lihat buku KIA. Boleh dikosongkan.">
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="3,1"
            value={birthWeight}
            onChange={(e) => setBirthWeight(e.target.value)}
          />
        </Field>

        <label className="flex items-start gap-3 rounded-xl bg-surface-low p-4">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-[#006194]"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span className="text-sm">
            Orang tua sudah setuju data anak dicatat untuk pemantauan tumbuh kembang oleh kader dan bidan Puskesmas.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-container px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!consent}>
          Simpan dan timbang
        </Button>
      </form>
    </>
  )
}
