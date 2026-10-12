// m02: search and filter the children of this Posyandu. /timbang opens it on "belum ditimbang".
import { useState } from 'react'
import { Plus, Scale, Search, UserPlus, X } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar, RiskBadge } from '../components/StatusParts'
import { Empty } from '../components/ui'
import { db } from '../data/instance'
import { todayIso, useChildSummaries, type ChildSummary } from '../data/queries'
import { useAppState } from '../lib/appState'
import { ageLabel, dateLabel } from '../lib/format'

type Filter = 'semua' | 'belum' | 'sudah'

function matches(s: ChildSummary, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return [s.child.full_name, s.child.mother_name ?? '', s.child.nik ?? ''].some((v) => v.toLowerCase().includes(needle))
}

export function ChildRow({ s }: { s: ChildSummary }) {
  return (
    <li className="rounded-xl bg-surface-lowest shadow-card">
      <Link to={`/balita/${s.child.id}`} className="flex items-center gap-3 p-3.5">
        <Avatar name={s.child.full_name} sex={s.child.sex} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{s.child.full_name}</p>
          <p className="truncate text-xs text-on-surface-variant">
            {ageLabel(s.child.birth_date, todayIso())}
            {s.child.mother_name && ` · Ibu ${s.child.mother_name}`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RiskBadge level={s.warning.level} />
            {s.latest && (
              <span className="text-[11px] text-on-surface-variant">Timbang {dateLabel(s.latest.measured_at)}</span>
            )}
          </div>
        </div>
      </Link>
      {!s.measuredThisMonth && (
        <Link
          to={`/balita/${s.child.id}/timbang`}
          className="flex items-center justify-center gap-2 border-t border-surface-container py-2.5 text-sm font-semibold text-primary"
        >
          <Scale size={16} /> Timbang sekarang
        </Link>
      )}
    </li>
  )
}

export function ChildList({ initialFilter = 'semua' }: { initialFilter?: Filter }) {
  const { session } = useAppState()
  const list = useChildSummaries(db, session.posyanduId)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>(initialFilter)

  const all = list ?? []
  const counts = {
    semua: all.length,
    belum: all.filter((s) => !s.measuredThisMonth).length,
    sudah: all.filter((s) => s.measuredThisMonth).length,
  }
  const shown = all.filter(
    (s) => matches(s, q) && (filter === 'semua' || (filter === 'belum') === !s.measuredThisMonth),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{initialFilter === 'belum' ? 'Penimbangan' : 'Daftar balita'}</h1>
        <Link
          to="/balita/baru"
          className="flex items-center gap-1.5 rounded-full bg-surface-container px-3.5 py-2 text-sm font-semibold text-primary"
        >
          <Plus size={16} /> Balita baru
        </Link>
      </div>

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama balita, nama ibu, atau NIK"
          aria-label="Cari balita"
          className="h-12 w-full rounded-xl border border-outline-variant bg-surface-lowest pl-10 pr-10 text-sm outline-none focus:border-primary"
        />
        {q && (
          <button
            aria-label="Hapus pencarian"
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {(
          [
            ['semua', 'Semua'],
            ['belum', 'Belum ditimbang'],
            ['sudah', 'Sudah ditimbang'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${
              filter === key ? 'bg-primary text-on-primary' : 'bg-surface-low text-on-surface-variant'
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {list && all.length === 0 ? (
        <Empty icon={<UserPlus size={26} />} title="Belum ada balita">
          <Link to="/balita/baru" className="font-semibold text-primary">
            Daftarkan balita pertama
          </Link>
        </Empty>
      ) : list && shown.length === 0 ? (
        <Empty icon={<Search size={26} />} title="Tidak ditemukan">
          {filter === 'belum' && !q ? 'Semua balita sudah ditimbang bulan ini.' : 'Coba kata lain atau ganti filter.'}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {shown.map((s) => (
            <ChildRow key={s.child.id} s={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
