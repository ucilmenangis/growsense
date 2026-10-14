// d08: weighing coverage and data quality for every posyandu.
import { useState } from 'react'
import { Link } from 'react-router'
import { AlertCircle, Building2, ClipboardCheck, ShieldAlert } from 'lucide-react'
import { dateLabel, monthLabel, num, pct, shiftMonths } from '@growsense/core'
import { useStore } from '../data/store'
import { Badge, Bar, Card, CardTitle, Empty, Kpi, PageHeader, Select, Td, Th } from '../components/ui'
import { FLAG_LABEL } from '../lib/labels'

export function Posyandu() {
  const { summaries, data, posyanduById } = useStore()
  const [month, setMonth] = useState(data.months.at(-1)!)
  const since = shiftMonths(data.today, -3)

  const rows = data.posyandu.map((p) => {
    const kids = summaries.filter((s) => s.child.posyandu_id === p.id)
    const stat = data.stats.find((r) => r.posyandu_id === p.id && r.month === month)
    const recent = kids.flatMap((s) => s.measurements.filter((m) => m.measured_at >= since))
    const flagged = recent.filter((m) => m.flags.length > 0).length
    const lastInput = kids
      .map((s) => s.latest?.measured_at ?? '')
      .sort()
      .at(-1)
    return {
      p,
      sasaran: stat?.sasaran ?? 0,
      ditimbang: stat?.ditimbang ?? 0,
      stunting: stat?.stunting ?? 0,
      high: kids.filter((s) => s.warning.level === 'tinggi').length,
      noNik: kids.filter((s) => !s.child.nik).length,
      flagged,
      recent: recent.length,
      lastInput,
    }
  })
  const total = rows.reduce(
    (t, r) => ({
      sasaran: t.sasaran + r.sasaran,
      ditimbang: t.ditimbang + r.ditimbang,
      flagged: t.flagged + r.flagged,
      recent: t.recent + r.recent,
      noNik: t.noNik + r.noNik,
    }),
    { sasaran: 0, ditimbang: 0, flagged: 0, recent: 0, noNik: 0 },
  )
  const anomalies = summaries
    .flatMap((s) => s.measurements.filter((m) => m.flags.length && m.measured_at >= since).map((m) => ({ s, m })))
    .sort((a, b) => b.m.measured_at.localeCompare(a.m.measured_at))

  return (
    <>
      <PageHeader
        eyebrow="Supervisi kader"
        title={`Pemantauan ${data.posyandu.length} Posyandu dan kualitas pencatatan`}
        description="Cakupan penimbangan per Posyandu, data yang perlu dicek ulang, dan kelengkapan identitas. Data tidak wajar ditandai otomatis oleh aturan WHO saat kader menyimpan."
        actions={
          <Select
            label="Bulan"
            value={month}
            onChange={setMonth}
            options={[...data.months].reverse().map((m) => ({ value: m, label: monthLabel(m) }))}
          />
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Sasaran balita (S)" value={total.sasaran} note={monthLabel(month)} icon={<Building2 size={18} />} />
        <Kpi
          label="Ditimbang (D/S)"
          value={pct(total.ditimbang, total.sasaran, 1)}
          note={`${total.ditimbang} balita ditimbang`}
          tone={total.ditimbang / (total.sasaran || 1) >= 0.8 ? 'ok' : 'warn'}
          icon={<ClipboardCheck size={18} />}
        />
        <Kpi
          label="Data perlu dicek"
          value={total.flagged}
          note={`dari ${total.recent} pengukuran 3 bulan terakhir`}
          tone={total.flagged ? 'warn' : 'ok'}
          icon={<ShieldAlert size={18} />}
        />
        <Kpi
          label="NIK belum diisi"
          value={total.noNik}
          note="Diperlukan untuk e-PPGBM"
          tone={total.noNik ? 'warn' : 'ok'}
          icon={<AlertCircle size={18} />}
        />
      </div>

      <Card className="mb-6">
        <CardTitle icon={<Building2 size={18} />} title="Rekap per Posyandu" subtitle={monthLabel(month)} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-surface-high">
              <tr>
                <Th>Posyandu</Th>
                <Th className="text-right">Sasaran</Th>
                <Th className="text-right">Ditimbang</Th>
                <Th className="w-40">Cakupan</Th>
                <Th className="text-right">Pendek (TB/U)</Th>
                <Th className="text-right">Perlu kunjungan</Th>
                <Th className="text-right">Data perlu dicek</Th>
                <Th className="text-right">NIK kosong</Th>
                <Th>Input terakhir</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cov = r.sasaran ? r.ditimbang / r.sasaran : 0
                return (
                  <tr key={r.p.id} className="border-b border-surface-low">
                    <Td>
                      <span className="font-semibold">{r.p.name}</span>
                      <span className="block text-xs text-on-surface-variant">{r.p.dusun}</span>
                    </Td>
                    <Td className="text-right">{r.sasaran}</Td>
                    <Td className="text-right">{r.ditimbang}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Bar value={cov} tone={cov >= 0.8 ? 'bg-ok' : cov >= 0.6 ? 'bg-[#c77700]' : 'bg-danger'} />
                        <span className="w-10 text-right text-xs font-semibold">{pct(r.ditimbang, r.sasaran, 0)}</span>
                      </div>
                    </Td>
                    <Td className="text-right">{r.stunting}</Td>
                    <Td className="text-right">
                      {r.high ? <Badge className="bg-danger-container text-danger">{r.high}</Badge> : 0}
                    </Td>
                    <Td className="text-right">
                      {r.flagged ? <Badge className="bg-warn-container text-warn">{r.flagged}</Badge> : 0}
                    </Td>
                    <Td className="text-right">{r.noNik}</Td>
                    <Td>{r.lastInput ? dateLabel(r.lastInput) : 'Belum ada'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle
          icon={<ShieldAlert size={18} />}
          title="Validasi data tidak wajar"
          subtitle="Pengukuran 3 bulan terakhir yang ditandai aturan WHO atau perbandingan dengan kunjungan sebelumnya. Hubungi kader untuk ukur ulang."
        />
        {anomalies.length === 0 ? (
          <Empty>Tidak ada data yang perlu dicek.</Empty>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {anomalies.map(({ s, m }) => (
              <li key={m.id} className="rounded-xl bg-surface-low p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/balita/${s.child.id}`} className="font-semibold text-primary">
                    {s.child.full_name}
                  </Link>
                  <span className="text-xs text-on-surface-variant">{dateLabel(m.measured_at)}</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {posyanduById.get(s.child.posyandu_id)?.name} · BB {m.weight_kg !== null ? num(m.weight_kg) : '?'} kg
                  · TB {m.height_cm !== null ? num(m.height_cm) : '?'} cm
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.flags.map((f) => (
                    <Badge key={f} className="bg-warn-container text-warn">
                      {FLAG_LABEL[f]}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
