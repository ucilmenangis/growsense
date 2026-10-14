// d00: sign in for Bidan / Nakes or Pemdes and Dinkes.
import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { LoginError, signIn, type Role, type Session } from '../data/auth'
import { supabase } from '../data/supabase'
import { Button, inputClass } from '../components/ui'

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'bidan', label: 'Bidan / Nakes', hint: 'NIP atau email' },
  { value: 'pemdes', label: 'Pemdes dan Dinkes', hint: 'NIP, nomor SK, atau email' },
]

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [role, setRole] = useState<Role>('bidan')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      onLogin(await signIn(role, identifier, password))
    } catch (err) {
      setError(err instanceof LoginError ? err.message : 'Gagal masuk. Periksa koneksi lalu coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-primary lg:block">
        <img src="/hero-bidan.png" alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#00344f] via-[#00344f]/60 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
            GrowSense, layanan kesehatan primer
          </p>
          <h1 className="mt-3 max-w-xl text-3xl leading-tight font-bold">
            Deteksi dini growth faltering dan prioritas kunjungan rumah untuk Posyandu
          </h1>
          <p className="mt-3 max-w-lg text-sm opacity-85">
            Untuk bidan Puskesmas Rowotengah, kader Posyandu, dan Pemerintah Desa Pringgowirawan. Z-score dihitung
            dengan standar WHO dan Permenkes No. 2 Tahun 2020.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src="/logo-mark.png" alt="" className="size-10" />
            <p className="text-xl font-bold text-primary">GrowSense</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke dashboard</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Pilih peran sesuai akun yang dibuat admin Puskesmas.</p>
          </div>

          <div role="group" aria-label="Peran" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-low p-1">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={role === r.value}
                onClick={() => setRole(r.value)}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  role === r.value ? 'bg-surface-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{ROLES.find((r) => r.value === role)!.hint}</span>
            <input
              className={`${inputClass} h-12 w-full`}
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Kata sandi</span>
            <span className="relative block">
              <input
                className={`${inputClass} h-12 w-full pr-12`}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-on-surface-variant"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-danger-container px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full">
            {busy ? 'Memeriksa...' : 'Masuk'}
          </Button>

          <p className="flex items-start gap-2 text-xs text-on-surface-variant">
            <ShieldCheck size={16} className="mt-px shrink-0 text-primary" />
            Sesi berakhir saat tab ditutup. Pemdes dan Dinkes hanya melihat angka per dusun, tanpa nama balita.
          </p>
          {!supabase && (
            <p className="rounded-xl bg-warn-container px-4 py-3 text-sm text-warn">
              Mode demo: belum terhubung ke server. Isi NIP dan kata sandi apa saja untuk mencoba. Data yang tampil
              adalah data contoh.
            </p>
          )}
        </form>
      </section>
    </div>
  )
}
