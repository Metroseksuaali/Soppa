import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EventRow } from '../api';
import { Spinner, ErrorMsg } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { t } from '../i18n';

export function EventsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => api.get<EventRow[]>('/events'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['events'] });
  };

  const createMut = useMutation({
    mutationFn: () => api.post('/events', { name: name.trim() }),
    onSuccess: () => {
      invalidate();
      setName('');
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
      <Link to="/" className="text-brand text-sm font-medium">{t.common.backHome}</Link>
      <h1 className="text-xl font-bold">{t.events.title}</h1>

      <div className="card p-4 flex gap-2">
        <input
          className="input"
          placeholder={t.events.newPlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-primary px-4"
          disabled={!name.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {t.common.create}
        </button>
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
                  {e.active && <span className="chip bg-emerald-100 text-emerald-800">{t.events.activeTag}</span>}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {e.starts_at ? t.events.startedAt(fmtDateTime(e.starts_at)) : t.events.notStarted}
                  {e.ends_at && ` · ${t.events.endedAt(fmtDateTime(e.ends_at))}`}
                </div>
              </div>
              <Link to={`/raportit?event=${e.id}`} className="text-sm text-brand font-medium">
                {t.events.report}
              </Link>
            </div>
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
