// Monthly recap as CSV. Column layout is generic until the e-PPGBM import format is confirmed.
import type { ChildSummary } from '../data/queries'
import { ageMonths } from './format'
import { classifyHeightForAge, classifyWeightForAge, classifyWeightForHeight } from '@growsense/core'

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

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Rows for measurements taken in `month` (YYYY-MM). */
export function monthlyCsv(list: ChildSummary[], month: string): string {
  const rows = [HEADER]
  for (const s of list) {
    for (const m of s.measurements.filter((m) => m.measured_at.startsWith(month))) {
      const c = s.child
      rows.push([
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
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
