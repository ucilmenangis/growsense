// m07: login with phone number and 6 digit PIN. A returning kader only types the PIN.
import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LifeBuoy, WifiOff } from 'lucide-react'
import { Button, Field, inputClass } from '../components/ui'
import { db } from '../data/instance'
import { supabase } from '../data/supabase'
import { login, LoginError, storedSession, type Session } from '../lib/auth'

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [saved, setSaved] = useState<Session | null | undefined>(undefined)
  const [switching, setSwitching] = useState(false)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void storedSession(db).then(setSaved)
  }, [])

  const returning = saved && !switching

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      onLogin(await login(db, returning ? saved.phone : phone, pin))
    } catch (err) {
      setError(err instanceof LoginError ? err.message : 'Gagal masuk. Coba lagi.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  if (saved === undefined) return null

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe">
      <div className="flex flex-col items-center pt-14 text-center">
        <img src="/logo-mark.png" alt="" className="size-20" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-primary">GrowSense</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Pencatatan tumbuh kembang balita untuk kader Posyandu</p>
      </div>

      <form onSubmit={submit} className="mt-10 space-y-5">
        {returning ? (
          <div className="rounded-xl bg-surface-low p-4">
            <p className="text-xs text-on-surface-variant">Masuk sebagai</p>
            <p className="font-semibold">{saved.fullName}</p>
            <p className="text-sm text-on-surface-variant">{saved.posyanduName}</p>
          </div>
        ) : (
          <Field label="Nomor HP (WhatsApp)">
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
        )}

        <Field label="PIN (6 angka)">
          <div className="relative">
            <input
              className={`${inputClass} pr-12 tracking-[0.4em]`}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              autoFocus={!!returning}
              required
            />
            <button
              type="button"
              aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              onClick={() => setShowPin((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-on-surface-variant"
            >
              {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-container px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy || pin.length !== 6}>
          {busy ? 'Memeriksa...' : 'Masuk'}
        </Button>

        {returning && (
          <button
            type="button"
            onClick={() => setSwitching(true)}
            className="w-full py-2 text-sm font-semibold text-primary"
          >
            Masuk dengan akun lain
          </button>
        )}
      </form>

      <div className="mt-auto space-y-3 py-8 text-sm text-on-surface-variant">
        {returning && (
          <p className="flex items-start gap-2">
            <WifiOff size={16} className="mt-0.5 shrink-0" />
            Bisa masuk tanpa sinyal dengan PIN yang sama.
          </p>
        )}
        <p className="flex items-start gap-2">
          <LifeBuoy size={16} className="mt-0.5 shrink-0" />
          Lupa PIN atau belum punya akun? Hubungi bidan desa.
        </p>
        {!supabase && (
          <p className="rounded-xl bg-warn-container px-4 py-3 text-warn">
            Mode demo: belum terhubung ke server. Isi nomor HP dan PIN apa saja untuk mencoba.
          </p>
        )}
      </div>
    </div>
  )
}
