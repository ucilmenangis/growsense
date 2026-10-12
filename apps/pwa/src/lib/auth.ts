// Kader login. The first login needs internet (Supabase); after that the PIN unlocks the app offline.
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

export async function hashPin(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: toB64(salt), hash: await derive(pin, salt) }
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  return (await derive(pin, fromB64(record.salt))) === record.hash
}

async function readMeta<T>(db: GrowSenseDb, key: string): Promise<T | null> {
  const row = await db.meta.get(key)
  return row ? (JSON.parse(row.value) as T) : null
}

const writeMeta = (db: GrowSenseDb, key: string, value: unknown) => db.meta.put({ key, value: JSON.stringify(value) })

export const storedSession = (db: GrowSenseDb) => readMeta<Session>(db, 'session')

export async function pendingCount(db: GrowSenseDb): Promise<number> {
  const [children, measurements] = await Promise.all([
    db.children.where('dirty').equals(1).count(),
    db.measurements.where('dirty').equals(1).count(),
  ])
  return children + measurements
}

/** Removes the previous account's local data. Refuses while it still has unsent changes. */
async function clearLocal(db: GrowSenseDb) {
  if (await pendingCount(db)) {
    throw new LoginError(
      'Masih ada data akun sebelumnya yang belum terkirim. Masuk dengan akun itu dan sinkronkan dulu.',
    )
  }
  await db.transaction('rw', db.children, db.measurements, db.meta, async () => {
    await db.children.clear()
    await db.measurements.clear()
    await db.meta.clear()
  })
}

async function onlineSession(phone: string, pin: string): Promise<Session> {
  if (!navigator.onLine) throw new LoginError('Masuk pertama kali di HP ini perlu internet')
  const { data, error } = await supabase!.auth.signInWithPassword({ email: kaderEmail(phone), password: pin })
  if (error || !data.user) throw new LoginError('Nomor HP atau PIN salah')

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

export async function login(db: GrowSenseDb, phoneInput: string, pin: string): Promise<Session> {
  if (!/^\d{6}$/.test(pin)) throw new LoginError('PIN harus 6 angka')
  const phone = normalizePhone(phoneInput)
  if (phone.length < 10) throw new LoginError('Nomor HP belum lengkap')

  const saved = await storedSession(db)
  const pinRecord = await readMeta<PinRecord>(db, 'pin')
  if (saved?.phone === phone && pinRecord) {
    if (await verifyPin(pin, pinRecord)) return saved
    if (!supabase || !navigator.onLine) throw new LoginError('PIN salah')
  }

  const session = supabase ? await onlineSession(phone, pin) : demoSession(phone)
  if (saved && saved.userId !== session.userId) await clearLocal(db)
  await writeMeta(db, 'session', session)
  await writeMeta(db, 'pin', await hashPin(pin))
  return session
}

/** Signs out and wipes this phone's copy of the data. Refuses while changes are unsent. */
export async function logout(db: GrowSenseDb): Promise<void> {
  await clearLocal(db)
  await supabase?.auth.signOut()
}
