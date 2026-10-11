// Placeholder screen: a manual z-score checker until the real kader screens are built.
import { useState } from 'react'
import { assess, type Assessment, type IndicatorResult, type Position, type Sex } from '@growsense/core'

const today = new Date().toISOString().slice(0, 10)

function Row({ label, result }: { label: string; result: IndicatorResult | null }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{result ? result.z.toFixed(2) : 'n/a'}</td>
      <td>{result?.category.label ?? 'Data kurang'}</td>
    </tr>
  )
}

export function App() {
  const [sex, setSex] = useState<Sex>('male')
  const [birthDate, setBirthDate] = useState('')
  const [measuredAt, setMeasuredAt] = useState(today)
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [position, setPosition] = useState<Position | ''>('')

  let result: Assessment | null = null
  let error = ''
  if (birthDate) {
    try {
      result = assess({
        sex,
        birthDate,
        measuredAt,
        weightKg: weight ? Number(weight) : undefined,
        heightCm: height ? Number(height) : undefined,
        position: position || undefined,
      })
    } catch (e) {
      error = (e as Error).message
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>GrowSense Kader</h1>
      <p>Cek z-score WHO (sementara, sebelum layar kader dibuat).</p>

      <label>
        Jenis kelamin{' '}
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
          <option value="male">Laki-laki</option>
          <option value="female">Perempuan</option>
        </select>
      </label>
      <br />
      <label>
        Tanggal lahir <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </label>
      <br />
      <label>
        Tanggal ukur <input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
      </label>
      <br />
      <label>
        BB (kg) <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </label>
      <br />
      <label>
        PB/TB (cm) <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
      </label>
      <br />
      <label>
        Posisi ukur{' '}
        <select value={position} onChange={(e) => setPosition(e.target.value as Position | '')}>
          <option value="">Sesuai usia</option>
          <option value="recumbent">Terlentang (PB)</option>
          <option value="standing">Berdiri (TB)</option>
        </select>
      </label>

      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            Usia {result.ageDays} hari ({(result.ageDays / 30.4375).toFixed(1)} bulan)
          </p>
          <table>
            <tbody>
              <Row label="TB/U" result={result.heightForAge} />
              <Row label="BB/U" result={result.weightForAge} />
              <Row label="BB/TB" result={result.weightForHeight} />
            </tbody>
          </table>
          {result.flags.length > 0 && <p role="alert">Cek ulang: {result.flags.join(', ')}</p>}
        </>
      )}
    </main>
  )
}
