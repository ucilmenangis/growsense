// m04: status, early warning, growth chart, history and advice for one child.
import { MessageCircle, Ruler, Scale, ShieldAlert, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { classifyHeightForAge, classifyWeightForAge, classifyWeightForHeight, type Category } from '@growsense/core'
import { Avatar, GrowthChart, RiskBadge, riskTone } from '@growsense/ui'
import { Badge, Card, SubHeader } from '../components/ui'
import { db } from '../data/instance'
import { todayIso, useChildSummary } from '../data/queries'
import { useAppState } from '../lib/appState'
import { ageLabel, dateLabel, levelTone, num, zLabel } from '../lib/format'
import { recommendations } from '../lib/recommendations'
import { flagText } from './Measure'

function ZCard({ label, z, classify }: { label: string; z: number | null; classify: (z: number) => Category }) {
  const category = z === null ? null : classify(z)
  return (
    <div className="flex flex-col rounded-xl bg-surface-lowest p-3 shadow-card">
      <p className="text-[11px] font-semibold text-on-surface-variant">{label}</p>
      <p className="mt-1 text-xl font-semibold">{z === null ? 'n/a' : zLabel(z)}</p>
      <p className="text-[10px] text-on-surface-variant">SD</p>
      {category && (
        <span
          className={`mt-2 rounded-lg px-1.5 py-1 text-center text-[10px] font-semibold leading-tight ${levelTone[category.level]}`}
        >
          {category.label}
        </span>
      )}
    </div>
  )
}

export function ChildDetail() {
  const { id } = useParams()
  const { session } = useAppState()
  const s = useChildSummary(db, id)

  if (s === undefined) return null
  if (s === null) return <p className="p-6">Data balita tidak ditemukan.</p>

  const { child, latest, warning, measurements } = s
  const advice = recommendations(warning, latest?.risk_factors ?? {}, child.birth_weight_kg)

  const shareText = [
    `Hasil timbang ${child.full_name} (${ageLabel(child.birth_date, todayIso())}) di ${session.posyanduName}`,
    latest &&
      `Tanggal ${dateLabel(latest.measured_at)}: berat ${latest.weight_kg != null ? `${num(latest.weight_kg)} kg` : '-'}, tinggi ${latest.height_cm != null ? `${num(latest.height_cm)} cm` : '-'}.`,
    advice.length > 0 && `Saran:\n${advice.map((a, i) => `${i + 1}. ${a.body}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return (
    <>
      <SubHeader title="Hasil pemantauan" subtitle={session.posyanduName} />
      <div className="space-y-4 px-4 pb-10">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={child.full_name} sex={child.sex} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{child.full_name}</p>
              <p className="text-sm text-on-surface-variant">
                {ageLabel(child.birth_date, todayIso())} · {child.sex === 'male' ? 'Laki-laki' : 'Perempuan'}
                {child.mother_name && ` · Ibu ${child.mother_name}`}
              </p>
            </div>
          </div>
          {latest ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-surface-low p-3">
                <Ruler size={18} className="text-primary" />
                <div>
                  <p className="text-[11px] text-on-surface-variant">
                    {latest.position === 'standing' ? 'Tinggi' : 'Panjang'} badan
                  </p>
                  <p className="font-semibold">{latest.height_cm != null ? `${num(latest.height_cm)} cm` : 'n/a'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface-low p-3">
                <Scale size={18} className="text-primary" />
                <div>
                  <p className="text-[11px] text-on-surface-variant">Berat badan</p>
                  <p className="font-semibold">{latest.weight_kg != null ? `${num(latest.weight_kg)} kg` : 'n/a'}</p>
                </div>
              </div>
              <p className="col-span-2 text-xs text-on-surface-variant">
                Timbang terakhir {dateLabel(latest.measured_at)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">Belum pernah ditimbang.</p>
          )}
        </Card>

        {latest && (
          <section>
            <h2 className="mb-2 px-1 font-semibold">Status gizi (standar WHO)</h2>
            <div className="grid grid-cols-3 gap-2">
              <ZCard label="TB/U" z={latest.haz} classify={classifyHeightForAge} />
              <ZCard label="BB/U" z={latest.waz} classify={classifyWeightForAge} />
              <ZCard label="BB/TB" z={latest.whz} classify={classifyWeightForHeight} />
            </div>
            {latest.flags.length > 0 && (
              <p className="mt-2 rounded-xl bg-warn-container px-3 py-2 text-xs text-warn">
                Data perlu dicek: {latest.flags.map((f) => flagText[f]).join(' ')}
              </p>
            )}
          </section>
        )}

        {warning.level && (
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`flex size-9 items-center justify-center rounded-xl ${riskTone[warning.level]}`}>
                  <ShieldAlert size={18} />
                </span>
                <div>
                  <h2 className="font-semibold leading-tight">Peringatan dini</h2>
                  <p className="text-[11px] text-on-surface-variant">Dari tren 3 bulan terakhir</p>
                </div>
              </div>
              <RiskBadge level={warning.level} />
            </div>
            {warning.reasons.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {warning.reasons.map((r) => (
                  <li key={r} className="rounded-xl bg-surface-low px-3 py-2">
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">Pertumbuhan sesuai jalur. Lanjutkan timbang tiap bulan.</p>
            )}
            {warning.level === 'tinggi' && (
              <p className="rounded-xl bg-danger-container px-3 py-2 text-sm font-medium text-danger">
                Laporkan ke bidan desa untuk kunjungan rumah.
              </p>
            )}
            <p className="text-[11px] text-on-surface-variant">
              Alat bantu untuk kader dan bidan, bukan diagnosis. Keputusan tetap di tangan bidan.
            </p>
          </Card>
        )}

        <Card>
          <h2 className="mb-2 font-semibold">Kurva tinggi badan menurut umur</h2>
          <GrowthChart sex={child.sex} birthDate={child.birth_date} measurements={measurements} />
        </Card>

        {advice.length > 0 && (
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h2 className="font-semibold">Saran untuk ibu</h2>
            </div>
            <ol className="space-y-2">
              {advice.map((a, i) => (
                <li key={a.title} className="flex gap-3 rounded-xl bg-surface-low p-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold">{a.title}</span>
                    {a.body}
                  </span>
                </li>
              ))}
            </ol>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e7f6ec] text-sm font-semibold text-[#14713c]"
            >
              <MessageCircle size={18} /> Kirim ke ibu lewat WhatsApp
            </a>
          </Card>
        )}

        {measurements.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">Riwayat timbang</h2>
            <ul className="divide-y divide-surface-container text-sm">
              {[...measurements].reverse().map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <span>{dateLabel(m.measured_at)}</span>
                  <span className="text-on-surface-variant">
                    {m.weight_kg != null ? `${num(m.weight_kg)} kg` : '-'} ·{' '}
                    {m.height_cm != null ? `${num(m.height_cm)} cm` : '-'}
                  </span>
                  {session.demo ? null : m.dirty ? (
                    <Badge className="bg-surface-container text-primary">Belum terkirim</Badge>
                  ) : (
                    <span className="text-xs text-ok">Terkirim</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Link
          to={`/balita/${child.id}/timbang`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary"
        >
          <Scale size={18} /> Timbang sekarang
        </Link>
      </div>
    </>
  )
}
