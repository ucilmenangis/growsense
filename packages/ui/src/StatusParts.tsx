import type { RiskLevel } from '@growsense/core'
import { Badge } from './Badge'

export const riskTone: Record<RiskLevel, string> = {
  tinggi: 'bg-danger-container text-danger',
  sedang: 'bg-warn-container text-warn',
  rendah: 'bg-ok-container text-ok',
}

export const riskLabel: Record<RiskLevel, string> = {
  tinggi: 'Perlu kunjungan',
  sedang: 'Perlu dipantau',
  rendah: 'Tumbuh baik',
}

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) return <Badge className="bg-surface-container text-on-surface-variant">Belum ditimbang</Badge>
  return <Badge className={riskTone[level]}>{riskLabel[level]}</Badge>
}

export function Avatar({ name, sex }: { name: string; sex: 'male' | 'female' }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <div
      aria-hidden
      className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
        sex === 'male' ? 'bg-surface-container text-primary' : 'bg-[#fde7f0] text-[#9c2a5c]'
      }`}
    >
      {initials}
    </div>
  )
}
