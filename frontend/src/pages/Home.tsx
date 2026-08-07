import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, Download, Utensils, ClipboardList, Warehouse, MapPin, Calendar, TrendingUp, Layers, Users, ChevronRight } from 'lucide-react';
import { api, EventRow, StockRow } from '../api';
import { useAuth } from '../auth';
import { Spinner } from '../components/ui';
import { fmtQty } from '../lib/format';
import { t } from '../i18n';

// Kirjaustyypin väri on sävytetty pinta (ei täysvärinen laatta): tunnistettava
// vilkaisulla, mutta ei huuda. Sama väriparitus toimii molemmissa teemoissa.
const quickActions = [
  { action: 'lisays', label: t.home.actions.lisays, icon: Plus, tint: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { action: 'vienti', label: t.home.actions.vienti, icon: Upload, tint: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  { action: 'palautus', label: t.home.actions.palautus, icon: Download, tint: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  { action: 'kulutus', label: t.home.actions.kulutus, icon: Utensils, tint: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  { action: 'inventointi', label: t.home.actions.inventointi, icon: ClipboardList, tint: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
];

// Loput näkymät yhtenä listana — mobiilissa lyhyempi kuin erilliset kortit.
const moreLinks = [
  { to: '/sijainnit', label: t.home.locations, icon: MapPin, adminOnly: false },
  { to: '/tapahtumat', label: t.home.events, icon: Calendar, adminOnly: false },
  { to: '/ennuste', label: t.home.forecast, icon: TrendingUp, adminOnly: false },
  { to: '/tuoteryhmat', label: t.home.groups, icon: Layers, adminOnly: false },
  { to: '/tuonti', label: t.home.importData, icon: Upload, adminOnly: false },
  { to: '/kayttajat', label: t.home.users, icon: Users, adminOnly: true },
];

export function HomePage() {
  const { user } = useAuth();
  const { data: activeEvent, isLoading } = useQuery({
    queryKey: ['events', 'active'],
    queryFn: () => api.get<EventRow | null>('/events/active'),
  });
  const { data: stock } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get<StockRow[]>('/stock'),
  });

  if (isLoading) return <Spinner />;

  // Näytä muutama pieni saldo huomiona.
  const low = (stock ?? []).filter((s) => s.stock <= 0).slice(0, 5);

  // Layoutin main hoitaa jo alapalkin tilan (pb-24); tämä lisää vain kelluvan
  // pikatoimintopalkin korkeuden, jotta viimeinen rivi ei jää sen alle.
  return (
    <div className="flex flex-col gap-4 pb-20 md:pb-0">
      <div>
        <div className="text-xs text-fg-subtle">{t.home.welcome(user?.display_name ?? '')}</div>
        {activeEvent ? (
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-fg leading-tight">{activeEvent.name}</h1>
            <span className="chip bg-accent-soft text-accent-ink">{t.home.activeEventTag}</span>
          </div>
        ) : (
          <div className="mt-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {t.home.noEventNotice}{' '}
            <Link to="/tapahtumat" className="underline font-semibold">
              {t.home.setEvent}
            </Link>
          </div>
        )}
      </div>

      {/* Mobiilissa kelluva palkki heti alanavigaation päällä: kirjaaminen on
          etusivun ydintoiminto, ja se halutaan peukalon ulottuvilta ilman
          selaamista. Yksi rivi kuutta laattaa mahtuu puhelimen leveyteen ja
          peittää vain ~60px. Työpöydällä palkki palaa normaaliin virtaan. */}
      <div
        className="fixed inset-x-0 above-bottom-nav z-10 max-w-2xl mx-auto px-2 py-1.5
          bg-surface/95 backdrop-blur border-t border-line
          md:static md:inset-auto md:z-auto md:max-w-none md:mx-0 md:p-0
          md:bg-transparent md:backdrop-blur-none md:border-0"
      >
        <h2 className="section-title mb-1.5 px-0.5 hidden md:block">{t.home.quickActions}</h2>
        <div className="grid grid-cols-6 gap-1 md:gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.action}
                to={`/kirjaa?action=${a.action}`}
                className={`${a.tint} rounded-lg md:rounded-xl py-1.5 md:py-3 flex flex-col items-center gap-0.5 md:gap-1 font-semibold text-2xs md:text-xs active:scale-[0.98] transition-transform`}
              >
                <Icon className="w-[18px] h-[18px] md:w-5 md:h-5" />
                {a.label}
              </Link>
            );
          })}
          <Link
            to="/inventaario"
            className="bg-surface-2 text-fg rounded-lg md:rounded-xl py-1.5 md:py-3 flex flex-col items-center gap-0.5 md:gap-1 font-semibold text-2xs md:text-xs active:scale-[0.98] transition-transform"
          >
            <Warehouse className="w-[18px] h-[18px] md:w-5 md:h-5" />
            {t.home.warehouse}
          </Link>
        </div>
      </div>

      {low.length > 0 && (
        <div className="card px-3 py-2.5">
          <h2 className="section-title mb-1">{t.home.outOfStock}</h2>
          <ul className="divide-y divide-line -mx-3 px-3">
            {low.map((s) => (
              <li key={s.item_id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <Link to={`/inventaario/${s.item_id}`} className="font-medium text-fg truncate">
                  {s.name}
                </Link>
                <span className="text-red-600 dark:text-red-400 font-semibold nums shrink-0">
                  {fmtQty(s.stock, s.unit, s.pack_size, s.pack_unit)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card divide-y divide-line overflow-hidden">
        {moreLinks
          .filter((l) => !l.adminOnly || user?.is_admin)
          .map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center gap-3 px-3 min-h-touch text-sm font-medium text-fg hover:bg-surface-2 transition-colors"
              >
                <Icon className="w-[18px] h-[18px] text-fg-subtle shrink-0" />
                <span className="flex-1">{l.label}</span>
                <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
              </Link>
            );
          })}
      </div>
    </div>
  );
}
