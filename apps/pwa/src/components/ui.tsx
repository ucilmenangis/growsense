import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-xl bg-surface-lowest p-4 shadow-card ${className}`}>{children}</section>
}

export { Badge } from '@growsense/ui'

type Variant = 'primary' | 'secondary' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary active:bg-primary-container',
  secondary: 'bg-surface-container text-primary active:bg-surface-high',
  danger: 'bg-danger-container text-danger active:brightness-95',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

/** Title bar for screens below the main tabs. */
export function SubHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate()
  return (
    <header className="pt-safe sticky top-0 z-40 bg-surface/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4">
        <button
          aria-label="Kembali"
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full bg-surface-low text-primary"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}

/** Wraps one input in a label. Pass `group` for a set of buttons, which must not sit inside a label. */
export function Field({
  label,
  hint,
  group = false,
  children,
}: {
  label: string
  hint?: ReactNode
  group?: boolean
  children: ReactNode
}) {
  const id = useId()
  const content = (
    <>
      <span id={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-on-surface-variant">{hint}</span>}
    </>
  )
  return group ? (
    <div role="group" aria-labelledby={id}>
      {content}
    </div>
  ) : (
    <label className="block">{content}</label>
  )
}

export const inputClass =
  'block h-12 w-full rounded-xl border border-outline-variant bg-surface-lowest px-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

/** Two or three large buttons instead of a dropdown, for quick taps at the Posyandu table. */
export function Choice<T extends string | boolean>({
  value,
  options,
  onChange,
}: {
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="grid grid-flow-col gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${
            value === o.value ? 'bg-primary text-on-primary' : 'bg-surface-low text-on-surface-variant'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-container text-primary">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-on-surface-variant">{children}</div>}
    </div>
  )
}
