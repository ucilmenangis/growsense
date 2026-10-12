// m01: greeting, sync status, this month's weighing progress, quick actions.
import {
  ChevronRight,
  CloudCheck,
  CloudOff,
  FlaskConical,
  RefreshCw,
  Scale,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge, Button, Card } from '../components/ui'
import { seedDemo } from '../data/demoSeed'
import { db } from '../data/instance'
import { needsAttention, todayIso, useChildSummaries } from '../data/queries'
import { useAppState, type SyncStatus } from '../lib/appState'
import { monthLabel, syncTimeLabel } from '../lib/format'

const statusText: Record<SyncStatus, string> = {
  idle: 'Tersimpan di server',
  syncing: 'Sedang mengirim...',
  offline: 'Tidak ada sinyal',
  error: 'Gagal mengirim',
  demo: 'Mode demo',
}

export function SyncCard() {
  const { pending, lastSyncAt, status, syncError, syncNow } = useAppState()
  const ok = status === 'idle' && pending === 0
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {status === 'offline' || status === 'error' ? (
            <CloudOff size={20} className="text-warn" />
          ) : (
            <CloudCheck size={20} className="text-primary" />
          )}
          <h2 className="font-semibold">Data aman di HP</h2>
        </div>
        <Badge className={ok ? 'bg-ok-container text-ok' : 'bg-surface-container text-primary'}>
          {statusText[status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant">
        {status === 'demo'
          ? 'Mode demo: data hanya tersimpan di HP ini dan tidak dikirim ke server.'
          : 'Semua penimbangan tersimpan di HP dan terkirim sendiri saat ada internet.'}
      </p>
      {status !== 'demo' && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-surface-low p-3">
            <p className="text-xl font-semibold text-primary">{pending}</p>
            <p className="text-xs text-on-surface-variant">Belum terkirim</p>
          </div>
          <div className="rounded-xl bg-surface-low p-3">
            <p className="text-base font-semibold leading-7 text-primary">{syncTimeLabel(lastSyncAt)}</p>
            <p className="text-xs text-on-surface-variant">Terakhir terkirim</p>
          </div>
        </div>
      )}
      {status === 'error' && syncError && <p className="mt-2 text-xs text-danger">{syncError}</p>}
      {status !== 'demo' && (
        <Button className="mt-3" onClick={() => void syncNow()} disabled={status === 'syncing'}>
          <RefreshCw size={18} className={status === 'syncing' ? 'animate-spin' : ''} />
          Kirim sekarang
        </Button>
      )}
    </Card>
  )
}

export function Home() {
  const { session } = useAppState()
  const summaries = useChildSummaries(db, session.posyanduId)
  const list = summaries ?? []
  const measured = list.filter((s) => s.measuredThisMonth).length
  const attention = list.filter(needsAttention).length
  const percent = list.length ? Math.round((measured / list.length) * 100) : 0
  const firstName = session.fullName.split(' ')[0]

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <Badge className="bg-surface-container text-primary">Bulan {monthLabel(todayIso())}</Badge>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">Selamat bertugas, {firstName}!</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {session.posyanduName}
          {session.puskesmasName && ` · ${session.puskesmasName}`}
        </p>
      </Card>

      {session.demo && summaries && list.length === 0 && (
        <Card className="space-y-2 bg-warn-container/50">
          <p className="text-sm">Mode demo. Isi contoh 8 balita dengan riwayat timbang untuk mencoba semua layar.</p>
          <Button variant="secondary" onClick={() => void seedDemo(db, session.posyanduId)}>
            <FlaskConical size={18} /> Isi data contoh
          </Button>
        </Card>
      )}

      <section>
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="text-lg font-semibold">Penimbangan bulan ini</h2>
          <span className="text-sm font-semibold text-primary">{list.length} balita</span>
        </div>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-semibold">{measured}</span> dari {list.length} sudah ditimbang
            </p>
            <span className="text-xl font-semibold text-primary">{percent}%</span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-container"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/timbang" className="rounded-xl bg-surface-low p-3">
              <p className="text-xl font-semibold">{list.length - measured}</p>
              <p className="text-xs text-on-surface-variant">Belum ditimbang</p>
            </Link>
            <Link to="/pantauan" className="rounded-xl bg-warn-container/60 p-3">
              <p className="flex items-center gap-1 text-xl font-semibold text-warn">
                {attention}
                {attention > 0 && <TriangleAlert size={16} />}
              </p>
              <p className="text-xs text-on-surface-variant">Perlu dipantau</p>
            </Link>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Aksi cepat</h2>
        <Link to="/timbang" className="flex items-center gap-3 rounded-xl bg-primary p-4 text-on-primary shadow-card">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <Scale size={22} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Mulai penimbangan</span>
            <span className="block text-xs opacity-90">Pilih balita, isi berat dan tinggi</span>
          </span>
          <ChevronRight size={20} />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/balita/baru" className="rounded-xl bg-surface-lowest p-4 shadow-card">
            <UserPlus size={22} className="text-primary" />
            <p className="mt-2 font-semibold">Balita baru</p>
            <p className="text-xs text-on-surface-variant">Daftarkan anak</p>
          </Link>
          <Link to="/balita" className="rounded-xl bg-surface-lowest p-4 shadow-card">
            <Users size={22} className="text-primary" />
            <p className="mt-2 font-semibold">Cari balita</p>
            <p className="text-xs text-on-surface-variant">Nama, NIK, atau ibu</p>
          </Link>
        </div>
      </section>

      <SyncCard />
    </div>
  )
}
