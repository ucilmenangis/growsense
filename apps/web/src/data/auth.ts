// Dashboard sign in for bidan (Nakes) and for Pemdes or Dinkes. Accounts live in Supabase Auth;
// a NIP is turned into an email shaped login the same way the PWA does with phone numbers.
// The session is kept in sessionStorage, so closing the tab on a shared computer signs out.
import { supabase } from './supabase'

export type Role = 'bidan' | 'pemdes'

export interface Session {
  userId: string
  fullName: string
  role: Role
  puskesmasName: string
  demo: boolean
}

export class LoginError extends Error {}

const KEY = 'growsense-web-session'

/** NIP or ID with digits only becomes `<digits>@staf.growsense.id`; an email is used as typed. */
export function staffEmail(identifier: string): string {
  const id = identifier.trim()
  return id.includes('@') ? id.toLowerCase() : `${id.replace(/\D/g, '')}@staf.growsense.id`
}

export async function signIn(role: Role, identifier: string, password: string): Promise<Session> {
  if (!identifier.trim()) throw new LoginError('Isi NIP atau email')
  if (!password) throw new LoginError('Isi kata sandi')

  let session: Session
  if (!supabase) {
    session = {
      userId: `demo-${role}`,
      fullName: role === 'bidan' ? 'Bidan Demo' : 'Kepala Desa Demo',
      role,
      puskesmasName: 'Puskesmas Rowotengah',
      demo: true,
    }
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email: staffEmail(identifier), password })
    if (error || !data.user) throw new LoginError('NIP atau kata sandi salah')
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, puskesmas:puskesmas_id(name)')
      .eq('id', data.user.id)
      .single()
    const p = profile as { role: string; full_name: string; puskesmas: { name: string } | null } | null
    const actual: Role | null =
      p?.role === 'bidan' || p?.role === 'admin' ? 'bidan' : p?.role === 'pemdes' ? 'pemdes' : null
    if (!actual) {
      await supabase.auth.signOut()
      throw new LoginError('Akun ini tidak punya akses ke dashboard')
    }
    if (actual !== role) {
      await supabase.auth.signOut()
      throw new LoginError(
        role === 'bidan' ? 'Akun ini terdaftar sebagai Pemdes atau Dinkes' : 'Akun ini terdaftar sebagai Nakes',
      )
    }
    session = {
      userId: data.user.id,
      fullName: p!.full_name,
      role,
      puskesmasName: p!.puskesmas?.name ?? '',
      demo: false,
    }
  }
  sessionStorage.setItem(KEY, JSON.stringify(session))
  return session
}

/** The saved session, dropped when the Supabase login behind it is gone or belongs to someone else. */
export async function restoreSession(): Promise<Session | null> {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  const session = JSON.parse(raw) as Session
  if (session.demo === !supabase) {
    if (!supabase) return session
    const { data } = await supabase.auth.getSession()
    if (data.session?.user.id === session.userId) return session
  }
  sessionStorage.removeItem(KEY)
  return null
}

export async function signOut() {
  sessionStorage.removeItem(KEY)
  await supabase?.auth.signOut()
}
