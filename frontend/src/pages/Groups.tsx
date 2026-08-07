import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { api, GroupMember, GroupUnit, ItemGroup } from '../api';
import { Spinner, ErrorMsg } from '../components/ui';
import { fmtNum } from '../lib/format';
import { t } from '../i18n';

// Ehdotukset; kenttä hyväksyy minkä tahansa yksikön kuten tuotteen yksikkökin.
const UNIT_SUGGESTIONS: GroupUnit[] = ['kg', 'l', 'kpl', 'pkt', 'prk', 'plo'];

export function GroupsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState<GroupUnit>('kg');

  const { data, isLoading, error } = useQuery({
    queryKey: ['groups', 'all'],
    queryFn: () => api.get<ItemGroup[]>('/groups?active=all'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['groups'] });

  const createMut = useMutation({
    mutationFn: () => api.post('/groups', { name: name.trim(), base_unit: baseUnit }),
    onSuccess: () => {
      invalidate();
      setName('');
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/groups/${id}`, body),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4 md:max-w-2xl">
      <h1 className="text-xl font-bold">{t.groups.title}</h1>
      <p className="text-sm text-fg-muted">{t.groups.intro}</p>

      <div className="card p-4 space-y-2">
        <input
          className="input"
          placeholder={t.groups.newPlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="label">{t.groups.baseUnit}</span>
            <input
              className="input"
              list="group-units"
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
            />
            <datalist id="group-units">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <button
            className="btn-primary px-4 self-end"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {t.common.create}
          </button>
        </div>
        <p className="text-xs text-fg-subtle">{t.groups.baseUnitHint}</p>
      </div>
      {createMut.error && <ErrorMsg error={createMut.error} />}

      {isLoading && <Spinner />}
      {error && <ErrorMsg error={error} />}
      {data?.length === 0 && <div className="text-fg-subtle text-sm">{t.groups.empty}</div>}

      <ul className="space-y-2">
        {data?.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            onToggleActive={() => patchMut.mutate({ id: g.id, body: { active: !g.active } })}
            onRename={(newName) => patchMut.mutate({ id: g.id, body: { name: newName } })}
          />
        ))}
      </ul>
      {patchMut.error && <ErrorMsg error={patchMut.error} />}
    </div>
  );
}

function GroupCard({
  group,
  onToggleActive,
  onRename,
}: {
  group: ItemGroup;
  onToggleActive: () => void;
  onRename: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: members } = useQuery({
    queryKey: ['groups', group.id, 'items'],
    queryFn: () => api.get<GroupMember[]>(`/groups/${group.id}/items`),
    enabled: open,
  });

  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <button className="flex items-start gap-1 min-w-0 text-left" onClick={() => setOpen(!open)}>
          {open ? (
            <ChevronDown className="w-4 h-4 shrink-0 mt-1 text-fg-subtle" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 mt-1 text-fg-subtle" />
          )}
          <span className="min-w-0">
            <span className="font-semibold flex items-center gap-2 flex-wrap">
              {group.name}
              <span className="chip bg-surface-2 text-fg">{group.base_unit}</span>
              {!group.active && <span className="chip bg-surface-2 text-fg-muted">{t.groups.hiddenTag}</span>}
            </span>
            <span className="text-xs text-fg-subtle block mt-0.5 nums">
              {t.groups.itemCount(group.item_count)}
              {group.incompatible_count > 0 && ` · ${t.groups.incompatibleCount(group.incompatible_count)}`}
            </span>
          </span>
        </button>
        <div className="flex gap-3 text-sm shrink-0">
          <button
            className="text-brand-ink font-medium"
            onClick={() => {
              const next = prompt(t.groups.rename, group.name);
              if (next && next.trim() && next.trim() !== group.name) onRename(next.trim());
            }}
          >
            {t.groups.rename}
          </button>
          <button className="text-fg-muted font-medium" onClick={onToggleActive}>
            {group.active ? t.groups.hide : t.groups.show}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-fg-muted mb-1">{t.groups.members}</div>
          {members?.length === 0 && <div className="text-sm text-fg-subtle">{t.groups.noMembers}</div>}
          <ul className="divide-y divide-line text-sm">
            {members?.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 py-1.5">
                <Link to={`/inventaario/${m.id}`} className="min-w-0 truncate text-fg">
                  {m.name}
                </Link>
                <span className="shrink-0 text-xs">
                  {m.factor === null ? (
                    <span className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t.groups.factorMissing}
                    </span>
                  ) : (
                    <span className="text-fg-subtle nums">
                      {t.groups.factor(m.unit, fmtNum(m.factor), group.base_unit)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
