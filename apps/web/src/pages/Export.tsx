// d12: monthly export files. CSV columns and the FHIR bundle are prototypes until checked
// against the e-PPGBM import template and the SATUSEHAT validator.
import { useMemo, useState } from 'react'
import { Braces, FileDown, FileSpreadsheet, Info } from 'lucide-react'
import { ageMonths, classifyHeightForAge, monthLabel, monthlyCsv, num, zLabel } from '@growsense/core'
import { useStore } from '../data/store'
import { Button, Card, CardTitle, Kpi, Note, PageHeader, Select, Td, Th } from '../components/ui'
import { download } from '../lib/download'
import { fhirBundle } from '../lib/fhir'

export function Export() {
  const { summaries, data, posyanduById } = useStore()
  const [month, setMonth] = useState(data.months.at(-1)!)
  const [posyandu, setPosyandu] = useState('semua')

  const list = useMemo(
    () => summaries.filter((s) => posyandu === 'semua' || s.child.posyandu_id === posyandu),
    [summaries, posyandu],
  )
  const rows = list.flatMap((s) => s.measurements.filter((m) => m.measured_at.startsWith(month)).map((m) => ({ s, m })))
  const noNik = new Set(rows.filter((r) => !r.s.child.nik).map((r) => r.s.child.id)).size
  const flagged = rows.filter((r) => r.m.flags.length).length
  const suffix = `${month}${posyandu === 'semua' ? '' : `-${posyanduById.get(posyandu)?.name.replace(/\s+/g, '')}`}`

  const csv = () =>
    monthlyCsv(list, month, {
      header: ['Posyandu', 'Dusun'],
      values: (s) => [
        posyanduById.get(s.child.posyandu_id)?.name ?? '',
        posyanduById.get(s.child.posyandu_id)?.dusun ?? '',
      ],
    })

  return (
    <>
      <PageHeader
        eyebrow="Pelaporan dan data"
        title="Ekspor siap e-PPGBM dan SATUSEHAT"
        description="Unduh hasil penimbangan sebulan supaya bidan tidak mengetik ulang ke e-PPGBM. Berkas FHIR disiapkan untuk integrasi SATUSEHAT setelah izin resmi."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
        <Select
          label="Bulan"
          value={month}
          onChange={setMonth}
          options={[...data.months].reverse().map((m) => ({ value: m, label: monthLabel(m) }))}
        />
        <Select
          label="Posyandu"
          value={posyandu}
          onChange={setPosyandu}
          options={[
            { value: 'semua', label: 'Semua Posyandu' },
            ...data.posyandu.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Pengukuran" value={rows.length} note={monthLabel(month)} />
        <Kpi
          label="Balita tanpa NIK"
          value={noNik}
          tone={noNik ? 'warn' : 'ok'}
          note="Lengkapi sebelum impor ke e-PPGBM"
        />
        <Kpi
          label="Data perlu dicek"
          value={flagged}
          tone={flagged ? 'warn' : 'ok'}
          note="Tetap ikut diekspor, cek dulu"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle
            icon={<FileSpreadsheet size={18} />}
            title="Rekap CSV untuk e-PPGBM"
            subtitle="Satu baris per pengukuran, z-score dan status Permenkes 2/2020"
          />
          <Button onClick={() => download(`growsense-eppgbm-${suffix}.csv`, csv())} disabled={!rows.length}>
            <FileDown size={16} /> Unduh CSV
          </Button>
        </Card>
        <Card>
          <CardTitle
            icon={<Braces size={18} />}
            title="Bundle FHIR (JSON)"
            subtitle="Observation berat dan tinggi badan dengan kode LOINC, mengikuti bentuk SATUSEHAT"
          />
          <Button
            variant="secondary"
            onClick={() =>
              download(
                `growsense-fhir-${suffix}.json`,
                JSON.stringify(fhirBundle(list, month), null, 2),
                'application/fhir+json',
              )
            }
            disabled={!rows.length}
          >
            <FileDown size={16} /> Unduh JSON
          </Button>
        </Card>
      </div>

      <Card className="mb-6">
        <CardTitle
          icon={<FileSpreadsheet size={18} />}
          title="Pratinjau data"
          subtitle="10 baris pertama, kolom utama"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-surface-high">
              <tr>
                {[
                  'Posyandu',
                  'Nama',
                  'NIK',
                  'JK',
                  'Tanggal ukur',
                  'Umur',
                  'BB (kg)',
                  'TB (cm)',
                  'Z TB/U',
                  'Status TB/U',
                  'Z BB/TB',
                ].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map(({ s, m }) => (
                <tr key={m.id} className="border-b border-surface-low">
                  <Td className="whitespace-nowrap">{posyanduById.get(s.child.posyandu_id)?.name}</Td>
                  <Td className="whitespace-nowrap">{s.child.full_name}</Td>
                  <Td>{s.child.nik ?? <span className="text-warn">kosong</span>}</Td>
                  <Td>{s.child.sex === 'male' ? 'L' : 'P'}</Td>
                  <Td className="whitespace-nowrap">{m.measured_at}</Td>
                  <Td>{ageMonths(s.child.birth_date, m.measured_at)} bln</Td>
                  <Td>{m.weight_kg !== null ? num(m.weight_kg) : ''}</Td>
                  <Td>{m.height_cm !== null ? num(m.height_cm) : ''}</Td>
                  <Td>{m.haz !== null ? zLabel(m.haz) : ''}</Td>
                  <Td className="whitespace-nowrap">{m.haz !== null ? classifyHeightForAge(m.haz).label : ''}</Td>
                  <Td>{m.whz !== null ? zLabel(m.whz) : ''}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Note label="Status prototipe">
        <p className="flex gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          Urutan kolom CSV belum dicocokkan dengan templat impor e-PPGBM, dan bundle FHIR belum diuji ke validator
          SATUSEHAT. Pengiriman langsung ke API SATUSEHAT butuh izin dan kredensial resmi dari Kemenkes, jadi belum
          tersedia.
        </p>
      </Note>
    </>
  )
}
