import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { GrowSenseDb } from '../src/data/db'
import { addChild } from '../src/data/repo'
import { hasPin, LoginError, logout, MAX_PIN_ATTEMPTS, setPin, signIn, storedSession, unlock } from '../src/lib/auth'
import { cell } from '../src/lib/exportCsv'

// No Supabase settings in tests, so signIn takes the demo path.
let db: GrowSenseDb
let n = 0
beforeEach(() => {
  db = new GrowSenseDb(`auth-${++n}`)
})

async function signUp(phone = '081234567890', pin = '482915') {
  const session = await signIn(db, phone, 'rahasia')
  await setPin(db, session, pin)
  return session
}

describe('PIN', () => {
  it('stores nothing until a PIN is set', async () => {
    await signIn(db, '081234567890', 'rahasia')
    expect(await storedSession(db)).toBeNull()
    expect(await hasPin(db)).toBe(false)
  })

  it('unlocks with the right PIN and never stores it in clear', async () => {
    const session = await signUp()
    expect(await unlock(db, '482915')).toEqual(session)
    const stored = JSON.stringify(await db.meta.toArray())
    expect(stored).not.toContain('482915')
    expect(stored).not.toContain('rahasia')
  })

  it('rejects easy PINs', async () => {
    const session = await signIn(db, '081234567890', 'rahasia')
    for (const pin of ['111111', '123456', '654321']) await expect(setPin(db, session, pin)).rejects.toThrow(LoginError)
  })

  it(`removes the PIN after ${MAX_PIN_ATTEMPTS} wrong tries but keeps the data`, async () => {
    const session = await signUp()
    await addChild(db, { posyandu_id: session.posyanduId, full_name: 'Ani', sex: 'female', birth_date: '2025-01-01' })
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) await expect(unlock(db, '000001')).rejects.toThrow(/Sisa/)
    await expect(unlock(db, '000001')).rejects.toThrow(/kata sandi/)
    expect(await hasPin(db)).toBe(false)
    await expect(unlock(db, '482915')).rejects.toThrow()
    expect(await db.children.count()).toBe(1)
  })

  it('resets the counter after a correct PIN', async () => {
    await signUp()
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) await expect(unlock(db, '000001')).rejects.toThrow()
    await unlock(db, '482915')
    await expect(unlock(db, '000001')).rejects.toThrow(/Sisa 4/)
  })
})

describe('switching account', () => {
  it('refuses before signing in while the previous account has unsent data', async () => {
    const a = await signUp('081111111111')
    await addChild(db, { posyandu_id: a.posyanduId, full_name: 'Ani', sex: 'female', birth_date: '2025-01-01' })
    await expect(signIn(db, '082222222222', 'rahasia')).rejects.toThrow(/belum terkirim/)
    expect((await storedSession(db))?.phone).toBe('6281111111111')
  })

  it('clears the previous account when nothing is pending', async () => {
    await signUp('081111111111')
    const b = await signIn(db, '082222222222', 'rahasia')
    expect(await storedSession(db)).toBeNull()
    await setPin(db, b, '482915')
    expect((await storedSession(db))?.phone).toBe('6282222222222')
  })

  it('logout refuses while data is unsent', async () => {
    const a = await signUp()
    await addChild(db, { posyandu_id: a.posyanduId, full_name: 'Ani', sex: 'female', birth_date: '2025-01-01' })
    await expect(logout(db)).rejects.toThrow(/belum terkirim/)
  })
})

describe('csv cell', () => {
  it('neutralises formulas but keeps negative numbers', () => {
    expect(cell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(cell('+62812')).toBe("'+62812")
    expect(cell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(cell('-cmd')).toBe("'-cmd")
    expect(cell('-1.25')).toBe('-1.25')
    expect(cell(-2)).toBe('-2')
    expect(cell('Budi')).toBe('Budi')
  })
})
