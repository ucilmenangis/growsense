// d11: planning summary for Musrenbangdes and Dinkes, printable. Budget lines are typed in by
// the user; nothing here invents money figures.
import { useEffect, useState } from 'react'
import { ClipboardList, Printer } from 'lucide-react'
import { dateLabel, monthLabel, num } from '@growsense/core'
import { useStore } from '../data/store'
import { Button, Card, CardTitle, inputClass, Note, PageHeader, Td, Th } from '../components/ui'
import { HIDDEN, indicatorValue, pctOrHidden, quarterLabel, shareOf } from '../lib/area'
import { PROGRAM_THRESHOLDS, programs } from '../lib/programs'

const BUDGET_KEY = 'growsense-web-budget'

export function Planning() {
  const { data, session } = useStore()
  const total = data.dusun.find((a) => a.area === null)
  const dusun = data.dusun.filter((a) => a.area !== null)
  const [budget, setBudget] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(BUDGET_KEY) ?? '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  useEffect(() => localStorage.setItem(BUDGET_KEY, JSON.stringify(budget)), [budget])

  if (!total) return <Note label="Belum ada data">Belum ada triwulan yang selesai untuk diringkas.</Note>

  const list = programs(total)
  const priority = [...dusun]
    .map((d) => ({ d, v: indicatorValue(d, 'stunting') }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1))
  const v = data.village
  const first = v.find((r) => r.stunting !== null)
  const last = [...v].reverse().find((r) => r.stunting !== null)
  const trend =
    first && last && first !== last
      ? (shareOf(last.stunting, last.ditimbang)! - shareOf(first.stunting, first.ditimbang)!) * 100
      : null
  const sum = Object.values(budget).reduce((t, x) => t + (Number(x.replace(/\D/g, '')) || 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Tampilan Pemdes dan Dinkes"
        title="Ringkasan untuk perencanaan"
        description="Bahan rapat Musrenbangdes dan kajian Dinkes: prevalensi, dusun prioritas, dan program yang disarankan dari data Posyandu. Bisa dicetak."
        actions={
          <Button onClick={() => window.print()}>
            <Printer size={16} /> Cetak / PDF
          </Button>
        }
      />

      <Card className="mb-6">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Ringkasan eksekutif</p>
        <h2 className="mt-1 text-xl font-bold">
          {session.puskesmasName}, {quarterLabel(data.quarter, true)}
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Disusun {dateLabel(data.today)} dari {data.posyandu.length} Posyandu
          {session.demo ? '. DATA CONTOH, bukan data sungguhan.' : '.'}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Prevalensi pendek', value: pctOrHidden(total.stunting, total.ditimbang) },
            { label: 'Gizi kurang', value: pctOrHidden(total.wasting, total.ditimbang) },
            { label: 'Cakupan D/S', value: pctOrHidden(total.ditimbang, total.sasaran) },
            {
              label: 'Perubahan prevalensi',
              value: trend === null ? HIDDEN : `${trend > 0 ? '+' : ''}${num(trend)} poin`,
              note: first && last ? `${monthLabel(first.month)} ke ${monthLabel(last.month)}` : '',
            },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-surface-low p-3">
              <p className="text-xs text-on-surface-variant">{k.label}</p>
              <p className="text-xl font-bold">{k.value}</p>
              {k.note && <p className="text-[11px] text-on-surface-variant">{k.note}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardTitle title="Dusun prioritas" subtitle="Urut prevalensi pendek tertinggi" />
          <ol className="space-y-2">
            {priority.map(({ d, v }, i) => (
              <li key={d.area} className="flex items-center justify-between rounded-xl bg-surface-low p-3 text-sm">
                <span>
                  <span className="mr-2 font-bold text-on-surface-variant">{i + 1}</span>
                  {d.area}
                </span>
                <span className="font-semibold">{v === null ? HIDDEN : `${num(v * 100)}%`}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="break-inside-avoid">
          <CardTitle
            icon={<ClipboardList size={18} />}
            title="Program yang disarankan"
            subtitle={`Muncul bila ${num(PROGRAM_THRESHOLDS.factorShare * 100, 0)}% atau lebih keluarga menjawab "tidak", atau cakupan di bawah ${num(PROGRAM_THRESHOLDS.coverage * 100, 0)}%`}
          />
          {list.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Tidak ada faktor yang melewati batas pada triwulan ini.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((p) => (
                <li key={p.key} className="rounded-xl bg-surface-low p-3 text-sm">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-on-surface-variant">
                    {num(p.share * 100, 0)}% {p.reason} (dari jawaban ibu selama triwulan ini).
                  </p>
                  <p className="text-xs text-primary">{p.sector}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mb-6 break-inside-avoid">
        <CardTitle title="Rencana anggaran" subtitle="Isi sendiri saat rapat. Angka tersimpan di browser ini saja." />
        <table className="w-full">
          <thead className="border-b border-surface-high">
            <tr>
              <Th>Program</Th>
              <Th>Penanggung jawab</Th>
              <Th className="w-56">Anggaran (Rp)</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.key} className="border-b border-surface-low">
                <Td className="font-semibold">{p.title}</Td>
                <Td>{p.sector}</Td>
                <Td>
                  <input
                    className={`${inputClass} w-full text-right`}
                    inputMode="numeric"
                    value={budget[p.key] ?? ''}
                    placeholder="0"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      setBudget((b) => ({ ...b, [p.key]: digits ? Number(digits).toLocaleString('id-ID') : '' }))
                    }}
                    aria-label={`Anggaran ${p.title}`}
                  />
                </Td>
              </tr>
            ))}
            <tr className="font-semibold">
              <Td>Total</Td>
              <Td />
              <Td className="text-right">Rp {sum.toLocaleString('id-ID')}</Td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Note label="Batasan">
        Saran program memakai batas awal yang masih perlu disepakati dengan bidan dan Pemdes. Angka per dusun dihitung
        per anak per bulan dalam satu triwulan, dan angka kecil disamarkan.
      </Note>
    </>
  )
}
