// m07: unlock with the PIN, or sign in with phone and password and then set a PIN for this phone.
import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LifeBuoy, WifiOff } from 'lucide-react'
import { Button, Field, inputClass } from '../components/ui'
import { db } from '../data/instance'
import { supabase } from '../data/supabase'
import { hasPin, LoginError, setPin, signIn, storedSession, unlock, type Session } from '../lib/auth'

type Mode = 'pin' | 'password' | 'newPin'

function PinInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label}>
      <div className="relative">
        <input
          className={`${inputClass} pr-12 tracking-[0.4em]`}
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="••••••"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          autoFocus={autoFocus}
          required
        />
        <button
          type="button"
          aria-label={show ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-on-surface-variant"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </Field>
  )
}

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<Mode>()
  const [saved, setSaved] = useState<Session | null>(null)
  const [pending, setPending] = useState<Session | null>(null)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPinValue] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const s = await storedSession(db)
      setSaved(s)
      if (s) setPhone(s.phone.replace(/^62/, '0'))
      setMode((await hasPin(db)) ? 'pin' : 'password')
    })()
  }, [])

  async function run(action: () => Promise<void>) {
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err instanceof LoginError ? err.message : 'Gagal masuk. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'pin') {
      void run(async () => {
        try {
          onLogin(await unlock(db, pin))
        } finally {
          setPinValue('')
          if (!(await hasPin(db))) setMode('password')
        }
      })
    } else if (mode === 'password') {
      void run(async () => {
        setPending(await signIn(db, phone, password))
        setPassword('')
        setMode('newPin')
      })
    } else {
      void run(async () => {
        if (pin !== pin2) throw new LoginError('Kedua PIN tidak sama')
        await setPin(db, pending!, pin)
        onLogin(pending!)
      })
    }
  }

  if (!mode) return null

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe">
      <div className="flex flex-col items-center pt-14 text-center">
        <img src="/logo-mark.png" alt="" className="size-20" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-primary">GrowSense</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Pencatatan tumbuh kembang balita untuk kader Posyandu</p>
      </div>

      <form onSubmit={submit} className="mt-10 space-y-5">
        {mode === 'pin' && saved && (
          <>
            <div className="rounded-xl bg-surface-low p-4">
              <p className="text-xs text-on-surface-variant">Masuk sebagai</p>
              <p className="font-semibold">{saved.fullName}</p>
              <p className="text-sm text-on-surface-variant">{saved.posyanduName}</p>
            </div>
            <PinInput label="PIN (6 angka)" value={pin} onChange={setPinValue} autoFocus />
          </>
        )}

        {mode === 'password' && (
          <>
            <Field label="Nomor HP (WhatsApp)">
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="0812 3456 7890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
            <Field label="Kata sandi" hint="Dari bidan desa saat akun dibuat.">
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
          </>
        )}

        {mode === 'newPin' && pending && (
          <>
            <div className="rounded-xl bg-surface-low p-4 text-sm">
              <p className="font-semibold">Halo, {pending.fullName}</p>
              <p className="text-on-surface-variant">
                Buat PIN 6 angka untuk membuka aplikasi di HP ini. PIN hanya tersimpan di HP ini.
              </p>
            </div>
            <PinInput label="PIN baru" value={pin} onChange={setPinValue} autoFocus />
            <PinInput label="Ulangi PIN" value={pin2} onChange={setPin2} />
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-danger-container px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={
            busy ||
            (mode === 'pin' && pin.length !== 6) ||
            (mode === 'newPin' && (pin.length !== 6 || pin2.length !== 6))
          }
        >
          {busy ? 'Memeriksa...' : mode === 'newPin' ? 'Simpan PIN' : 'Masuk'}
        </Button>

        {mode === 'pin' && (
          <button
            type="button"
            onClick={() => setMode('password')}
            className="w-full py-2 text-sm font-semibold text-primary"
          >
            Lupa PIN atau masuk dengan akun lain
          </button>
        )}
      </form>

      <div className="mt-auto space-y-3 py-8 text-sm text-on-surface-variant">
        {mode === 'pin' && (
          <p className="flex items-start gap-2">
            <WifiOff size={16} className="mt-0.5 shrink-0" />
            Bisa masuk tanpa sinyal dengan PIN.
          </p>
        )}
        <p className="flex items-start gap-2">
          <LifeBuoy size={16} className="mt-0.5 shrink-0" />
          Lupa kata sandi atau belum punya akun? Hubungi bidan desa.
        </p>
        {!supabase && (
          <p className="rounded-xl bg-warn-container px-4 py-3 text-warn">
            Mode demo: belum terhubung ke server. Isi nomor HP dan kata sandi apa saja untuk mencoba.
          </p>
        )}
      </div>
    </div>
  )
}
