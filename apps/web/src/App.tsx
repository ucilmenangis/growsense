import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { StoreProvider, useStore } from './data/store'
import { Layout } from './components/Layout'
import { Button } from './components/ui'
import { Login } from './pages/Login'
import { Priority } from './pages/Priority'
import { Children } from './pages/Children'
import { ChildPage } from './pages/ChildPage'
import { FollowUps } from './pages/FollowUps'
import { Posyandu } from './pages/Posyandu'
import { Export } from './pages/Export'
import { Report } from './pages/Report'
import { Trend } from './pages/Trend'
import { MapPage } from './pages/MapPage'
import { Planning } from './pages/Planning'

/** Pages with child level data are for the bidan only. */
function BidanOnly({ children }: { children: ReactNode }) {
  const { session } = useStore()
  return session.role === 'bidan' ? <>{children}</> : <Navigate to="/tren" replace />
}

function Home() {
  const { session } = useStore()
  return <Navigate to={session.role === 'bidan' ? '/prioritas' : '/tren'} replace />
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>
}

export function App() {
  return (
    <BrowserRouter>
      <StoreProvider
        login={(onLogin) => <Login onLogin={onLogin} />}
        loading={
          <Centered>
            <img src="/logo-mark.png" alt="" className="size-14 animate-pulse" />
            <p className="text-sm text-on-surface-variant">Memuat data Posyandu...</p>
          </Centered>
        }
        failed={(message, retry, logout) => (
          <Centered>
            <p className="font-semibold">Data gagal dimuat</p>
            <p className="max-w-md text-sm text-on-surface-variant">{message}</p>
            <div className="flex gap-2">
              <Button onClick={retry}>Coba lagi</Button>
              <Button variant="secondary" onClick={logout}>
                Keluar
              </Button>
            </div>
          </Centered>
        )}
      >
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route
              path="prioritas"
              element={
                <BidanOnly>
                  <Priority />
                </BidanOnly>
              }
            />
            <Route
              path="balita"
              element={
                <BidanOnly>
                  <Children />
                </BidanOnly>
              }
            />
            <Route
              path="balita/:id"
              element={
                <BidanOnly>
                  <ChildPage />
                </BidanOnly>
              }
            />
            <Route
              path="tindak-lanjut"
              element={
                <BidanOnly>
                  <FollowUps />
                </BidanOnly>
              }
            />
            <Route
              path="posyandu"
              element={
                <BidanOnly>
                  <Posyandu />
                </BidanOnly>
              }
            />
            <Route
              path="ekspor"
              element={
                <BidanOnly>
                  <Export />
                </BidanOnly>
              }
            />
            <Route
              path="laporan"
              element={
                <BidanOnly>
                  <Report />
                </BidanOnly>
              }
            />
            <Route path="tren" element={<Trend />} />
            <Route path="peta" element={<MapPage />} />
            <Route path="ringkasan" element={<Planning />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  )
}
