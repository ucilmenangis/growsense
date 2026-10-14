// d13: monthly report for the Puskesmas, ready to print.
import { useState } from 'react'
import { FileDown, Printer, Scale, TrendingDown } from 'lucide-react'
import { monthLabel, num, pct, sumStats, toCsv, type MonthlyStat } from '@growsense/core'
import { useStore } from '../data/store'
import { Bar, Button, Card, CardTitle, Kpi, Note, PageHeader, Select, Td, Th } from '../components/ui'
import { download } from '../lib/download'

const share = (n: number, d: number) => (d ? n / d : 0)

export function Report() {
  const { data, summaries, session, posyanduById } = useStore()
  const [month, setMonth] = useState(data.months.at(-1)!)
  const rows = data.stats.filter((r) => r.month === month)
  const total = sumStats(rows, 'total', month)
  const prev = sumStats(
    data.stats.filter((r) => r.month === data.months[data.months.indexOf(month) - 1]),
    'total',
  )
  const high = summaries.filter((s) => s.warning.level === 'tinggi').length

  const line = (label: string, r: MonthlyStat) => [
    label,
    r.sasaran,
    r.ditimbang,
    pct(r.ditimbang, r.sasaran),
    r.stunting,
    r.sangat_pendek,
    r.wasting,
    r.underweight,
    pct(r.stunting, r.ditimbang),
  ]
  const csv = () =>
    toCsv([
      [
        'Posyandu',
        'Sasaran (S)',
        'Ditimbang (D)',
        'D/S',
        'Pendek',
        'Sangat pendek',
        'Gizi kurang (BB/TB)',
        'BB kurang',
        'Prevalensi pendek',
      ],
      ...rows.map((r) => line(posyanduById.get(r.posyandu_id)?.name ?? '', r)),
      line('Total', total),
    ])

  const delta = (now: number, before: number) => {
    const d = (now - before) * 100
    return `${d > 0 ? 'naik' : d < 0 ? 'turun' : 'tetap'} ${num(Math.abs(d))} poin dari bulan lalu`
  }

  return (
    <>
      <PageHeader
        eyebrow="Pelaporan rutin"
        title="Laporan bulanan otomatis"
        description={`Rekap status gizi ${data.posyandu.length} Posyandu untuk ${session.puskesmasName}, dihitung otomatis dari data kader tanpa rekap manual.`}
        actions={
          <>
            <Select
              label="Bulan"
              value={month}
              onChange={setMonth}
              options={[...data.months].reverse().map((m) => ({ value: m, label: monthLabel(m) }))}
            />
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={() => download(`growsense-laporan-${month}.csv`, csv())}>
                <FileDown size={16} /> CSV
              </Button>
              <Button onClick={() => window.print()}>
                <Printer size={16} /> Cetak / PDF
              </Button>
            </div>
          </>
        }
      />
      <p className="mb-4 hidden text-sm print:block">
        Laporan bulan {monthLabel(month)} · {session.puskesmasName} · dicetak dari GrowSense
        {session.demo ? ' (DATA CONTOH)' : ''}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <Kpi label="Sasaran (S)" value={total.sasaran} note="Balita di bawah 5 tahun" icon={<Scale size={18} />} />
        <Kpi
          label="Ditimbang (D/S)"
          value={pct(total.ditimbang, total.sasaran)}
          note={`${total.ditimbang} balita`}
          tone={share(total.ditimbang, total.sasaran) >= 0.8 ? 'ok' : 'warn'}
        />
        <Kpi
          label="Prevalensi pendek"
          value={pct(total.stunting, total.ditimbang)}
          note={
            prev.ditimbang
              ? delta(share(total.stunting, total.ditimbang), share(prev.stunting, prev.ditimbang))
              : 'TB/U di bawah -2 SD'
          }
          tone="danger"
          icon={<TrendingDown size={18} />}
        />
        <Kpi label="Perlu kunjungan saat ini" value={high} tone="warn" note="Peringatan dini tinggi" />
      </div>

      <Card className="mb-6 break-inside-avoid">
        <CardTitle
          title="Distribusi status gizi"
          subtitle={`Dari ${total.ditimbang} balita yang ditimbang, Permenkes No. 2 Tahun 2020`}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Pendek dan sangat pendek (TB/U < -2 SD)', n: total.stunting },
            { label: 'Sangat pendek (TB/U < -3 SD)', n: total.sangat_pendek },
            { label: 'Gizi kurang dan buruk (BB/TB < -2 SD)', n: total.wasting },
            { label: 'Berat badan kurang (BB/U < -2 SD)', n: total.underweight },
          ].map((r) => (
            <div key={r.label} className="rounded-xl bg-surface-low p-3">
              <div className="mb-1.5 flex justify-between text-sm">
                <span>{r.label}</span>
                <span className="font-semibold">
                  {r.n} ({pct(r.n, total.ditimbang)})
                </span>
              </div>
              <Bar value={share(r.n, total.ditimbang)} tone="bg-danger" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <CardTitle title={`Matriks rekapitulasi ${data.posyandu.length} Posyandu`} subtitle={monthLabel(month)} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-surface-high">
              <tr>
                <Th>Posyandu</Th>
                <Th>Dusun</Th>
                <Th className="text-right">S</Th>
                <Th className="text-right">D</Th>
                <Th className="text-right">D/S</Th>
                <Th className="text-right">Pendek</Th>
                <Th className="text-right">Sangat pendek</Th>
                <Th className="text-right">Gizi kurang</Th>
                <Th className="text-right">BB kurang</Th>
                <Th className="text-right">% pendek</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.posyandu_id} className="border-b border-surface-low">
                  <Td className="font-semibold">{posyanduById.get(r.posyandu_id)?.name}</Td>
                  <Td>{posyanduById.get(r.posyandu_id)?.dusun}</Td>
                  <Td className="text-right">{r.sasaran}</Td>
                  <Td className="text-right">{r.ditimbang}</Td>
                  <Td className="text-right">{pct(r.ditimbang, r.sasaran, 0)}</Td>
                  <Td className="text-right">{r.stunting}</Td>
                  <Td className="text-right">{r.sangat_pendek}</Td>
                  <Td className="text-right">{r.wasting}</Td>
                  <Td className="text-right">{r.underweight}</Td>
                  <Td className="text-right">{pct(r.stunting, r.ditimbang)}</Td>
                </tr>
              ))}
              <tr className="bg-surface-low font-semibold">
                <Td>Total</Td>
                <Td />
                <Td className="text-right">{total.sasaran}</Td>
                <Td className="text-right">{total.ditimbang}</Td>
                <Td className="text-right">{pct(total.ditimbang, total.sasaran, 0)}</Td>
                <Td className="text-right">{total.stunting}</Td>
                <Td className="text-right">{total.sangat_pendek}</Td>
                <Td className="text-right">{total.wasting}</Td>
                <Td className="text-right">{total.underweight}</Td>
                <Td className="text-right">{pct(total.stunting, total.ditimbang)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Note label="Cara menghitung">
        Sasaran: balita di bawah 5 tahun pada akhir bulan. Status gizi dari pengukuran terakhir tiap balita dalam bulan
        itu. Nilai yang ditandai tidak wajar oleh aturan WHO tidak ikut dihitung. Prevalensi dibagi jumlah balita yang
        ditimbang.
      </Note>
    </>
  )
}
