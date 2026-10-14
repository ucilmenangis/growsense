// Small SVG charts, no chart library.
import { num, shortMonthLabel } from '@growsense/core'

export interface Series {
  label: string
  color: string
  /** One value per month, null for no data. */
  values: (number | null)[]
  dashed?: boolean
}

/** Line chart of shares (0 to 1) per month. */
export function LineChart({ months, series, height = 220 }: { months: string[]; series: Series[]; height?: number }) {
  const W = 640
  const H = height
  const PAD = { left: 40, right: 16, top: 12, bottom: 28 }
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  // Ticks at quarters of a round maximum: 20%, 40% ... 100%.
  const max = Math.max(0.2, Math.ceil(Math.max(0, ...all) * 5) / 5)
  const x = (i: number) => PAD.left + (i / Math.max(1, months.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#eaedff" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#707881">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {months.map((m, i) => (
          <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#707881">
            {shortMonthLabel(m)}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)))
          let d = ''
          let pen = false
          for (const p of pts) {
            if (!p) {
              pen = false
              continue
            }
            d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
            pen = true
          }
          return (
            <g key={s.label}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dashed ? '5 4' : ''} />
              {pts.map((p, i) =>
                p ? (
                  <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={s.color}>
                    <title>
                      {s.label}, {shortMonthLabel(months[i]!)}: {num((s.values[i] ?? 0) * 100)}%
                    </title>
                  </circle>
                ) : null,
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-on-surface-variant">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
