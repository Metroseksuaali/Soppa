import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Location } from '../api';
import { ArrowLeft } from 'lucide-react';
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

      <ul className="space-y-2">
        {data?.map((l) => (
          <li key={l.id} className="card p-4 flex items-center justify-between">
            <div>
              <span className="font-medium">{l.name}</span>
              {l.kind === 'varasto' && (
                <span className="chip bg-slate-100 text-slate-600 ml-2">{t.locations.warehouseTag}</span>
              )}
              {!l.active && <span className="chip bg-red-100 text-red-700 ml-2">{t.locations.hiddenTag}</span>}
            </div>
            {l.kind !== 'varasto' && (
              <button className="text-sm text-brand font-medium" onClick={() => toggleMut.mutate(l)}>
                {l.active ? t.locations.hide : t.locations.show}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
