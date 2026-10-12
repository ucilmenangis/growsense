// Interim early warning rule, used until the trained model exists. Thresholds are placeholders
// to be agreed with the bidan; keep them here so the PWA and the dashboard agree.

export type RiskLevel = 'tinggi' | 'sedang' | 'rendah'

export interface VisitZ {
  /** YYYY-MM-DD */
  measured_at: string
  haz: number | null
  waz: number | null
  whz: number | null
}

export interface Warning {
  /** null when there is no measurement yet. */
  level: RiskLevel | null
  reasons: string[]
  /** Largest fall (or smallest rise) in height for age z within the window, null without an earlier visit. */
  hazChange: number | null
}

export const WARNING_THRESHOLDS = {
  /** Visits up to this many days back count when looking for a fall. */
  windowDays: 100,
  /** A fall this large within the window counts as slowing growth. */
  hazFallSlowing: 0.3,
  /** A fall this large counts as fast. */
  hazFallFast: 0.5,
  /** Below this, any fall in height for age is worth watching. */
  hazWatch: -1,
  /** A fast fall that lands below this is high risk. */
  hazNearStunting: -1.5,
} as const

const fmt = (n: number) => n.toFixed(2).replace('.', ',')
const DAY_MS = 86_400_000

export function earlyWarning(visits: VisitZ[]): Warning {
  const sorted = [...visits].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  const latest = sorted.at(-1)
  if (!latest) return { level: null, reasons: [], hazChange: null }

  const withHeight = sorted.filter((v) => v.haz !== null)
  const current = withHeight.at(-1)
  const t = WARNING_THRESHOLDS

  // Compare with every earlier visit in the window and keep the largest fall, so both a sharp
  // drop since last month and a steady slide over three months are caught.
  let hazChange: number | null = null
  let since: string | null = null
  if (current) {
    const earlier = withHeight.slice(0, -1)
    const start = Date.parse(current.measured_at) - t.windowDays * DAY_MS
    const inWindow = earlier.filter((v) => Date.parse(v.measured_at) >= start)
    const candidates = inWindow.length ? inWindow : earlier.slice(-1)
    for (const v of candidates) {
      const change = current.haz! - v.haz!
      if (hazChange === null || change < hazChange) {
        hazChange = change
        since = v.measured_at
      }
    }
  }

  const high: string[] = []
  const medium: string[] = []

  if (current && current.haz! < -2) high.push('Tinggi badan di bawah garis -2 SD (pendek)')
  if (latest.whz !== null && latest.whz < -2) high.push('Berat badan kurang dibanding tinggi badannya (gizi kurang)')
  if (latest.waz !== null && latest.waz < -3) high.push('Berat badan sangat kurang untuk usianya')

  if (hazChange !== null && hazChange < 0 && current && current.haz! >= -2) {
    const months = Math.max(1, Math.round((Date.parse(current.measured_at) - Date.parse(since!)) / DAY_MS / 30.4375))
    const fall = `Pertumbuhan tinggi melambat: turun ${fmt(-hazChange)} SD dalam ${months} bulan terakhir`
    if (-hazChange >= t.hazFallFast && current.haz! < t.hazNearStunting) high.push(fall)
    else if (-hazChange >= t.hazFallSlowing || current.haz! < t.hazWatch) medium.push(fall)
  }
  if (latest.whz !== null && latest.whz >= -2 && latest.whz < -1) medium.push('Berat badan mendekati batas kurang')

  const level: RiskLevel = high.length ? 'tinggi' : medium.length ? 'sedang' : 'rendah'
  return { level, reasons: [...high, ...medium], hazChange }
}
