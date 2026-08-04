import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, EventRow } from '../api';
import { useAuth } from '../auth';
import { Home, Package, Pencil, BarChart3, TrendingUp, Upload, MapPin, Calendar, Users, Sun, Moon } from 'lucide-react';
import { t } from '../i18n';
import { PotLogo } from './PotLogo';

// Mobiilin alapalkki näyttää nämä; työpöydän sivupalkki näyttää nämä + lisälinkit.
const primaryNav = [
  { to: '/', label: t.nav.home, icon: Home, end: true },
  { to: '/inventaario', label: t.nav.inventory, icon: Package, end: false },
  { to: '/kirjaa', label: t.nav.log, icon: Pencil, end: false },
  { to: '/raportit', label: t.nav.reports, icon: BarChart3, end: false },
];

// Vain työpöydän sivupalkissa — mobiilissa nämä löytyvät etusivun korteista.
const secondaryNav = [
  { to: '/ennuste', label: t.nav.forecast, icon: TrendingUp, end: false },
  { to: '/sijainnit', label: t.nav.locations, icon: MapPin, end: false },
  { to: '/tapahtumat', label: t.nav.events, icon: Calendar, end: false },
  { to: '/tuonti', label: t.nav.importData, icon: Upload, end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('catering_theme', next ? 'dark' : 'light');
    } catch {
      /* localStorage voi olla estetty — teema toimii silti istunnon ajan */
    }
    setDark(next);
  }

  async function handleLogout() {
    await logout();
    navigate('/kirjaudu');
  }

  const { data: activeEvent } = useQuery({
    queryKey: ['events', 'active'],
    queryFn: () => api.get<EventRow | null>('/events/active'),
  });

  // Sivupalkin linkit: perusnavigaatio + lisälinkit + käyttäjähallinta (vain admin).
  const sidebarNav = [
    ...primaryNav,
    ...secondaryNav,
    ...(user?.is_admin ? [{ to: '/kayttajat', label: t.nav.users, icon: Users, end: false }] : []),
  ];

  return (
    <div className="min-h-full bg-slate-100 md:flex">
      {/* ===== Työpöydän sivupalkki (piilossa mobiilissa) ===== */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen bg-brand text-white">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <PotLogo className="h-9 w-9 shrink-0 text-white" />
          <div className="min-w-0">
            <div className="font-bold leading-tight">{t.app.name}</div>
            <div className="text-[11px] uppercase tracking-wide opacity-80 leading-tight truncate">
              {t.app.tagline}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {sidebarNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/15 px-4 py-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide opacity-70">{t.header.activeEvent}</div>
            <div className="font-semibold text-sm truncate">
              {activeEvent ? activeEvent.name : t.header.noActiveEvent}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-90 truncate flex-1">{user?.display_name}</span>
            <button
              onClick={toggleTheme}
              aria-label={t.header.toggleTheme}
              title={t.header.toggleTheme}
              className="bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5 leading-none"
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-sm bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2"
          >
            {t.header.logout}
          </button>
        </div>
      </aside>

      {/* ===== Sisältösarake ===== */}
      <div className="flex flex-col min-h-full w-full max-w-2xl mx-auto md:max-w-none md:mx-0 md:min-w-0 md:flex-1">
        {/* Mobiilin yläpalkki (piilossa työpöydällä) */}
        <header className="md:hidden sticky top-0 z-10 bg-brand text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <PotLogo className="h-9 w-9 shrink-0 text-white" />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide opacity-80 leading-tight">
                {t.app.name} · {t.header.activeEvent}
              </div>
              <div className="font-semibold truncate leading-tight">
                {activeEvent ? activeEvent.name : t.header.noActiveEvent}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm opacity-90 hidden sm:inline">{user?.display_name}</span>
            <button
              onClick={toggleTheme}
              aria-label={t.header.toggleTheme}
              title={t.header.toggleTheme}
              className="bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5 leading-none"
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5"
            >
              {t.header.logout}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:px-8 md:py-6 md:pb-8">
          <div className="mx-auto w-full md:max-w-5xl">{children}</div>
        </main>

        {/* Mobiilin alapalkki (piilossa työpöydällä) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 bg-white border-t border-slate-200 max-w-2xl mx-auto">
          <div className="grid grid-cols-4">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                      isActive ? 'text-brand font-semibold' : 'text-slate-500'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
