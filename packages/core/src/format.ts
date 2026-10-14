// Indonesian labels for dates, ages and numbers, shared by the PWA and the dashboard.
import type { Level } from './types'

/** Completed calendar months between two YYYY-MM-DD dates, the way a kader counts age. */
export function ageMonths(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number]
  const [y, m, d] = on.split('-').map(Number) as [number, number, number]
  return (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0)
}

/** 14 bln, or 2 th 3 bln from two years. */
export function ageLabel(birthDate: string, on: string): string {
  const months = ageMonths(birthDate, on)
  if (months < 24) return `${months} bln`
  const rest = months % 12
  return rest ? `${Math.floor(months / 12)} th ${rest} bln` : `${months / 12} th`
}

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const shortMonthFmt = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

/** YYYY-MM-DD read as a local calendar date. */
const localDate = (iso: string) => new Date(`${iso.length === 7 ? `${iso}-01` : iso.slice(0, 10)}T00:00:00`)

export const dateLabel = (iso: string) => dateFmt.format(localDate(iso))
/** Accepts YYYY-MM or YYYY-MM-DD. */
export const monthLabel = (iso: string) => monthFmt.format(localDate(iso))
export const shortMonthLabel = (iso: string) => shortMonthFmt.format(localDate(iso))

export function syncTimeLabel(iso: string | null): string {
  if (!iso) return 'Belum pernah'
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay ? timeFmt.format(d) : dateFmt.format(d)
}

/** Indonesian decimal comma. */
export const num = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',')

export const zLabel = (z: number) => (z > 0 ? '+' : '') + num(z, 2)

/** Share as a percentage label, a dash free placeholder when there is nothing to divide. */
export const pct = (part: number, whole: number, digits = 1) =>
  whole ? `${num((part / whole) * 100, digits)}%` : 'n/a'

/** Accepts both 10,5 and 10.5 as typed on a phone keyboard. */
export function parseDecimal(input: string): number | undefined {
  const value = Number(input.trim().replace(',', '.'))
  return input.trim() === '' || Number.isNaN(value) ? undefined : value
}

export const levelTone: Record<Level, string> = {
  severe: 'bg-danger-container text-danger',
  moderate: 'bg-warn-container text-warn',
  normal: 'bg-ok-container text-ok',
  above: 'bg-surface-container text-primary',
}

/** YYYY-MM-DD of a local date. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const todayIso = () => isoDate(new Date())

/** Shifts a YYYY-MM-DD date by whole months. */
export function shiftMonths(iso: string, months: number): string {
  const d = localDate(iso)
  d.setMonth(d.getMonth() + months)
  return isoDate(d)
}

/** The `count` months up to and including the month of `today`, oldest first, as YYYY-MM. */
export function lastMonths(today: string, count: number): string[] {
  const [y, m] = today.split('-').map(Number) as [number, number]
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

/** Last day of a YYYY-MM month as YYYY-MM-DD. */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return isoDate(new Date(y, m, 0))
}
