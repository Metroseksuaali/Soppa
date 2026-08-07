import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EventRow } from '../api';
import { Spinner, ErrorMsg } from '../components/ui';
import { ArrowLeft, Users, CalendarRange } from 'lucide-react';
import { fmtDateTime } from '../lib/format';
import { t } from '../i18n';

// Tyhjä syöte -> null (luku poistetaan), muuten kokonaisluku.
function parseCount(s: string): number | null {
  const n = parseInt(s.replace(/\s/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function EventsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [orgCount, setOrgCount] = useState('');
  const [days, setDays] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => api.get<EventRow[]>('/events'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['events'] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      api.post('/events', {
        name: name.trim(),
        org_count: parseCount(orgCount),
        days: parseCount(days),
      }),
    onSuccess: () => {
      invalidate();
      setName('');
      setOrgCount('');
      setDays('');
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => api.patch(`/events/${id}`, { active: true }),
    onSuccess: invalidate,
  });

  const closeMut = useMutation({
    mutationFn: (id: number) => api.post(`/events/${id}/close`),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4 md:max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1 text-brand-ink text-sm font-medium"><ArrowLeft className="w-4 h-4" />{t.common.backHome}</Link>
      <h1 className="text-xl font-bold">{t.events.title}</h1>

      <div className="card p-4 space-y-2">
        <input
          className="input"
          placeholder={t.events.newPlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={t.events.newOrgPlaceholder}
            value={orgCount}
            onChange={(e) => setOrgCount(e.target.value)}
          />
          <input
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={t.events.newDaysPlaceholder}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <button
            className="btn-primary px-4 shrink-0"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {t.common.create}
          </button>
        </div>
        <p className="text-xs text-fg-subtle">{t.events.metricsHint}</p>
      </div>
      {createMut.error && <ErrorMsg error={createMut.error} />}

      {isLoading && <Spinner />}
      {error && <ErrorMsg error={error} />}

      <ul className="space-y-2">
        {data?.map((e) => (
          <li key={e.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {e.name}
                  {e.active && (
                    <span className="chip bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {t.events.activeTag}
                    </span>
                  )}
                </div>
                <div className="text-xs text-fg-subtle mt-1 nums">
                  {e.starts_at ? t.events.startedAt(fmtDateTime(e.starts_at)) : t.events.notStarted}
                  {e.ends_at && ` · ${t.events.endedAt(fmtDateTime(e.ends_at))}`}
                </div>
              </div>
              <Link to={`/raportit?event=${e.id}`} className="text-sm text-brand-ink font-medium">
                {t.events.report}
              </Link>
            </div>

            <EventMetrics event={e} onSaved={invalidate} />

            <div className="mt-3 flex gap-2">
              {!e.active && (
                <button
                  className="btn-secondary py-2 text-sm flex-1"
                  onClick={() => activateMut.mutate(e.id)}
                >
                  {t.events.activate}
                </button>
              )}
              {e.active && (
                <button className="btn-danger py-2 text-sm flex-1" onClick={() => closeMut.mutate(e.id)}>
                  {t.events.close}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Orgien määrä + kesto: näkyvät chippeinä, muokkaus avautuu paikan päällä.
// Nämä luvut ovat ennustelaskennan pohja (ks. Ennuste-sivu).
function EventMetrics({ event, onSaved }: { event: EventRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [orgCount, setOrgCount] = useState(event.org_count?.toString() ?? '');
  const [days, setDays] = useState(event.days_manual?.toString() ?? '');

  const saveMut = useMutation({
    mutationFn: () =>
      api.patch(`/events/${event.id}`, {
        org_count: parseCount(orgCount),
        days: parseCount(days),
      }),
    onSuccess: () => {
      onSaved();
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
        <span
          className={`chip inline-flex items-center gap-1 ${
            event.org_count
              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          {event.org_count ? t.events.orgCountShort(event.org_count) : t.events.orgCountMissing}
        </span>
        <span className="chip inline-flex items-center gap-1 bg-surface-2 text-fg">
          <CalendarRange className="w-3.5 h-3.5" />
          {t.events.daysShort(event.days_effective)}
          {event.days_manual === null && t.events.daysAuto}
        </span>
        <button className="text-brand-ink font-medium min-h-touch" onClick={() => setOpen(true)}>
          {t.events.editMetrics}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="label">{t.events.orgCount}</span>
          <input
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            value={orgCount}
            onChange={(e) => setOrgCount(e.target.value)}
          />
        </label>
        <label className="flex-1">
          <span className="label">{t.events.days}</span>
          <input
            className="input"
            type="number"
            min={1}
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="btn-primary py-2 text-sm flex-1"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? t.common.saving : t.common.save}
        </button>
        <button className="btn-secondary py-2 text-sm flex-1" onClick={() => setOpen(false)}>
          {t.common.back}
        </button>
      </div>
      {saveMut.error && <ErrorMsg error={saveMut.error} />}
    </div>
  );
}
