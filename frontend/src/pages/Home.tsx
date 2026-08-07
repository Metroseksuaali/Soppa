import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Upload, MapPin, Calendar, TrendingUp, Layers, Users, ChevronRight } from 'lucide-react';
import { api, EventRow, StockRow } from '../api';
import { useAuth } from '../auth';
import { Spinner } from '../components/ui';
import { fmtQty } from '../lib/format';
import { t } from '../i18n';

// Kirjaaminen ei ole enää etusivulla: Kirjaa-sivu (alapalkki) näyttää kaikki
// viisi kirjaustyyppiä heti ensimmäisenä vaiheena, joten erilliset
// pikatoimintolaatat olisivat vain toinen tapa valita sama asia.
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

  return (
    <div className="space-y-4">
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
