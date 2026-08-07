import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, EventRow } from '../api';
import { useAuth } from '../auth';
import { Home, Package, Pencil, BarChart3, TrendingUp, Upload, Layers, MapPin, Calendar, Users, Sun, Moon, LogOut } from 'lucide-react';
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
  { to: '/tuoteryhmat', label: t.nav.groups, icon: Layers, end: false },
  { to: '/sijainnit', label: t.nav.locations, icon: MapPin, end: false },
  { to: '/tapahtumat', label: t.nav.events, icon: Calendar, end: false },
  { to: '/tuonti', label: t.nav.importData, icon: Upload, end: false },
];

// Selaimen osoitepalkin väri seuraa teemaa (arvot: index.css --c-surface / --c-bg).
const THEME_COLOR = { light: '#ffffff', dark: '#0b0f14' };

// Ikoninappi otsikkopalkeissa — huomaamaton, mutta 44px kosketusala.
const iconBtn =
  'inline-flex items-center justify-center h-touch w-touch rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next ? THEME_COLOR.dark : THEME_COLOR.light);
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
    <div className="min-h-full bg-app md:flex">
      {/* ===== Työpöydän sivupalkki (piilossa mobiilissa) ===== */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen bg-surface border-r border-line">
        <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
          <span className="bg-brand-gradient text-white rounded-lg h-8 w-8 shrink-0 flex items-center justify-center">
            <PotLogo className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight text-fg">{t.app.name}</div>
            <div className="section-title truncate">{t.app.tagline}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {sidebarNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-soft text-brand-ink'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-line px-3 py-3 space-y-2">
          <div className="rounded-lg bg-surface-2 px-2.5 py-2">
            <div className="section-title">{t.header.activeEvent}</div>
            <div className={`text-sm font-semibold truncate ${activeEvent ? 'text-accent-ink' : 'text-fg-subtle'}`}>
              {activeEvent ? activeEvent.name : t.header.noActiveEvent}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-fg-muted truncate flex-1 px-1">{user?.display_name}</span>
            <button onClick={toggleTheme} aria-label={t.header.toggleTheme} title={t.header.toggleTheme} className={iconBtn}>
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button onClick={handleLogout} aria-label={t.header.logout} title={t.header.logout} className={iconBtn}>
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Sisältösarake ===== */}
      <div className="flex flex-col min-h-full w-full max-w-2xl mx-auto md:max-w-none md:mx-0 md:min-w-0 md:flex-1">
        {/* Mobiilin yläpalkki (piilossa työpöydällä) */}
        <header className="md:hidden sticky top-0 z-10 h-14 px-2 pl-3 flex items-center gap-2.5 bg-surface/85 backdrop-blur border-b border-line">
          <span className="bg-brand-gradient text-white rounded-lg h-8 w-8 shrink-0 flex items-center justify-center">
            <PotLogo className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm leading-tight text-fg">{t.app.name}</div>
            <div
              className={`text-2xs leading-tight truncate ${
                activeEvent ? 'text-accent-ink font-medium' : 'text-fg-subtle'
              }`}
            >
              {activeEvent ? activeEvent.name : t.header.noActiveEvent}
            </div>
          </div>
          <button onClick={toggleTheme} aria-label={t.header.toggleTheme} title={t.header.toggleTheme} className={iconBtn}>
            {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <button onClick={handleLogout} aria-label={t.header.logout} title={t.header.logout} className={iconBtn}>
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </header>

        <main className="flex-1 px-3 py-4 pb-24 md:px-8 md:py-6 md:pb-8">
          <div className="mx-auto w-full md:max-w-5xl">{children}</div>
        </main>

        {/* Mobiilin alapalkki (piilossa työpöydällä) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 bg-surface/90 backdrop-blur border-t border-line max-w-2xl mx-auto pb-safe">
          {/* Kiinteä korkeus, jotta etusivun kelluva pikatoimintopalkki osaa
              asettua tarkasti tämän päälle (index.css: --nav-h). */}
          <div className="grid grid-cols-4 h-16">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors ${
                      isActive ? 'text-brand-ink' : 'text-fg-subtle'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex items-center justify-center h-7 w-11 rounded-lg transition-colors ${
                          isActive ? 'bg-brand-soft' : ''
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px]" />
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
