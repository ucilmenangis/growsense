import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { AppStateProvider } from './lib/appState'
import type { Session } from './lib/auth'
import { AddChild } from './screens/AddChild'
import { ChildDetail } from './screens/ChildDetail'
import { ChildList } from './screens/ChildList'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Measure } from './screens/Measure'
import { Notifications } from './screens/Notifications'
import { Priority } from './screens/Priority'
import { Profile } from './screens/Profile'

function SubLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <Outlet />
    </div>
  )
}

export function App() {
  // The app starts locked: the kader unlocks with the PIN every time it opens.
  const [session, setSession] = useState<Session | null>(null)
  if (!session) return <Login onLogin={setSession} />

  return (
    <AppStateProvider session={session} onLock={() => setSession(null)}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="balita" element={<ChildList />} />
            <Route path="timbang" element={<ChildList key="timbang" initialFilter="belum" />} />
            <Route path="pantauan" element={<Priority />} />
          </Route>
          <Route element={<SubLayout />}>
            <Route path="balita/baru" element={<AddChild />} />
            <Route path="balita/:id" element={<ChildDetail />} />
            <Route path="balita/:id/timbang" element={<Measure />} />
            <Route path="notifikasi" element={<Notifications />} />
            <Route path="profil" element={<Profile onSignedOut={() => setSession(null)} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  )
}
