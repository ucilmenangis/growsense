// Kader login. The first sign-in on a phone uses the account password from the bidan and needs
// internet. The kader then sets a 6 digit PIN that stays on this phone and unlocks the app offline.
// The PIN is never sent to the server, so guessing it from a stolen phone does not open the account.
// Without Supabase settings the app runs in demo mode with a local account.
import type { GrowSenseDb } from '../data/db'
import { supabase } from '../data/supabase'

export interface Session {
  userId: string
  fullName: string
  role: 'kader' | 'bidan' | 'admin'
  phone: string
  posyanduId: string
  posyanduName: string
  puskesmasName: string
  demo: boolean
}

interface PinRecord {
  salt: string
  hash: string
}

export const DEMO_POSYANDU_ID = '00000000-0000-4000-8000-0000000000d1'
/** Wrong PINs allowed before the password is required again. */
export const MAX_PIN_ATTEMPTS = 5

export class LoginError extends Error {}

/** 0812... and +62812... both become 62812... */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

/** Kader accounts in Supabase Auth use the phone number as an email shaped login. */
export const kaderEmail = (phone: string) => `${phone}@kader.growsense.id`

const toB64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210_000 }, key, 256)
  return toB64(bits)
}

async function hashPin(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: toB64(salt), hash: await derive(pin, salt) }
}

async function readMeta<T>(db: GrowSenseDb, key: string): Promise<T | null> {
  const row = await db.meta.get(key)
  return row ? (JSON.parse(row.value) as T) : null
}

const writeMeta = (db: GrowSenseDb, key: string, value: unknown) => db.meta.put({ key, value: JSON.stringify(value) })

export const storedSession = (db: GrowSenseDb) => readMeta<Session>(db, 'session')

/** True when this phone has a signed in account with a PIN, so the PIN screen applies. */
export async function hasPin(db: GrowSenseDb): Promise<boolean> {
  return !!(await storedSession(db)) && !!(await db.meta.get('pin'))
}

export async function pendingCount(db: GrowSenseDb): Promise<number> {
  const [children, measurements] = await Promise.all([
    db.children.where('dirty').equals(1).count(),
    db.measurements.where('dirty').equals(1).count(),
  ])
  return children + measurements
}

const UNSENT_MESSAGE =
  'Masih ada data akun sebelumnya yang belum terkirim. Masuk dengan akun itu dan kirim datanya dulu.'

async function clearLocal(db: GrowSenseDb) {
  await db.transaction('rw', db.children, db.measurements, db.meta, async () => {
    await db.children.clear()
    await db.measurements.clear()
    await db.meta.clear()
  })
}

/** Unlocks with the PIN, offline. Too many wrong PINs remove it and the password is needed again. */
export async function unlock(db: GrowSenseDb, pin: string): Promise<Session> {
  const session = await storedSession(db)
  const record = await readMeta<PinRecord>(db, 'pin')
  if (!session || !record) throw new LoginError('Masuk dengan kata sandi dulu')

  if ((await derive(pin, fromB64(record.salt))) === record.hash) {
    await db.meta.delete('pinFails')
    return session
  }
  const fails = ((await readMeta<number>(db, 'pinFails')) ?? 0) + 1
  if (fails >= MAX_PIN_ATTEMPTS) {
    await db.meta.bulkDelete(['pin', 'pinFails'])
    throw new LoginError(`PIN salah ${MAX_PIN_ATTEMPTS} kali. Masuk lagi dengan nomor HP dan kata sandi.`)
  }
  await writeMeta(db, 'pinFails', fails)
  throw new LoginError(`PIN salah. Sisa ${MAX_PIN_ATTEMPTS - fails} kali percobaan.`)
}

async function onlineSession(phone: string, password: string): Promise<Session> {
  if (!navigator.onLine) throw new LoginError('Masuk dengan kata sandi perlu internet')
  const { data, error } = await supabase!.auth.signInWithPassword({ email: kaderEmail(phone), password })
  if (error || !data.user) throw new LoginError('Nomor HP atau kata sandi salah')

  const { data: profile } = await supabase!
    .from('profiles')
    .select('role, full_name, posyandu:posyandu_id(id, name), puskesmas:puskesmas_id(name)')
    .eq('id', data.user.id)
    .single()
  const p = profile as {
    role: Session['role']
    full_name: string
    posyandu: { id: string; name: string } | null
    puskesmas: { name: string } | null
  } | null
  if (!p?.posyandu) {
    await supabase!.auth.signOut()
    throw new LoginError('Akun ini belum terdaftar sebagai kader Posyandu')
  }
  return {
    userId: data.user.id,
    fullName: p.full_name,
    role: p.role,
    phone,
    posyanduId: p.posyandu.id,
    posyanduName: p.posyandu.name,
    puskesmasName: p.puskesmas?.name ?? '',
    demo: false,
  }
}

function demoSession(phone: string): Session {
  return {
    userId: `demo-${phone}`,
    fullName: 'Kader Demo',
    role: 'kader',
    phone,
    posyanduId: DEMO_POSYANDU_ID,
    posyanduName: 'Posyandu Demo',
    puskesmasName: 'Puskesmas Rowotengah',
    demo: true,
  }
}

/**
 * Signs in with phone and password. Returns the session for `setPin`; nothing is stored yet.
 * Switching to another account is refused before contacting the server while the previous
 * account still has unsent changes, so the server session never belongs to someone else.
 */
export async function signIn(db: GrowSenseDb, phoneInput: string, password: string): Promise<Session> {
  const phone = normalizePhone(phoneInput)
  if (phone.length < 10) throw new LoginError('Nomor HP belum lengkap')
  if (!password) throw new LoginError('Isi kata sandi')

  const saved = await storedSession(db)
  if (saved && saved.phone !== phone && (await pendingCount(db))) throw new LoginError(UNSENT_MESSAGE)

  const session = supabase ? await onlineSession(phone, password) : demoSession(phone)
  if (saved && saved.userId !== session.userId) {
    if (await pendingCount(db)) {
      await supabase?.auth.signOut()
      throw new LoginError(UNSENT_MESSAGE)
    }
    await clearLocal(db)
  }
  return session
}

/** Stores the session and the PIN that unlocks it on this phone. */
export async function setPin(db: GrowSenseDb, session: Session, pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) throw new LoginError('PIN harus 6 angka')
  if (/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    throw new LoginError('PIN terlalu mudah ditebak. Hindari angka sama atau berurutan.')
  }
  await writeMeta(db, 'session', session)
  await writeMeta(db, 'pin', await hashPin(pin))
  await db.meta.delete('pinFails')
}

/**
 * The Supabase session must belong to the unlocked kader before any data is sent.
 * Returns false when it is missing or belongs to another user.
 */
export async function serverSessionMatches(session: Session): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id === session.userId
}

/** Signs out and wipes this phone's copy of the data. Refuses while changes are unsent. */
export async function logout(db: GrowSenseDb): Promise<void> {
  if (await pendingCount(db)) throw new LoginError('Masih ada data yang belum terkirim. Kirim dulu sebelum keluar.')
  await clearLocal(db)
  await supabase?.auth.signOut()
}
