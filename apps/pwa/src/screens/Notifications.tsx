// m05: reminders built from local data, so they also work without signal.
import { useState } from 'react'
import { BellOff, CalendarClock, CloudOff, ShieldAlert, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { SubHeader, Empty } from '../components/ui'
import { db } from '../data/instance'
import { byPriority, needsAttention, useChildSummaries } from '../data/queries'
import { useAppState } from '../lib/appState'
import { dateLabel } from '../lib/format'
import { flagText } from './Measure'

type Kind = 'risiko' | 'cek' | 'jadwal' | 'sinkron'

export interface Notice {
  key: string
  kind: Kind
  urgent?: boolean
  title: string
  body: string
  to?: string
}

export function useNotifications(): Notice[] {
  const { session, pending, status } = useAppState()
  const list = useChildSummaries(db, session.posyanduId) ?? []
  const notices: Notice[] = []

  for (const s of byPriority(list.filter(needsAttention))) {
    notices.push({
      key: `risk-${s.child.id}`,
      kind: 'risiko',
      urgent: s.warning.level === 'tinggi',
      title: `${s.child.full_name}: ${s.warning.level === 'tinggi' ? 'perlu kunjungan bidan' : 'perlu dipantau'}`,
      body: s.warning.reasons.join('. '),
      to: `/balita/${s.child.id}`,
    })
  }
  for (const s of list) {
    if (s.latest?.flags.length && s.measuredThisMonth) {
      notices.push({
        key: `check-${s.latest.id}`,
        kind: 'cek',
        title: `Cek ulang data ${s.child.full_name}`,
        body: `${s.latest.flags.map((f) => flagText[f]).join(' ')} (${dateLabel(s.latest.measured_at)})`,
        to: `/balita/${s.child.id}`,
      })
    }
  }
  const notYet = list.filter((s) => !s.measuredThisMonth).length
  if (notYet > 0) {
    notices.push({
      key: 'schedule',
      kind: 'jadwal',
      title: `${notYet} balita belum ditimbang bulan ini`,
      body: 'Cek daftar dan ajak ibunya datang ke Posyandu.',
      to: '/timbang',
    })
  }
  if (pending > 0 && status !== 'demo') {
    notices.push({
      key: 'sync',
      kind: 'sinkron',
      title: `${pending} data belum terkirim`,
      body: 'Data aman di HP. Akan terkirim sendiri saat ada internet.',
      to: '/profil',
    })
  }
  return notices
}

const icons = {
  risiko: <ShieldAlert size={18} />,
  cek: <TriangleAlert size={18} />,
  jadwal: <CalendarClock size={18} />,
  sinkron: <CloudOff size={18} />,
}
const tones: Record<Kind, string> = {
  risiko: 'bg-danger-container text-danger',
  cek: 'bg-warn-container text-warn',
  jadwal: 'bg-surface-container text-primary',
  sinkron: 'bg-surface-container text-primary',
}

const FILTERS: [Kind | 'semua', string][] = [
  ['semua', 'Semua'],
  ['risiko', 'Peringatan'],
  ['cek', 'Cek data'],
  ['jadwal', 'Jadwal'],
]

export function Notifications() {
  const notices = useNotifications()
  const [filter, setFilter] = useState<Kind | 'semua'>('semua')
  const shown = notices.filter((n) => filter === 'semua' || n.kind === filter)

  return (
    <>
      <SubHeader title="Pemberitahuan" />
      <div className="space-y-4 px-4 pb-10">
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${
                filter === key ? 'bg-primary text-on-primary' : 'bg-surface-low text-on-surface-variant'
              }`}
            >
              {label} ({key === 'semua' ? notices.length : notices.filter((n) => n.kind === key).length})
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <Empty icon={<BellOff size={26} />} title="Tidak ada pemberitahuan" />
        ) : (
          <ul className="space-y-3">
            {shown.map((n) => {
              const body = (
                <div className="flex gap-3 p-3.5">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${n.kind === 'risiko' && !n.urgent ? tones.cek : tones[n.kind]}`}
                  >
                    {icons[n.kind]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{n.title}</p>
                    <p className="mt-0.5 text-sm text-on-surface-variant">{n.body}</p>
                  </div>
                </div>
              )
              return (
                <li key={n.key} className="rounded-xl bg-surface-lowest shadow-card">
                  {n.to ? <Link to={n.to}>{body}</Link> : body}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
