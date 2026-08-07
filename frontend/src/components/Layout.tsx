import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, EventRow } from '../api';
import { useAuth } from '../auth';
import { Home, Package, Pencil, BarChart3, TrendingUp, Upload, Layers, MapPin, Calendar, Users, Sun, Moon, LogOut, MoreHorizontal, ChevronRight } from 'lucide-react';
import { t } from '../i18n';
import { PotLogo } from './PotLogo';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  end: boolean;
  adminOnly?: boolean;
};

const NAV = {
  home: { to: '/', label: t.nav.home, icon: Home, end: true },
  inventory: { to: '/inventaario', label: t.nav.inventory, icon: Package, end: false },
  log: { to: '/kirjaa', label: t.nav.log, icon: Pencil, end: false },
  locations: { to: '/sijainnit', label: t.nav.locations, icon: MapPin, end: false },
  reports: { to: '/raportit', label: t.nav.reports, icon: BarChart3, end: false },
  forecast: { to: '/ennuste', label: t.nav.forecast, icon: TrendingUp, end: false },
  events: { to: '/tapahtumat', label: t.nav.events, icon: Calendar, end: false },
  groups: { to: '/tuoteryhmat', label: t.nav.groups, icon: Layers, end: false },
  importData: { to: '/tuonti', label: t.nav.importData, icon: Upload, end: false },
  users: { to: '/kayttajat', label: t.nav.users, icon: Users, end: false, adminOnly: true },
} satisfies Record<string, NavItem>;

// Mobiilin alapalkki: neljä tapahtuman aikana jatkuvassa käytössä olevaa
// (ruudukko on grid-cols-5, viides paikka on Valikko-nappi). Raportteja ja
// muita luetaan harvemmin kuin kirjataan, joten ne ovat Valikon takana.
const bottomNav: NavItem[] = [NAV.home, NAV.log, NAV.inventory, NAV.locations];

// Työpöydän sivupalkki ryhmissä: tasainen kymmenen linkin lista ei kertonut
// mikä on päivittäistä työtä ja mikä kertaluontoista asetusta. Ryhmittely on
// käyttötiheyden mukaan — ylin ryhmä on tapahtuman aikana jatkuvassa käytössä,
// alin lähinnä ennen tapahtumaa. Myös ryhmän sisällä järjestys on tiheyden
// mukaan: tapahtuman aikana kirjataan useammin kuin selataan inventaariota.
const sidebarGroups: { label?: string; items: NavItem[] }[] = [
  { items: [NAV.home, NAV.log, NAV.inventory, NAV.locations] },
  { label: t.nav.groupMonitoring, items: [NAV.reports, NAV.forecast] },
  { label: t.nav.groupManage, items: [NAV.events, NAV.groups, NAV.importData, NAV.users] },
];

// Selaimen osoitepalkin väri seuraa teemaa (arvot: index.css --c-surface / --c-bg).
const THEME_COLOR = { light: '#ffffff', dark: '#0b0f14' };

// Ikoninappi otsikkopalkeissa — huomaamaton, mutta 44px kosketusala.
const iconBtn =
  'inline-flex items-center justify-center h-touch w-touch rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [moreOpen, setMoreOpen] = useState(false);

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

  // Pudota admin-linkit muilta ja tyhjäksi jäävä ryhmä kokonaan.
  const visibleGroups = sidebarGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || user?.is_admin) }))
    .filter((g) => g.items.length > 0);

  // Mobiilin Valikko-lehti = samat ryhmät miinus ne jotka jo ovat alapalkissa.
  // Johdetaan sivupalkista, jottei listoja tarvitse pitää käsin samassa: uusi
  // NAV-linkki ilmestyy tänne itsestään.
  const sheetGroups = visibleGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !bottomNav.includes(i)) }))
    .filter((g) => g.items.length > 0);

  // Valikko-nappi näyttää aktiiviselta kun ollaan jollain sen takana olevalla
  // sivulla — muuten alapalkissa ei näkyisi lainkaan missä ollaan.
  const moreActive = sheetGroups.some((g) =>
    g.items.some((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))
  );

  // Sulje valikko kun sivu vaihtuu (myös alapalkin muista napeista).
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

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

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {visibleGroups.map((group, gi) => (
            <div key={group.label ?? gi} className="space-y-0.5">
              {group.label && <div className="section-title px-2.5 pb-1">{group.label}</div>}
              {group.items.map((item) => {
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
            </div>
          ))}
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

        {/* Taustapeite sulkee valikon mistä tahansa kosketuksesta sen ulkopuolelle.
            Alapalkki on tämän päällä (z-30), joten Valikko-nappi pysyy näkyvissä ja
            napautettavissa — sama nappi sulkee valikon, mikä on ilmeisin tapa. */}
        {moreOpen && (
          <div
            className="md:hidden fixed inset-0 z-20 bg-black/40"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
        )}

        {/* Mobiilin alapalkki (piilossa työpöydällä) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur border-t border-line max-w-2xl mx-auto pb-safe">
          {/* Valikko avautuu palkin PÄÄLLE, ei sen yli: bottom-full ankkuroi
              paneelin alapalkin ylälaitaan, joten palkki jää näkyviin eikä
              tarvitse arvata mistä valikko sulkeutuu. Ei myöskään kovakoodattua
              korkeutta — bottom-full seuraa palkin todellista mittaa. */}
          {moreOpen && (
            <div className="absolute bottom-full inset-x-0 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-3 py-3 space-y-4">
              {sheetGroups.map((group, gi) => (
                <div key={group.label ?? gi}>
                  {group.label && <div className="section-title mb-1">{group.label}</div>}
                  <div className="divide-y divide-line">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMoreOpen(false)}
                          className="flex items-center gap-3 min-h-touch text-sm font-medium text-fg"
                        >
                          <Icon className="w-[18px] h-[18px] text-fg-subtle shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Kiinteä korkeus: sisältö keskittyy pystysuunnassa ja palkki pysyy
              samana riippumatta labelien pituudesta. */}
          <div className="grid grid-cols-5 h-16">
            {bottomNav.map((item) => {
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

            {/* Viides nappi: loput näkymät. Ei NavLink vaan nappi, koska tämä ei
                vie mihinkään vaan avaa listan. */}
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={t.nav.more}
              aria-expanded={moreOpen}
              className={`flex flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors ${
                moreActive || moreOpen ? 'text-brand-ink' : 'text-fg-subtle'
              }`}
            >
              <span
                className={`flex items-center justify-center h-7 w-11 rounded-lg transition-colors ${
                  moreActive || moreOpen ? 'bg-brand-soft' : ''
                }`}
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </span>
              {t.nav.more}
            </button>
          </div>
        </nav>

      </div>
    </div>
  );
}
