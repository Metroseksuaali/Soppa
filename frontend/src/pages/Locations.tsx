import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Location } from '../api';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Spinner, ErrorMsg } from '../components/ui';
import { t } from '../i18n';

export function LocationsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: () => api.get<Location[]>('/locations'),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/locations', { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      setName('');
    },
  });

  const toggleMut = useMutation({
    mutationFn: (loc: Location) => api.patch(`/locations/${loc.id}`, { active: !loc.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });

  return (
    <div className="space-y-4 md:max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1 text-brand text-sm font-medium"><ArrowLeft className="w-4 h-4" />{t.common.backHome}</Link>
      <h1 className="text-xl font-bold">{t.locations.title}</h1>

      <div className="card p-4 flex gap-2">
        <input
          className="input"
          placeholder={t.locations.newPlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-primary px-4"
          disabled={!name.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {t.common.add}
        </button>
      </div>
      {createMut.error && <ErrorMsg error={createMut.error} />}

      {isLoading && <Spinner />}
      {error && <ErrorMsg error={error} />}

      {!!data?.length && <p className="text-xs text-slate-500">{t.locations.listHint}</p>}

      <ul className="space-y-2">
        {data?.map((l) => (
          <li key={l.id} className="card p-4 flex items-center justify-between gap-2">
            <Link to={`/sijainnit/${l.id}`} className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{l.name}</span>
                  {l.kind === 'varasto' && (
                    <span className="chip bg-slate-100 text-slate-600">{t.locations.warehouseTag}</span>
                  )}
                  {!l.active && <span className="chip bg-red-100 text-red-700">{t.locations.hiddenTag}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {l.items_out ? t.locations.itemsOut(l.items_out) : t.locations.nothingOut}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 ml-auto" />
            </Link>
            {l.kind !== 'varasto' && (
              <button className="text-sm text-brand font-medium shrink-0" onClick={() => toggleMut.mutate(l)}>
                {l.active ? t.locations.hide : t.locations.show}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
