import type { ButtonHTMLAttributes, ReactNode } from 'react'

export { Badge } from '@growsense/ui'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`min-w-0 rounded-xl bg-surface-lowest p-5 shadow-card ${className}`}>{children}</section>
}

export function CardTitle({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <div className="rounded-lg bg-surface-container p-1.5 text-primary">{icon}</div>}
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 print:mb-4">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        <p className="mt-1.5 text-sm text-on-surface-variant">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </header>
  )
}

export function Kpi({
  label,
  value,
  note,
  tone = 'primary',
  icon,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: 'primary' | 'danger' | 'warn' | 'ok'
  icon?: ReactNode
}) {
  const tones = {
    primary: 'text-primary bg-surface-container',
    danger: 'text-danger bg-danger-container',
    warn: 'text-warn bg-warn-container',
    ok: 'text-ok bg-ok-container',
  }
  return (
    <div className="rounded-xl bg-surface-lowest p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-on-surface-variant">{label}</p>
        {icon && <div className={`rounded-lg p-1.5 ${tones[tone]}`}>{icon}</div>}
      </div>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${tone === 'primary' ? '' : tones[tone].split(' ')[0]}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-on-surface-variant">{note}</p>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container',
  secondary: 'bg-surface-container text-primary hover:bg-surface-high',
  ghost: 'text-primary hover:bg-surface-low',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export const inputClass =
  'h-10 rounded-xl border border-outline-variant bg-surface-lowest px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-on-surface-variant ${className}`}>
      {label}
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Horizontal share bar, 0 to 1. */
export function Bar({ value, tone = 'bg-primary' }: { value: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-highest">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-lowest px-4 py-3 text-sm text-on-surface-variant">
      <p className="mb-0.5 text-[11px] font-semibold tracking-wide text-on-surface uppercase">{label}</p>
      {children}
    </div>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-left text-xs font-semibold text-on-surface-variant ${className}`}>{children}</th>
  )
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top text-sm ${className}`}>{children}</td>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-low px-4 py-8 text-center text-sm text-on-surface-variant">{children}</p>
}
