// Session and loaded data for every page, plus the summaries derived from them.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { summarize, type ChildSummary, type FollowUpRow, type PosyanduInfo } from '@growsense/core'
import { restoreSession, signOut, type Session } from './auth'
import { loadDataset, saveFollowUp, type Dataset, type NewFollowUp } from './source'

interface Store {
  session: Session
  data: Dataset
  /** Children under five with their warnings, sorted by name. Empty for Pemdes. */
  summaries: ChildSummary[]
  posyanduById: Map<string, PosyanduInfo>
  /** Follow up notes per child, oldest first. */
  followUpsByChild: Map<string, FollowUpRow[]>
  addFollowUp: (input: NewFollowUp) => Promise<void>
  reload: () => Promise<void>
  logout: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}

type State =
  | { status: 'checking' }
  | { status: 'signedOut' }
  | { status: 'loading'; session: Session }
  | { status: 'ready'; session: Session; data: Dataset }
  | { status: 'error'; session: Session; message: string }

export function StoreProvider({
  login,
  loading,
  failed,
  children,
}: {
  login: (onLogin: (s: Session) => void) => ReactNode
  loading: ReactNode
  failed: (message: string, retry: () => void, logout: () => void) => ReactNode
  children: ReactNode
}) {
  const [state, setState] = useState<State>({ status: 'checking' })

  const load = useCallback(async (session: Session) => {
    setState({ status: 'loading', session })
    try {
      setState({ status: 'ready', session, data: await loadDataset(session) })
    } catch (err) {
      setState({ status: 'error', session, message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    void restoreSession().then((s) => (s ? load(s) : setState({ status: 'signedOut' })))
  }, [load])

  const logout = useCallback(async () => {
    await signOut()
    setState({ status: 'signedOut' })
  }, [])

  const ready = state.status === 'ready' ? state : null
  const store = useMemo<Store | null>(() => {
    if (!ready) return null
    const { session, data } = ready
    const followUpsByChild = new Map<string, FollowUpRow[]>()
    for (const f of [...data.followUps].sort((a, b) => a.done_at.localeCompare(b.done_at))) {
      if (f.deleted_at) continue
      followUpsByChild.set(f.child_id, [...(followUpsByChild.get(f.child_id) ?? []), f])
    }
    return {
      session,
      data,
      summaries: summarize(data.children, data.measurements, data.today),
      posyanduById: new Map(data.posyandu.map((p) => [p.id, p])),
      followUpsByChild,
      async addFollowUp(input) {
        const row = await saveFollowUp(session, input)
        setState((s) =>
          s.status === 'ready' ? { ...s, data: { ...s.data, followUps: [...s.data.followUps, row] } } : s,
        )
      },
      reload: () => load(session),
      logout,
    }
  }, [ready, load, logout])

  if (state.status === 'checking') return null
  if (state.status === 'signedOut') return <>{login((s) => void load(s))}</>
  if (state.status === 'loading') return <>{loading}</>
  if (state.status === 'error')
    return (
      <>
        {failed(
          state.message,
          () => void load(state.session),
          () => void logout(),
        )}
      </>
    )
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
