// d05: home visit priority list from the early warning, most urgent first.
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Activity, AlertTriangle, ArrowRight, Baby, ClipboardCheck, NotebookPen, Scale } from 'lucide-react'
import {
  ageLabel,
  byPriority,
  classifyHeightForAge,
  dateLabel,
  needsAttention,
  num,
  pct,
  zLabel,
} from '@growsense/core'
import { Avatar, RiskBadge } from '@growsense/ui'
import { useStore } from '../data/store'
import { Badge, Bar, Card, CardTitle, Empty, Kpi, PageHeader, Select } from '../components/ui'
import { STAGE_LABEL } from '../lib/followUp'
import { unmetFactors } from '../lib/labels'

export function Priority() {
  const { summaries, data, posyanduById, followUpsByChild } = useStore()
  const [posyandu, setPosyandu] = useState('semua')
  const [limit, setLimit] = useState(10)

  const list = useMemo(
    () =>
      byPriority(
        summaries.filter(needsAttention).filter((s) => posyandu === 'semua' || s.child.posyandu_id === posyandu),
      ),
    [summaries, posyandu],
  )
  const high = summaries.filter((s) => s.warning.level === 'tinggi').length
  const medium = summaries.filter((s) => s.warning.level === 'sedang').length
  const measured = summaries.filter((s) => s.measuredThisMonth).length

  const coverage = data.posyandu
    .map((p) => {
      const kids = summaries.filter((s) => s.child.posyandu_id === p.id)
      return { p, total: kids.length, done: kids.filter((s) => s.measuredThisMonth).length }
    })
    .sort((a, b) => a.done / (a.total || 1) - b.done / (b.total || 1))

  return (
    <>
      <PageHeader
        eyebrow="Prioritas utama deteksi dini"
        title="Daftar prioritas kunjungan rumah"
        description="Balita diurutkan dari peringatan dini paling mendesak: tinggi badan di bawah garis atau melambat dalam 3 bulan terakhir, gizi kurang, dan berat sangat kurang."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Balita terdaftar"
          value={summaries.length}
          note={`${data.posyandu.length} Posyandu`}
          icon={<Baby size={18} />}
        />
        <Kpi
          label="Ditimbang bulan ini"
          value={pct(measured, summaries.length, 0)}
          note={`${measured} dari ${summaries.length} balita`}
          icon={<Scale size={18} />}
        />
        <Kpi
          label="Perlu kunjungan"
          value={high}
          tone="danger"
          note="Peringatan tinggi"
          icon={<AlertTriangle size={18} />}
        />
        <Kpi label="Perlu dipantau" value={medium} tone="warn" note="Peringatan sedang" icon={<Activity size={18} />} />
      </div>

      <Card className="mb-6">
        <CardTitle
          icon={<AlertTriangle size={18} />}
          title="Antrean kunjungan rumah"
          subtitle={`${list.length} balita perlu tindak lanjut. Aturan peringatan sementara, menunggu model AI dan persetujuan bidan.`}
          action={
            <Select
              label="Posyandu"
              value={posyandu}
              onChange={setPosyandu}
              options={[
                { value: 'semua', label: 'Semua Posyandu' },
                ...data.posyandu.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          }
        />
        {list.length === 0 ? (
          <Empty>Tidak ada balita dengan peringatan dini.</Empty>
        ) : (
          <div className="space-y-3">
            {list.slice(0, limit).map((s, i) => {
              const latest = s.latest!
              const stage = followUpsByChild.get(s.child.id)?.at(-1)
              const factors = unmetFactors(latest.risk_factors)
              return (
                <article key={s.child.id} className="rounded-xl bg-surface-low/70 p-4 transition hover:bg-surface-low">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="mt-1 w-6 text-center text-sm font-bold text-on-surface-variant">{i + 1}</span>
                    <Avatar name={s.child.full_name} sex={s.child.sex} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{s.child.full_name}</h3>
                        <RiskBadge level={s.warning.level} />
                        {stage && stage.stage !== 'selesai' && (
                          <Badge className="bg-surface-container text-primary">Tahap: {STAGE_LABEL[stage.stage]}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        {ageLabel(s.child.birth_date, data.today)} · Ibu {s.child.mother_name ?? 'belum diisi'} ·{' '}
                        {posyanduById.get(s.child.posyandu_id)?.name}
                        {posyanduById.get(s.child.posyandu_id)?.dusun
                          ? `, ${posyanduById.get(s.child.posyandu_id)?.dusun}`
                          : ''}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-sm">
                        {s.warning.reasons.map((r) => (
                          <li key={r} className="flex gap-1.5">
                            <span className="text-danger">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <dl className="grid grid-cols-3 gap-3 text-sm sm:w-80">
                      <div className="rounded-lg bg-surface-lowest p-2.5">
                        <dt className="text-[11px] text-on-surface-variant">TB / BB terakhir</dt>
                        <dd className="font-semibold">
                          {latest.height_cm !== null ? num(latest.height_cm) : '?'} cm
                          <br />
                          {latest.weight_kg !== null ? num(latest.weight_kg) : '?'} kg
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-lowest p-2.5">
                        <dt className="text-[11px] text-on-surface-variant">Z TB/U</dt>
                        <dd className="font-semibold">{latest.haz !== null ? zLabel(latest.haz) : '?'}</dd>
                        <dd className="text-[11px] text-on-surface-variant">
                          {latest.haz !== null ? classifyHeightForAge(latest.haz).label : ''}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-lowest p-2.5">
                        <dt className="text-[11px] text-on-surface-variant">Ditimbang</dt>
                        <dd className="font-semibold">{dateLabel(latest.measured_at)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-9">
                    <div className="flex flex-wrap gap-1.5">
                      {factors.map((f) => (
                        <Badge key={f} className="bg-warn-container text-warn">
                          {f}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/balita/${s.child.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-surface-container"
                      >
                        Lihat profil
                      </Link>
                      <Link
                        to={`/tindak-lanjut?anak=${s.child.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-container"
                      >
                        <NotebookPen size={15} /> Catat tindak lanjut
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
            {list.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + 10)}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-primary hover:bg-surface-low"
              >
                Tampilkan 10 lagi ({list.length - limit} tersisa)
              </button>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle
            icon={<ClipboardCheck size={18} />}
            title="Progres penimbangan bulan ini"
            subtitle="Posyandu dengan cakupan terendah di atas"
            action={
              <Badge className="bg-surface-low text-primary">
                {coverage.filter((c) => c.total && c.done === c.total).length}/{data.posyandu.length} lengkap
              </Badge>
            }
          />
          <ul className="space-y-2">
            {coverage.slice(0, 6).map(({ p, total, done }) => (
              <li key={p.id} className="flex items-center gap-4 rounded-xl bg-surface-low p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {done}/{total} balita ditimbang bulan ini
                  </p>
                </div>
                <div className="hidden w-28 sm:block">
                  <Bar value={total ? done / total : 0} />
                </div>
                <span className="w-12 text-right text-sm font-semibold text-primary">{pct(done, total, 0)}</span>
              </li>
            ))}
          </ul>
          <Link to="/posyandu" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Semua Posyandu <ArrowRight size={15} />
          </Link>
        </Card>
        <Card className="lg:col-span-5">
          <CardTitle icon={<NotebookPen size={18} />} title="Aksi cepat" subtitle="Pekerjaan rutin bidan" />
          <div className="space-y-2">
            {[
              { to: '/tindak-lanjut', title: 'Papan tindak lanjut', note: 'Rujukan, PMT, kunjungan, evaluasi' },
              { to: '/laporan', title: 'Laporan bulanan', note: 'Rekap 15 Posyandu siap cetak' },
              { to: '/ekspor', title: 'Ekspor e-PPGBM', note: 'Berkas CSV dan FHIR bulan ini' },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center justify-between rounded-xl bg-surface-low p-3 hover:bg-surface-container"
              >
                <span>
                  <span className="block text-sm font-semibold">{a.title}</span>
                  <span className="text-xs text-on-surface-variant">{a.note}</span>
                </span>
                <ArrowRight size={16} className="text-primary" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
