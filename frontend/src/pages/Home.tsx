import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, EventRow, StockRow } from '../api';
import { useAuth } from '../auth';
import { Spinner } from '../components/ui';
import { fmtQty } from '../lib/format';
import { t } from '../i18n';

const quickActions = [
  { action: 'lisays', label: t.home.actions.lisays, icon: '➕', color: 'bg-emerald-600' },
  { action: 'vienti', label: t.home.actions.vienti, icon: '📤', color: 'bg-sky-600' },
  { action: 'palautus', label: t.home.actions.palautus, icon: '📥', color: 'bg-indigo-600' },
  { action: 'kulutus', label: t.home.actions.kulutus, icon: '🍽️', color: 'bg-rose-600' },
  { action: 'inventointi', label: t.home.actions.inventointi, icon: '🔢', color: 'bg-amber-600' },
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
    <div className="space-y-5">
      <div className="card p-4">
        <div className="text-sm text-slate-500">{t.home.welcome(user?.display_name ?? '')}</div>
        {activeEvent ? (
          <div className="mt-1">
            <div className="text-lg font-bold">{activeEvent.name}</div>
            <span className="chip bg-emerald-100 text-emerald-800 mt-1">{t.home.activeEventTag}</span>
          </div>
        ) : (
          <div className="mt-2 rounded-xl bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            {t.home.noEventNotice}{' '}
            <Link to="/tapahtumat" className="underline font-medium">
              {t.home.setEvent}
            </Link>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-2 px-1">{t.home.quickActions}</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.action}
              to={`/kirjaa?action=${a.action}`}
              className={`${a.color} text-white rounded-2xl p-4 flex flex-col items-center gap-1 shadow-sm active:scale-[0.98] transition`}
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="font-semibold text-sm">{a.label}</span>
            </Link>
          ))}
          <Link
            to="/inventaario"
            className="bg-slate-700 text-white rounded-2xl p-4 flex flex-col items-center gap-1 shadow-sm active:scale-[0.98] transition"
          >
            <span className="text-2xl">📦</span>
            <span className="font-semibold text-sm">{t.home.warehouse}</span>
          </Link>
        </div>
      </div>

      {low.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">{t.home.outOfStock}</h2>
          <ul className="divide-y divide-slate-100">
            {low.map((s) => (
              <li key={s.item_id} className="flex justify-between py-2 text-sm">
                <Link to={`/inventaario/${s.item_id}`} className="font-medium text-slate-700">
                  {s.name}
                </Link>
                <span className="text-red-600 font-semibold">
                  {fmtQty(s.stock, s.unit, s.pack_size, s.pack_unit)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/sijainnit" className="card p-4 text-center font-medium text-slate-700">
          {t.home.locations}
        </Link>
        <Link to="/tapahtumat" className="card p-4 text-center font-medium text-slate-700">
          {t.home.events}
        </Link>
        {user?.is_admin && (
          <Link to="/kayttajat" className="card p-4 text-center font-medium text-slate-700 col-span-2">
            {t.home.users}
          </Link>
        )}
      </div>
    </div>
  );
}
