import { Bell, ChartLine, House, Scale, User, Users } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAppState } from '../lib/appState'
import { useNotifications } from '../screens/Notifications'

const tabs = [
  { to: '/', label: 'Beranda', icon: House, end: true },
  { to: '/balita', label: 'Balita', icon: Users, end: false },
  { to: '/timbang', label: 'Timbang', icon: Scale, end: false },
  { to: '/pantauan', label: 'Pantauan', icon: ChartLine, end: false },
]

export function AppShell() {
  const { session } = useAppState()
  const alerts = useNotifications().filter((n) => n.kind === 'risiko').length

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="pt-safe sticky top-0 z-40 bg-surface/85 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="size-9" />
            <span className="text-lg font-semibold tracking-tight text-primary">GrowSense</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/notifikasi"
              aria-label={`Pemberitahuan${alerts ? `, ${alerts} balita perlu perhatian` : ''}`}
              className="relative flex size-10 items-center justify-center rounded-full bg-surface-low text-primary"
            >
              <Bell size={19} />
              {alerts > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {alerts}
                </span>
              )}
            </Link>
            <Link
              to="/profil"
              aria-label={`Profil ${session.fullName}`}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary"
            >
              <User size={19} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-surface-highest bg-surface-lowest/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  isActive ? 'text-primary' : 'text-on-surface-variant'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? 'bg-surface-container' : ''}`}
                  >
                    <Icon size={20} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
