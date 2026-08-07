import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import {
  api,
  Category,
  EventRow,
  ForecastBasis,
  ForecastGroup,
  ForecastItem,
  ForecastReport,
  TotalsReport,
} from '../api';
import { Spinner, ErrorMsg } from '../components/ui';
import { fmtQty, fmtNum, fmtDate } from '../lib/format';
import { t } from '../i18n';

interface ForecastParams {
  event_ids: number[];
  org_count: number;
  days: number;
  category?: Category;
}

export function ForecastPage() {
  const [orgCount, setOrgCount] = useState('');
  const [days, setDays] = useState('1');
  const [basis, setBasis] = useState<ForecastBasis>('per_org');
  const [level, setLevel] = useState<'group' | 'item'>('group');
  const [category, setCategory] = useState<Category | ''>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [params, setParams] = useState<ForecastParams | null>(null);

  const { data: events } = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => api.get<EventRow[]>('/events'),
  });

  // Oletusvalinta: kaikki päättyneet tapahtumat joissa on orgien määrä.
  // Aktiivinen tapahtuma jätetään pois — se on vielä kesken eikä kuvaa koko menekkiä.
  useEffect(() => {
    if (!events || initialized) return;
    setSelected(new Set(events.filter((e) => !e.active && e.org_count).map((e) => e.id)));
    setInitialized(true);
  }, [events, initialized]);

  const orgNum = parseInt(orgCount, 10);
  const daysNum = parseInt(days, 10) || 1;
  const canCalculate = selected.size > 0 && Number.isFinite(orgNum) && orgNum > 0;

  const { data: report, isFetching, error } = useQuery({
    queryKey: ['forecast', params],
    queryFn: () => api.post<ForecastReport>('/reports/forecast', params),
    enabled: params !== null,
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function calculate() {
    if (!canCalculate) return;
    setParams({
      event_ids: Array.from(selected).sort((a, b) => a - b),
      org_count: orgNum,
      days: daysNum,
      ...(category ? { category } : {}),
    });
  }

  return (
    <div className="space-y-4 md:max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-1 text-brand-ink text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        {t.common.backHome}
      </Link>
      <h1 className="text-xl font-bold">{t.forecast.title}</h1>
      <p className="text-sm text-fg-muted">{t.forecast.intro}</p>

      {/* 1. Suunniteltu tapahtuma */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm text-fg-muted">{t.forecast.planTitle}</h2>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="label">{t.forecast.orgCount}</span>
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
            <span className="label">{t.forecast.days}</span>
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
        <label className="block">
          <span className="label">{t.forecast.category}</span>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | '')}
          >
            <option value="">{t.forecast.allCategories}</option>
            {(['ruoka', 'tavara', 'kaluste'] as Category[]).map((c) => (
              <option key={c} value={c}>
                {t.categories[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 2. Laskentatapa */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-sm text-fg-muted">{t.forecast.basisTitle}</h2>
        <div className="grid grid-cols-2 gap-2">
          <BasisButton
            active={basis === 'per_org'}
            label={t.forecast.basisPerOrg}
            onClick={() => setBasis('per_org')}
          />
          <BasisButton
            active={basis === 'per_org_day'}
            label={t.forecast.basisPerOrgDay}
            onClick={() => setBasis('per_org_day')}
          />
        </div>
        <p className="text-xs text-fg-subtle">
          {basis === 'per_org' ? t.forecast.basisPerOrgHint : t.forecast.basisPerOrgDayHint}
        </p>
      </div>

      {/* 3. Vertailutapahtumat */}
      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-fg-muted">{t.forecast.eventsTitle}</h2>
          <div className="flex gap-3 text-sm">
            <button
              className="text-brand-ink font-medium"
              onClick={() => setSelected(new Set((events ?? []).map((e) => e.id)))}
            >
              {t.forecast.selectAll}
            </button>
            <button className="text-fg-muted font-medium" onClick={() => setSelected(new Set())}>
              {t.forecast.selectNone}
            </button>
          </div>
        </div>
        <p className="text-xs text-fg-subtle">{t.forecast.eventsHint}</p>
        <ul className="divide-y divide-line">
          {events?.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-brand shrink-0"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="font-medium block truncate">{e.name}</span>
                  <span className="text-xs text-fg-subtle">
                    {e.org_count
                      ? `${t.events.orgCountShort(e.org_count)} · ${t.events.daysShort(e.days_effective)}`
                      : t.forecast.noOrgCount}
                    {e.starts_at ? ` · ${fmtDate(e.starts_at)}` : ''}
                  </span>
                </span>
                {!e.org_count && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              </label>
            </li>
          ))}
        </ul>
        <button className="btn-primary w-full" disabled={!canCalculate || isFetching} onClick={calculate}>
          {isFetching ? t.forecast.calculating : t.forecast.calculate}
        </button>
        {selected.size === 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{t.forecast.needEvents}</p>}
        {!(orgNum > 0) && <p className="text-xs text-amber-700 dark:text-amber-300">{t.forecast.needOrgCount}</p>}
      </div>

      {error && <ErrorMsg error={error} />}
      {isFetching && <Spinner />}

      {report && !isFetching && (
        <ForecastResult report={report} basis={basis} level={level} onLevel={setLevel} />
      )}

      <StatsCard eventIds={Array.from(selected)} category={category || undefined} />
    </div>
  );
}

function BasisButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2.5 text-sm font-semibold border transition ${
        active
          ? 'bg-brand text-brand-fg border-brand'
          : 'bg-surface text-fg-muted border-line hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );
}

function ForecastResult({
  report,
  basis,
  level,
  onLevel,
}: {
  report: ForecastReport;
  basis: ForecastBasis;
  level: 'group' | 'item';
  onLevel: (l: 'group' | 'item') => void;
}) {
  const skipped = report.basis.events_skipped;
  const ungrouped = report.items.filter((i) => i.group_id === null);

  return (
    <div className="space-y-3">
      {skipped.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm">
          {t.forecast.skippedNotice(skipped.map((s) => s.name).join(', '))}
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="font-semibold text-sm text-fg-muted">{t.forecast.resultTitle}</h2>
          <div className="flex gap-2 text-xs">
            <ScopeButton active={level === 'group'} label={t.forecast.levelGroup} onClick={() => onLevel('group')} />
            <ScopeButton active={level === 'item'} label={t.forecast.levelItem} onClick={() => onLevel('item')} />
          </div>
        </div>
        <p className="text-xs text-fg-subtle mb-1">{t.forecast.levelHint}</p>
        {/* Sponsoriselite näkyy vain kun sponsoridataa on — muuten se olisi turhaa kohinaa. */}
        {(report.items.some((i) => i.sponsored_events > 0) ||
          report.groups.some((g) => g.sponsored_events > 0)) && (
          <p className="text-xs text-fg-subtle mb-3">{t.forecast.sponsoredHint}</p>
        )}

        {report.items.length === 0 ? (
          <div className="text-fg-subtle text-sm">{t.forecast.noData}</div>
        ) : level === 'item' ? (
          <div className="space-y-4">
            {report.items.map((it) => (
              <ForecastRow key={it.item_id} item={it} basis={basis} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {report.groups.length === 0 && (
              <div className="text-sm text-amber-700 dark:text-amber-300">
                {t.forecast.noGroups}{' '}
                <Link to="/tuoteryhmat" className="underline font-medium">
                  {t.forecast.manageGroups}
                </Link>
              </div>
            )}
            {report.groups.map((g) => (
              <GroupRow
                key={g.group_id}
                group={g}
                basis={basis}
                members={report.items.filter((i) => i.group_id === g.group_id)}
              />
            ))}
            {ungrouped.length > 0 && (
              <div className="pt-2 border-t border-line">
                <div className="text-sm font-semibold text-fg-muted">{t.forecast.ungrouped}</div>
                <p className="text-xs text-fg-subtle mb-3">{t.forecast.ungroupedHint}</p>
                <div className="space-y-4">
                  {ungrouped.map((it) => (
                    <ForecastRow key={it.item_id} item={it} basis={basis} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Ryhmärivi: sama rakenne kuin tuoterivillä, mutta määrät ryhmän perusyksikössä
// ja jäsentuotteet avattavissa alle.
function GroupRow({
  group,
  basis,
  members,
}: {
  group: ForecastGroup;
  basis: ForecastBasis;
  members: ForecastItem[];
}) {
  const [open, setOpen] = useState(false);
  const estimate = basis === 'per_org' ? group.estimate_per_org : group.estimate_per_org_day;
  const toBuy = basis === 'per_org' ? group.to_buy_per_org : group.to_buy_per_org_day;
  const rate = basis === 'per_org' ? group.per_org : group.per_org_day;
  const per = basis === 'per_org' ? t.forecast.perOrgLabel : t.forecast.perOrgDayLabel;
  const u = group.base_unit;

  return (
    <div className="border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{group.name}</div>
          <div className="text-xs text-fg-subtle">
            {t.forecast.groupMembers(members.length)} · {fmtNum(rate)} {u} {per}
          </div>
        </div>
        <div className="text-right shrink-0">
          {toBuy > 0 ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{t.forecast.toBuy}</div>
              <div className="font-bold text-brand-ink nums">
                {fmtNum(toBuy)} {u}
              </div>
            </>
          ) : (
            <div className="chip bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{t.forecast.enough}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
        <Stat label={t.forecast.estimate} value={`${fmtNum(estimate)} ${u}`} />
        <Stat label={t.forecast.stockNow} value={`${fmtNum(group.stock_now)} ${u}`} />
      </div>

      <div className="mt-1.5 text-xs text-fg-subtle">
        {t.forecast.confidence(group.events_used, group.events_total)}
        {group.sponsored_events > 0 &&
          ` · ${t.forecast.sponsoredLine(`${fmtNum(group.sponsored_estimate)} ${u}`, group.sponsored_events)}`}
      </div>

      {group.incompatible_items.length > 0 && (
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {t.forecast.incompatible(group.incompatible_items.map((i) => i.name).join(', '))}
        </div>
      )}

      <button
        className="mt-1.5 text-xs text-brand-ink font-medium inline-flex items-center gap-1"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {open ? t.forecast.hideHistory : t.forecast.showHistory}
      </button>
      {open && (
        <div className="mt-2 space-y-4 pl-3 border-l-2 border-line">
          {members.map((m) => (
            <ForecastRow key={m.item_id} item={m} basis={basis} />
          ))}
        </div>
      )}
    </div>
  );
}

function ForecastRow({ item, basis }: { item: ForecastItem; basis: ForecastBasis }) {
  const [open, setOpen] = useState(false);
  const estimate = basis === 'per_org' ? item.estimate_per_org : item.estimate_per_org_day;
  const toBuy = basis === 'per_org' ? item.to_buy_per_org : item.to_buy_per_org_day;
  const rate = basis === 'per_org' ? item.per_org : item.per_org_day;
  // Yksikkösuffiksi seuraa valittua laskentatapaa, jotta luvut eivät sekoitu keskenään.
  const per = basis === 'per_org' ? t.forecast.perOrgLabel : t.forecast.perOrgDayLabel;
  const rateMin = basis === 'per_org' ? item.per_org_min : item.per_org_day_min;
  const rateMax = basis === 'per_org' ? item.per_org_max : item.per_org_day_max;

  // Epävarmuuden merkit: yksi pohjatapahtuma, tai iso hajonta tapahtumien välillä.
  const single = item.events_used < 2;
  const wideSpread = !single && rateMin > 0 && rateMax > rateMin * 2;

  return (
    <div className="border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">
            {item.name}
            {item.archived && (
              <span className="chip bg-surface-2 text-fg-muted ml-2">{t.forecast.archivedTag}</span>
            )}
          </div>
          <div className="text-xs text-fg-subtle">
            {t.categories[item.category] ?? item.category} · {fmtNum(rate)} {item.unit} {per}
          </div>
        </div>
        <div className="text-right shrink-0">
          {toBuy > 0 ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{t.forecast.toBuy}</div>
              <div className="font-bold text-brand-ink nums">
                {fmtQty(toBuy, item.unit, item.pack_size, item.pack_unit)}
              </div>
            </>
          ) : (
            <div className="chip bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{t.forecast.enough}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
        <Stat label={t.forecast.estimate} value={fmtQty(estimate, item.unit, item.pack_size, item.pack_unit)} />
        <Stat
          label={t.forecast.stockNow}
          value={fmtQty(item.stock_now, item.unit, item.pack_size, item.pack_unit)}
        />
      </div>

      <div className="mt-1.5 text-xs text-fg-subtle">
        {t.forecast.confidence(item.events_used, item.events_total)}
        {item.events_used > 1 &&
          ` · ${t.forecast.spread(fmtNum(rateMin), fmtNum(rateMax), item.unit, per)}`}
        {item.sponsored_events > 0 &&
          ` · ${t.forecast.sponsoredLine(
            fmtQty(item.sponsored_estimate, item.unit, item.pack_size, item.pack_unit),
            item.sponsored_events
          )}`}
      </div>
      {(single || wideSpread) && (
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {single ? t.forecast.lowConfidence : t.forecast.highSpread}
        </div>
      )}

      <button
        className="mt-1.5 text-xs text-brand-ink font-medium inline-flex items-center gap-1"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {open ? t.forecast.hideHistory : t.forecast.showHistory}
      </button>
      {open && (
        <ul className="mt-1.5 divide-y divide-line text-xs">
          {item.history.map((h) => (
            <li key={h.event_id} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0">
                <span className="font-medium text-fg-muted block truncate">{h.event_name}</span>
                <span className="text-fg-subtle">{t.forecast.historyRow(h.org_count, h.days)}</span>
              </span>
              <span className="text-right shrink-0 nums">
                <span className="font-medium text-fg block">
                  {fmtQty(h.consumed, item.unit, item.pack_size, item.pack_unit)}
                </span>
                <span className="text-fg-subtle">
                  {fmtNum(basis === 'per_org' ? h.per_org : h.per_org_day)} {item.unit} {per}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Vapaa tilastonäkymä: kokonaiskulutus valituista tapahtumista (tai koko historiasta)
// + kertymä tapahtuma kerrallaan. Sama data, josta ennuste lasketaan.
function StatsCard({ eventIds, category }: { eventIds: number[]; category?: Category }) {
  const [scope, setScope] = useState<'selected' | 'all'>('selected');
  const [openItem, setOpenItem] = useState<number | null>(null);

  const useSelected = scope === 'selected' && eventIds.length > 0;
  const qs = new URLSearchParams();
  if (useSelected) qs.set('event_ids', [...eventIds].sort((a, b) => a - b).join(','));
  if (category) qs.set('category', category);
  const path = `/reports/totals${qs.toString() ? `?${qs}` : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['totals', path],
    queryFn: () => api.get<TotalsReport>(path),
  });

  const byItem = useMemo(() => {
    const map = new Map<number, TotalsReport['by_event']>();
    for (const row of data?.by_event ?? []) {
      if (!map.has(row.item_id)) map.set(row.item_id, []);
      map.get(row.item_id)!.push(row);
    }
    return map;
  }, [data]);

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm text-fg-muted">{t.forecast.statsTitle}</h2>
        <div className="flex gap-2 text-xs">
          <ScopeButton
            active={scope === 'selected'}
            label={t.forecast.statsSelected}
            onClick={() => setScope('selected')}
          />
          <ScopeButton
            active={scope === 'all'}
            label={t.forecast.statsAllTime}
            onClick={() => setScope('all')}
          />
        </div>
      </div>
      <p className="text-xs text-fg-subtle">{t.forecast.statsHint}</p>

      {isLoading && <Spinner />}
      {data && data.items.length === 0 && (
        <div className="text-fg-subtle text-sm">{t.forecast.statsEmpty}</div>
      )}

      <ul className="divide-y divide-line">
        {data?.items.map((it) => {
          const rows = byItem.get(it.item_id) ?? [];
          const open = openItem === it.item_id;
          let running = 0;
          return (
            <li key={it.item_id} className="py-2">
              <button
                className="w-full min-h-touch flex items-center justify-between gap-3 text-left"
                onClick={() => setOpenItem(open ? null : it.item_id)}
              >
                <span className="flex items-center gap-1 min-w-0">
                  {open ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-fg-subtle" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-fg-subtle" />
                  )}
                  <span className="font-medium truncate">{it.name}</span>
                </span>
                <span className="font-semibold text-fg shrink-0 nums">
                  {fmtQty(it.total_unit, it.unit, it.pack_size, it.pack_unit)}
                </span>
              </button>
              {open && (
                <ul className="mt-1 ml-5 divide-y divide-line text-xs">
                  {rows.map((r) => {
                    running += Number(r.maara_unit);
                    return (
                      <li key={`${r.event_id}`} className="flex justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate text-fg-muted">
                          {r.event_name ?? t.forecast.noEvent}
                        </span>
                        <span className="shrink-0 text-right nums">
                          <span className="font-medium text-fg">
                            {fmtQty(Number(r.maara_unit), it.unit, it.pack_size, it.pack_unit)}
                          </span>
                          <span className="text-fg-subtle block">
                            {t.forecast.cumulative}: {fmtQty(running, it.unit, it.pack_size, it.pack_unit)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 font-medium border ${
        active ? 'bg-brand text-brand-fg border-brand' : 'bg-surface text-fg-muted border-line'
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-fg-subtle">{label}: </span>
      <span className="font-medium text-fg nums">{value}</span>
    </div>
  );
}
