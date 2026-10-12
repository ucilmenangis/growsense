// Session and background sync shared by every screen.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/instance'
import { supabase, supabaseRemote } from '../data/supabase'
import { sync } from '../data/sync'
import { serverSessionMatches, type Session } from './auth'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'demo'

interface AppState {
  session: Session
  lock: () => void
  pending: number
  lastSyncAt: string | null
  status: SyncStatus
  syncError: string | null
  syncNow: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)
const remote = supabase ? supabaseRemote(supabase) : null
const INTERVAL_MS = 60_000
const AFTER_EDIT_MS = 3_000

export function AppStateProvider({
  session,
  onLock,
  children,
}: {
  session: Session
  onLock: () => void
  children: ReactNode
}) {
  const [status, setStatus] = useState<SyncStatus>(session.demo || !remote ? 'demo' : 'idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const busy = useRef(false)

  const pending =
    useLiveQuery(async () => {
      const [a, b] = await Promise.all([
        db.children.where('dirty').equals(1).count(),
        db.measurements.where('dirty').equals(1).count(),
      ])
      return a + b
    }) ?? 0
  const lastSyncAt = useLiveQuery(async () => (await db.meta.get('lastSyncAt'))?.value ?? null) ?? null

  const syncNow = useCallback(async () => {
    if (session.demo || !remote || busy.current) return
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    busy.current = true
    setStatus('syncing')
    try {
      // Never send one kader's records with another account's server session.
      if (!(await serverSessionMatches(session))) {
        throw new Error('Sesi server berakhir. Kunci aplikasi lalu masuk lagi dengan kata sandi saat ada internet.')
      }
      await sync(db, remote)
      await db.meta.put({ key: 'lastSyncAt', value: new Date().toISOString() })
      setStatus('idle')
      setSyncError(null)
    } catch (e) {
      setStatus('error')
      setSyncError((e as Error).message)
    } finally {
      busy.current = false
    }
  }, [session])

  useEffect(() => {
    void syncNow()
    const onOnline = () => void syncNow()
    const onOffline = () => setStatus((s) => (s === 'demo' ? s : 'offline'))
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = window.setInterval(() => void syncNow(), INTERVAL_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(timer)
    }
  }, [syncNow])

  // Send new entries shortly after they are saved.
  useEffect(() => {
    if (pending === 0) return
    const timer = window.setTimeout(() => void syncNow(), AFTER_EDIT_MS)
    return () => window.clearTimeout(timer)
  }, [pending, syncNow])

  return (
    <Ctx.Provider value={{ session, lock: onLock, pending, lastSyncAt, status, syncError, syncNow }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAppState(): AppState {
  const value = useContext(Ctx)
  if (!value) throw new Error('useAppState outside AppStateProvider')
  return value
}
