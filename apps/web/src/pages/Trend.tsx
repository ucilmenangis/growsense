// d09: monthly trend for the whole village, counts only.
import { TrendingDown, TrendingUp, Users } from 'lucide-react'
import { FACTOR_KEYS, monthLabel, num, shortMonthLabel } from '@growsense/core'
import { useStore } from '../data/store'
import { Bar, Card, CardTitle, Kpi, Note, PageHeader, Td, Th } from '../components/ui'
import { LineChart } from '../components/charts'
import { HIDDEN, countOrHidden, pctOrHidden, quarterLabel, shareOf } from '../lib/area'
import { FACTOR_LABEL } from '../lib/labels'
import { programs } from '../lib/programs'

export function Trend() {
  const { data, session } = useStore()
  const v = data.village
  const last = v.at(-1)
  if (!last) return <Note label="Belum ada data">Belum ada triwulan yang selesai untuk ditampilkan.</Note>
  const earlier = v.at(-7)
  const total = data.dusun.find((d) => d.area === null)
  const now = shareOf(last.stunting, last.ditimbang)
  const before = earlier ? shareOf(earlier.stunting, earlier.ditimbang) : null
  const change = now !== null && before !== null ? (now - before) * 100 : null

  return (
    <>
      <PageHeader
        eyebrow="Tampilan Pemdes dan Dinkes"
        title="Tren bulanan balita berisiko dan stunting"
        description="Angka gabungan seluruh Posyandu tanpa identitas balita, untuk memantau dampak program intervensi dari waktu ke waktu."
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Sasaran balita" value={last.sasaran} note={monthLabel(last.month)} icon={<Users size={18} />} />
        <Kpi
          label="Cakupan penimbangan"
          value={pctOrHidden(last.ditimbang, last.sasaran)}
          note={`${last.ditimbang} balita ditimbang`}
          tone={last.ditimbang / (last.sasaran || 1) >= 0.8 ? 'ok' : 'warn'}
        />
        <Kpi
          label="Prevalensi pendek"
          value={pctOrHidden(last.stunting, last.ditimbang)}
          tone="danger"
          note={monthLabel(last.month)}
        />
        <Kpi
          label="Perubahan 6 bulan"
          value={change === null ? HIDDEN : `${change > 0 ? '+' : ''}${num(change)} poin`}
          tone={change === null ? 'primary' : change <= 0 ? 'ok' : 'danger'}
          note={earlier ? `Dibanding ${monthLabel(earlier.month)}` : ''}
          icon={change !== null && change <= 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
        />
      </div>

      <Card className="mb-6">
        <CardTitle
          title={`Tren ${v.length} bulan`}
          subtitle="Persentase dari balita yang ditimbang. Titik kosong berarti angkanya disamarkan."
        />
        <LineChart
          months={v.map((r) => r.month)}
          series={[
            { label: 'Prevalensi pendek', color: '#ba1a1a', values: v.map((r) => shareOf(r.stunting, r.ditimbang)) },
            { label: 'Gizi kurang (BB/TB)', color: '#c77700', values: v.map((r) => shareOf(r.wasting, r.ditimbang)) },
            {
              label: 'Cakupan D/S',
              color: '#006194',
              values: v.map((r) => (r.sasaran ? r.ditimbang / r.sasaran : null)),
              dashed: true,
            },
          ]}
        />
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle title="Angka per bulan" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="border-b border-surface-high">
                <tr>
                  <Th>Bulan</Th>
                  <Th className="text-right">S</Th>
                  <Th className="text-right">D</Th>
                  <Th className="text-right">Pendek</Th>
                  <Th className="text-right">Gizi kurang</Th>
                  <Th className="text-right">% pendek</Th>
                </tr>
              </thead>
              <tbody>
                {[...v].reverse().map((r) => (
                  <tr key={r.month} className="border-b border-surface-low">
                    <Td>
                      {shortMonthLabel(r.month)} {r.month.slice(0, 4)}
                    </Td>
                    <Td className="text-right">{r.sasaran}</Td>
                    <Td className="text-right">{r.ditimbang}</Td>
                    <Td className="text-right">{countOrHidden(r.stunting)}</Td>
                    <Td className="text-right">{countOrHidden(r.wasting)}</Td>
                    <Td className="text-right">{pctOrHidden(r.stunting, r.ditimbang)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="lg:col-span-5">
          <CardTitle
            title="Faktor risiko keluarga"
            subtitle={total ? `${quarterLabel(data.quarter)}, jawaban "tidak"` : ''}
          />
          {total && (
            <ul className="space-y-3">
              {FACTOR_KEYS.map((k) => {
                const f = total.factors[k]
                const s = shareOf(f.no, f.answered)
                return (
                  <li key={k}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{FACTOR_LABEL[k].no}</span>
                      <span className="font-semibold">{pctOrHidden(f.no, f.answered)}</span>
                    </div>
                    <Bar value={s ?? 0} tone="bg-[#c77700]" />
                  </li>
                )
              })}
            </ul>
          )}
          <h3 className="mt-5 mb-2 text-sm font-semibold">Program yang disarankan</h3>
          <ul className="space-y-2 text-sm">
            {total && programs(total).length === 0 && (
              <li className="text-on-surface-variant">Belum ada faktor yang melewati batas.</li>
            )}
            {total &&
              programs(total).map((p) => (
                <li key={p.key} className="rounded-xl bg-surface-low p-3">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-on-surface-variant">{p.sector}</p>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Note label="Perlindungan data">
        {session.role === 'pemdes'
          ? 'Tampilan ini hanya berisi angka gabungan. '
          : 'Pemdes dan Dinkes melihat halaman ini dengan angka kecil disamarkan. '}
        Jumlah 1 atau 2 kasus disamarkan bersama bulan lain dalam triwulan yang sama, supaya tidak bisa ditebak keluarga
        mana. Angka per dusun hanya tersedia per triwulan yang sudah selesai.
      </Note>
    </>
  )
}
