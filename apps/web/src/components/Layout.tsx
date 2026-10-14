// Sidebar shell from the Stitch dashboard designs. Bidan sees both groups; Pemdes only planning.
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  BarChart3,
  ClipboardList,
  FileDown,
  FileText,
  LogOut,
  Map,
  Menu,
  NotebookPen,
  Search,
  Siren,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../data/store'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const BIDAN: { title: string; items: NavItem[] }[] = [
  {
    title: 'Menu utama',
    items: [
      { to: '/prioritas', label: 'Prioritas kunjungan rumah', icon: <Siren size={18} /> },
      { to: '/balita', label: 'Profil balita', icon: <Users size={18} /> },
      { to: '/tindak-lanjut', label: 'Tindak lanjut dan rujukan', icon: <NotebookPen size={18} /> },
      { to: '/posyandu', label: 'Pemantauan Posyandu', icon: <ClipboardList size={18} /> },
    ],
  },
  {
    title: 'Pelaporan dan data',
    items: [
      { to: '/ekspor', label: 'Ekspor e-PPGBM dan SATUSEHAT', icon: <FileDown size={18} /> },
      { to: '/laporan', label: 'Laporan bulanan', icon: <FileText size={18} /> },
    ],
  },
]

const PEMDES: { title: string; items: NavItem[] }[] = [
  {
    title: 'Tampilan Pemdes dan Dinkes',
    items: [
      { to: '/tren', label: 'Tren bulanan', icon: <TrendingUp size={18} /> },
      { to: '/peta', label: 'Peta sebaran per dusun', icon: <Map size={18} /> },
      { to: '/ringkasan', label: 'Ringkasan perencanaan', icon: <BarChart3 size={18} /> },
    ],
  },
]

export function Layout() {
  const { session, logout } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const groups = session.role === 'bidan' ? [...BIDAN, ...PEMDES] : PEMDES

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex items-center gap-2.5 px-2">
        <img src="/logo-mark.png" alt="" className="size-9" />
        <div>
          <p className="font-bold leading-tight text-primary">GrowSense</p>
          <p className="text-[11px] leading-tight text-on-surface-variant">{session.puskesmasName}</p>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-low'
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {session.demo && (
          <p className="rounded-xl bg-warn-container px-3 py-2 text-xs text-warn">
            Mode demo: data contoh, bukan data balita sungguhan.
          </p>
        )}
        <div className="rounded-xl bg-surface-low p-3">
          <p className="text-sm font-semibold">{session.fullName}</p>
          <p className="text-xs text-on-surface-variant">
            {session.role === 'bidan' ? 'Bidan / Nakes' : 'Pemdes dan Dinkes'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-danger-container py-2.5 text-sm font-semibold text-danger"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-dvh lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-surface-high bg-surface-lowest lg:block print:hidden">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-on-surface/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface-lowest shadow-xl">{sidebar}</aside>
        </div>
      )}
      <header
        className={`sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-high bg-surface/90 px-4 backdrop-blur-xl md:px-8 print:hidden ${session.role === 'bidan' ? '' : 'lg:hidden'}`}
      >
        <button
          type="button"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          className="rounded-xl p-2 text-primary hover:bg-surface-low lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        {session.role === 'bidan' && (
          <form
            className="flex max-w-md flex-1 items-center gap-2 rounded-xl bg-surface-low px-3"
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/balita?q=${encodeURIComponent(query.trim())}`)
            }}
          >
            <Search size={16} className="text-on-surface-variant" />
            <input
              className="h-10 flex-1 bg-transparent text-sm outline-none"
              placeholder="Cari nama balita, ibu, atau NIK"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari balita"
            />
          </form>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}
