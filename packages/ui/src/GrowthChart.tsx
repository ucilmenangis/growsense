// Height for age against the WHO reference lines, drawn as plain SVG.
import {
  adjustHeightForPosition,
  ageInDays,
  MAX_AGE_DAYS,
  num,
  referenceValue,
  type MeasurementRow,
  type Sex,
} from '@growsense/core'

const W = 320
const H = 210
const PAD = { left: 34, right: 30, top: 10, bottom: 26 }
const DAYS_PER_MONTH = 30.4375

const LINES = [
  { z: 2, label: '+2', stroke: '#bfc7d2', dash: '' },
  { z: 0, label: '0', stroke: '#1b6b3a', dash: '' },
  { z: -2, label: '-2', stroke: '#c77700', dash: '5 4' },
  { z: -3, label: '-3', stroke: '#ba1a1a', dash: '5 4' },
]

export function GrowthChart({
  sex,
  birthDate,
  measurements,
}: {
  sex: Sex
  birthDate: string
  measurements: Pick<MeasurementRow, 'measured_at' | 'height_cm' | 'position'>[]
}) {
  const points = measurements
    .filter((m) => m.height_cm !== null)
    .map((m) => {
      const day = ageInDays(birthDate, m.measured_at)
      return { day, cm: adjustHeightForPosition(m.height_cm!, day, m.position ?? 'recumbent') }
    })

  const lastDay = points.at(-1)?.day ?? 0
  const firstDay = points[0]?.day ?? 0
  const span = 12 * DAYS_PER_MONTH
  let from = Math.max(0, firstDay - 3 * DAYS_PER_MONTH)
  let to = Math.min(MAX_AGE_DAYS, Math.max(lastDay + 3 * DAYS_PER_MONTH, from + span))
  from = Math.max(0, Math.min(from, to - span))
  to = Math.round(to)
  from = Math.round(from)

  const days: number[] = []
  for (let d = from; d <= to; d += 15) days.push(d)
  if (days.at(-1) !== to) days.push(to)

  const ref = (z: number, d: number) => referenceValue('heightForAge', sex, d, z) ?? 0
  const yMin = Math.floor(Math.min(ref(-3, from), ...points.map((p) => p.cm)) - 1)
  const yMax = Math.ceil(Math.max(ref(2, to), ...points.map((p) => p.cm)) + 1)

  const x = (d: number) => PAD.left + ((d - from) / (to - from)) * (W - PAD.left - PAD.right)
  const y = (cm: number) => PAD.top + (1 - (cm - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)
  const path = (pts: [number, number][]) =>
    pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')

  const yStep = Math.max(2, Math.round((yMax - yMin) / 4 / 2) * 2)
  const yTicks: number[] = []
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) yTicks.push(v)

  const monthFrom = Math.ceil(from / DAYS_PER_MONTH)
  const monthTo = Math.floor(to / DAYS_PER_MONTH)
  const monthStep = monthTo - monthFrom > 18 ? 6 : 3
  const xTicks: number[] = []
  for (let m = Math.ceil(monthFrom / monthStep) * monthStep; m <= monthTo; m += monthStep) xTicks.push(m)

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Grafik tinggi badan menurut umur dibanding garis standar WHO"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#eaedff" />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#707881">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text key={m} x={x(m * DAYS_PER_MONTH)} y={H - 8} textAnchor="middle" fontSize="9" fill="#707881">
            {m} bln
          </text>
        ))}
        {LINES.map((l) => {
          const end = ref(l.z, to)
          return (
            <g key={l.z}>
              <path
                d={path(days.map((d) => [x(d), y(ref(l.z, d))]))}
                fill="none"
                stroke={l.stroke}
                strokeWidth={l.z === 0 ? 1.6 : 1.2}
                strokeDasharray={l.dash}
              />
              <text x={W - PAD.right + 4} y={y(end) + 3} fontSize="9" fill={l.stroke} fontWeight="600">
                {l.label}
              </text>
            </g>
          )
        })}
        {points.length > 1 && (
          <path d={path(points.map((p) => [x(p.day), y(p.cm)]))} fill="none" stroke="#006194" strokeWidth="2" />
        )}
        {points.map((p) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.cm)} r="3.5" fill="#006194" stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <figcaption className="mt-1 text-xs text-on-surface-variant">
        Titik biru: tinggi anak (cm). Garis: standar WHO 0, -2, dan -3 SD.
        {points.length === 0 && ' Belum ada data tinggi badan.'}
        {points.length > 0 && ` Terakhir ${num(points.at(-1)!.cm)} cm.`}
      </figcaption>
    </figure>
  )
}
