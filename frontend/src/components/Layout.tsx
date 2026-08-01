import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, EventRow } from '../api';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { PotLogo } from './PotLogo';

const navItems = [
  { to: '/', label: t.nav.home, icon: '🏠', end: true },
  { to: '/inventaario', label: t.nav.inventory, icon: '📦', end: false },
  { to: '/kirjaa', label: t.nav.log, icon: '✏️', end: false },
  { to: '/raportit', label: t.nav.reports, icon: '📊', end: false },
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

  const { data: activeEvent } = useQuery({
    queryKey: ['events', 'active'],
    queryFn: () => api.get<EventRow | null>('/events/active'),
  });

  return (
    <div className="min-h-full flex flex-col max-w-2xl mx-auto bg-slate-100">
      <header className="sticky top-0 z-10 bg-brand text-white px-4 py-3 flex items-center justify-between shadow-md">
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
            className="text-base bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5 leading-none"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={async () => {
              await logout();
              navigate('/kirjaudu');
            }}
            className="text-sm bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5"
          >
            {t.header.logout}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-slate-200 max-w-2xl mx-auto">
        <div className="grid grid-cols-4">
          {navItems.map((item) => (
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
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
