// "Pantauan" tab: children ordered by the early warning, most urgent first.
import { ShieldCheck } from 'lucide-react'
import { Card, Empty } from '../components/ui'
import { db } from '../data/instance'
import { byPriority, needsAttention, useChildSummaries } from '../data/queries'
import { useAppState } from '../lib/appState'
import { ChildRow } from './ChildList'

export function Priority() {
  const { session } = useAppState()
  const list = useChildSummaries(db, session.posyanduId)
  const flagged = byPriority((list ?? []).filter(needsAttention))
  const high = flagged.filter((s) => s.warning.level === 'tinggi').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Balita perlu dipantau</h1>
        <p className="text-sm text-on-surface-variant">Diurutkan dari yang paling perlu didahulukan.</p>
      </div>

      {flagged.length > 0 && (
        <Card className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-danger-container p-3">
            <p className="text-2xl font-semibold text-danger">{high}</p>
            <p className="text-xs text-danger">Perlu kunjungan bidan</p>
          </div>
          <div className="rounded-xl bg-warn-container p-3">
            <p className="text-2xl font-semibold text-warn">{flagged.length - high}</p>
            <p className="text-xs text-warn">Perlu dipantau</p>
          </div>
        </Card>
      )}

      {list && flagged.length === 0 ? (
        <Empty icon={<ShieldCheck size={26} />} title="Tidak ada yang perlu dipantau">
          Semua balita yang sudah ditimbang tumbuh sesuai jalurnya.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {flagged.map((s) => (
            <li key={s.child.id} className="space-y-1">
              <ul>
                <ChildRow s={s} />
              </ul>
              <p className="px-2 text-xs text-on-surface-variant">{s.warning.reasons[0]}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-[11px] text-on-surface-variant">
        Urutan dibuat dari tren tinggi dan berat badan antar penimbangan. Alat bantu, bukan diagnosis.
      </p>
    </div>
  )
}
