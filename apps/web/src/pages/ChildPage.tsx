// d06 detail: one child's growth, measurements, risk factors and follow up history.
import { Link, useParams } from 'react-router'
import { ArrowLeft, HeartPulse, LineChart, ListChecks, NotebookPen, Ruler } from 'lucide-react'
import {
  ageLabel,
  ageMonths,
  classifyHeightForAge,
  classifyWeightForAge,
  classifyWeightForHeight,
  dateLabel,
  levelTone,
  num,
  zLabel,
} from '@growsense/core'
import { Avatar, GrowthChart, RiskBadge, riskTone } from '@growsense/ui'
import { useStore } from '../data/store'
import { Badge, Card, CardTitle, Empty, Td, Th } from '../components/ui'
import { STAGE_LABEL } from '../lib/followUp'
import { FACTOR_LABEL, FLAG_LABEL, sexLabel } from '../lib/labels'

export function ChildPage() {
  const { id } = useParams()
  const { summaries, data, posyanduById, followUpsByChild } = useStore()
  const s = summaries.find((x) => x.child.id === id)
  if (!s)
    return (
      <Empty>
        Balita tidak ditemukan atau sudah berumur lebih dari 5 tahun.{' '}
        <Link to="/balita" className="font-semibold text-primary">
          Kembali ke daftar
        </Link>
      </Empty>
    )

  const { child, latest, warning } = s
  const p = posyanduById.get(child.posyandu_id)
  const notes = followUpsByChild.get(child.id) ?? []
  const factors = latest?.risk_factors ?? {}

  return (
    <>
      <Link to="/balita" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <ArrowLeft size={16} /> Semua balita
      </Link>

      <Card className="mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={child.full_name} sex={child.sex} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{child.full_name}</h1>
              <RiskBadge level={warning.level} />
            </div>
            <p className="text-sm text-on-surface-variant">
              {sexLabel(child.sex)} · {ageLabel(child.birth_date, data.today)} (lahir {dateLabel(child.birth_date)}) ·
              Ibu {child.mother_name ?? 'belum diisi'}
            </p>
            <p className="text-sm text-on-surface-variant">
              {p?.name}
              {p?.dusun ? `, ${p.dusun}` : ''} · NIK {child.nik ?? 'belum diisi'} · BB lahir{' '}
              {child.birth_weight_kg !== null ? `${num(child.birth_weight_kg)} kg` : 'belum diisi'}
            </p>
          </div>
          <Link
            to={`/tindak-lanjut?anak=${child.id}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-container"
          >
            <NotebookPen size={16} /> Catat tindak lanjut
          </Link>
        </div>
        {warning.level && warning.level !== 'rendah' && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${riskTone[warning.level]}`}>
            <p className="font-semibold">Peringatan dini dari tren 3 bulan terakhir</p>
            <ul className="mt-1 list-inside list-disc">
              {warning.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle
            icon={<LineChart size={18} />}
            title="Kurva tinggi badan menurut umur"
            subtitle="Standar WHO, garis 0, -2, dan -3 SD"
          />
          <GrowthChart sex={child.sex} birthDate={child.birth_date} measurements={s.measurements} />
        </Card>
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardTitle
              icon={<Ruler size={18} />}
              title="Status gizi terakhir"
              subtitle={latest ? `Ditimbang ${dateLabel(latest.measured_at)}` : 'Belum ada pengukuran'}
            />
            {latest && (
              <ul className="space-y-2 text-sm">
                {[
                  { label: 'TB/U', z: latest.haz, c: latest.haz != null ? classifyHeightForAge(latest.haz) : null },
                  { label: 'BB/U', z: latest.waz, c: latest.waz != null ? classifyWeightForAge(latest.waz) : null },
                  { label: 'BB/TB', z: latest.whz, c: latest.whz != null ? classifyWeightForHeight(latest.whz) : null },
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between rounded-xl bg-surface-low px-3 py-2">
                    <span className="font-medium">{row.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{row.z != null ? zLabel(row.z) : '?'}</span>
                      {row.c && <Badge className={levelTone[row.c.level]}>{row.c.label}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle
              icon={<HeartPulse size={18} />}
              title="Faktor risiko"
              subtitle="Jawaban ibu pada kunjungan terakhir"
            />
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {(Object.keys(FACTOR_LABEL) as (keyof typeof FACTOR_LABEL)[]).map((k) => (
                <li
                  key={k}
                  className={`rounded-xl px-3 py-2 ${
                    factors[k] === false
                      ? 'bg-warn-container text-warn'
                      : factors[k]
                        ? 'bg-ok-container text-ok'
                        : 'bg-surface-low text-on-surface-variant'
                  }`}
                >
                  <span className="block text-xs">{FACTOR_LABEL[k].topic}</span>
                  <span className="font-semibold">
                    {factors[k] === undefined ? 'Belum ditanya' : factors[k] ? 'Ya' : 'Tidak'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle
            icon={<Ruler size={18} />}
            title="Riwayat pengukuran"
            subtitle={`${s.measurements.length} kunjungan`}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-surface-high">
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Umur</Th>
                  <Th>BB (kg)</Th>
                  <Th>TB (cm)</Th>
                  <Th>Z TB/U</Th>
                  <Th>Z BB/TB</Th>
                  <Th>Catatan data</Th>
                </tr>
              </thead>
              <tbody>
                {[...s.measurements].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-surface-low">
                    <Td>{dateLabel(m.measured_at)}</Td>
                    <Td>{ageMonths(child.birth_date, m.measured_at)} bln</Td>
                    <Td>{m.weight_kg !== null ? num(m.weight_kg) : '?'}</Td>
                    <Td>
                      {m.height_cm !== null ? num(m.height_cm) : '?'}
                      <span className="block text-[11px] text-on-surface-variant">
                        {m.position === 'recumbent' ? 'terlentang' : 'berdiri'}
                      </span>
                    </Td>
                    <Td>{m.haz !== null ? zLabel(m.haz) : '?'}</Td>
                    <Td>{m.whz !== null ? zLabel(m.whz) : '?'}</Td>
                    <Td>
                      {m.flags.map((f) => (
                        <Badge key={f} className="mb-1 bg-danger-container text-danger">
                          {FLAG_LABEL[f]}
                        </Badge>
                      ))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="lg:col-span-5">
          <CardTitle
            icon={<ListChecks size={18} />}
            title="Catatan tindak lanjut"
            subtitle="Dari bidan, terbaru di atas"
          />
          {notes.length === 0 ? (
            <Empty>Belum ada catatan tindak lanjut.</Empty>
          ) : (
            <ol className="space-y-3">
              {[...notes].reverse().map((n) => (
                <li key={n.id} className="rounded-xl bg-surface-low p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-surface-container text-primary">{STAGE_LABEL[n.stage]}</Badge>
                    <span className="text-xs text-on-surface-variant">{dateLabel(n.done_at)}</span>
                  </div>
                  {n.note && <p className="mt-2">{n.note}</p>}
                  {n.actions.length > 0 && (
                    <ul className="mt-1.5 list-inside list-disc text-on-surface-variant">
                      {n.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                  {n.next_at && <p className="mt-1.5 text-xs text-primary">Cek berikutnya {dateLabel(n.next_at)}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  )
}
