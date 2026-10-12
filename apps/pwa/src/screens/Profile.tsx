// m06: kader profile, this month's work, sync, monthly export, lock and sign out.
import { useState } from 'react'
import { Download, Lock, LogOut, Phone, Stethoscope } from 'lucide-react'
import { Button, Card, SubHeader } from '../components/ui'
import { db } from '../data/instance'
import { needsAttention, todayIso, useChildSummaries } from '../data/queries'
import { useAppState } from '../lib/appState'
import { LoginError, logout } from '../lib/auth'
import { downloadText, monthlyCsv } from '../lib/exportCsv'
import { monthLabel } from '../lib/format'
import { SyncCard } from './Home'

export function Profile({ onSignedOut }: { onSignedOut: () => void }) {
  const { session, lock } = useAppState()
  const list = useChildSummaries(db, session.posyanduId) ?? []
  const [error, setError] = useState('')
  const month = todayIso().slice(0, 7)
  const measured = list.filter((s) => s.measuredThisMonth).length
  const flagged = list.filter((s) => s.measuredThisMonth && needsAttention(s)).length
  const phone = session.phone.replace(/^62/, '0')

  async function signOut() {
    if (!window.confirm('Keluar dan hapus data di HP ini? Data yang sudah terkirim tetap aman di server.')) return
    try {
      await logout(db)
      onSignedOut()
    } catch (e) {
      setError(e instanceof LoginError ? e.message : 'Gagal keluar')
    }
  }

  return (
    <>
      <SubHeader title="Profil dan akun" />
      <div className="space-y-4 px-4 pb-10">
        <Card className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary">
            {session.fullName
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')}
          </div>
          <p className="mt-2 text-lg font-semibold">{session.fullName}</p>
          <p className="text-sm text-on-surface-variant">Kader {session.posyanduName}</p>
          {session.puskesmasName && <p className="text-sm text-on-surface-variant">Mitra {session.puskesmasName}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
            <Phone size={14} /> {phone}
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold">Kerja bulan {monthLabel(todayIso())}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-surface-low p-3">
              <p className="text-2xl font-semibold text-primary">{measured}</p>
              <p className="text-xs text-on-surface-variant">Balita ditimbang</p>
            </div>
            <div className="rounded-xl bg-surface-low p-3">
              <p className="text-2xl font-semibold text-warn">{flagged}</p>
              <p className="text-xs text-on-surface-variant">Perlu dipantau</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() =>
              downloadText(`rekap-${session.posyanduName.replace(/\s+/g, '-')}-${month}.csv`, monthlyCsv(list, month))
            }
          >
            <Download size={18} /> Unduh rekap bulan ini (CSV)
          </Button>
        </Card>

        <SyncCard />

        <Card className="flex items-center gap-3">
          <Stethoscope size={20} className="text-primary" />
          <p className="text-sm">Lupa PIN atau ganti HP? Hubungi bidan desa untuk atur ulang akun.</p>
        </Card>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-container px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button variant="secondary" onClick={lock}>
          <Lock size={18} /> Kunci aplikasi
        </Button>
        <Button variant="danger" onClick={() => void signOut()}>
          <LogOut size={18} /> Keluar dari akun
        </Button>
        <p className="text-center text-[11px] text-on-surface-variant">GrowSense PWA · versi uji coba</p>
      </div>
    </>
  )
}
