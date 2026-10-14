// CSV export shared by the PWA recap and the dashboard. Column layout is generic until the
// e-PPGBM import format is confirmed.
import { classifyHeightForAge, classifyWeightForAge, classifyWeightForHeight } from './classify'
import { ageMonths } from './format'
import type { ChildRow, MeasurementRow } from './records'
import type { ChildSummary } from './summary'

const NUMBER = /^-?\d+(\.\d+)?$/

/**
 * Text starting with = + - @ or a control character runs as a formula in spreadsheet apps.
 * Such cells get a leading apostrophe; plain numbers such as -1.25 are left alone.
 */
export function cell(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !NUMBER.test(s)) s = `'${s}`
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map(cell).join(',')).join('\r\n')

const HEADER = [
  'Nama',
  'NIK',
  'Jenis kelamin',
  'Tanggal lahir',
  'Nama ibu',
  'Tanggal ukur',
  'Umur (bulan)',
  'Berat (kg)',
  'Tinggi (cm)',
  'Cara ukur',
  'Z TB/U',
  'Status TB/U',
  'Z BB/U',
  'Status BB/U',
  'Z BB/TB',
  'Status BB/TB',
]

/** One row per measurement taken in `month` (YYYY-MM). `extra` adds leading columns, e.g. the posyandu. */
export function monthlyCsv<C extends ChildRow, M extends MeasurementRow>(
  list: ChildSummary<C, M>[],
  month: string,
  extra?: { header: string[]; values: (s: ChildSummary<C, M>) => string[] },
): string {
  const rows: (string | number)[][] = [[...(extra?.header ?? []), ...HEADER]]
  for (const s of list) {
    for (const m of s.measurements.filter((m) => m.measured_at.startsWith(month))) {
      const c = s.child
      rows.push([
        ...(extra?.values(s) ?? []),
        c.full_name,
        c.nik ?? '',
        c.sex === 'male' ? 'L' : 'P',
        c.birth_date,
        c.mother_name ?? '',
        m.measured_at,
        String(ageMonths(c.birth_date, m.measured_at)),
        m.weight_kg?.toString() ?? '',
        m.height_cm?.toString() ?? '',
        m.position === 'standing' ? 'Berdiri' : 'Terlentang',
        m.haz?.toString() ?? '',
        m.haz != null ? classifyHeightForAge(m.haz).label : '',
        m.waz?.toString() ?? '',
        m.waz != null ? classifyWeightForAge(m.waz).label : '',
        m.whz?.toString() ?? '',
        m.whz != null ? classifyWeightForHeight(m.whz).label : '',
      ])
    }
  }
  return toCsv(rows)
}
