import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, EventRow, EventReport, ConsumptionRow } from '../api';
import { Download } from 'lucide-react';
import { Spinner, ErrorMsg } from '../components/ui';
import { fmtQty, fmtNum, fmtDate } from '../lib/format';
import { t } from '../i18n';

export function ReportsPage() {
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState<number | null>(null);

  const { data: events } = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => api.get<EventRow[]>('/events'),
  });

  // Alusta query-parametrista tai aktiivisesta tapahtumasta.
  useEffect(() => {
    const e = params.get('event');
    if (e) {
      setEventId(parseInt(e, 10));
      return;
    }
    if (events && eventId === null) {
      const active = events.find((x) => x.active) ?? events[0];
      if (active) setEventId(active.id);
    }
  }, [params, events]);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', eventId],
    queryFn: () => api.get<EventReport>(`/events/${eventId}/report?group_by=day`),
    enabled: eventId !== null,
  });

  function exportCsv() {
    if (!report) return;
    const rows: string[][] = [];
    const c = t.reports.csv;
    rows.push([c.item, c.category, c.added, c.consumed, c.outNow, c.stock, c.unit, c.weight]);
    for (const it of report.items) {
      const secondary = it.pack_size ? `${fmtNum(it.consumed * it.pack_size)} ${it.pack_unit ?? ''}` : '';
      rows.push([
        it.name,
        t.categories[it.category] ?? it.category,
        fmtNum(it.added),
        fmtNum(it.consumed),
        fmtNum(it.out_now),
        fmtNum(it.stock_now),
        it.unit,
        secondary,
      ]);
    }
    if (report.by_day?.length) {
      rows.push([]);
      rows.push([c.day, c.item, c.consumption, c.unit, c.weightPlain]);
      for (const d of report.by_day) {
        rows.push([
          d.pvm,
          d.name,
          fmtNum(d.maara_unit),
          d.unit,
          d.maara_sekundaari != null ? `${fmtNum(d.maara_sekundaari)} ${d.pack_unit ?? ''}` : '',
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.reports.fileName}_${report.event.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t.reports.title}</h1>

      <div className="card p-4">
        <label className="label">{t.reports.event}</label>
        <select
          className="input"
          value={eventId ?? ''}
          onChange={(e) => setEventId(e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">{t.reports.chooseEvent}</option>
          {events?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.active ? t.reports.activeSuffix : ''}
            </option>
          ))}
        </select>
      </div>

      {eventId === null && <div className="text-slate-400 text-center py-8">{t.reports.choosePrompt}</div>}
      {isLoading && <Spinner />}
      {error && <ErrorMsg error={error} />}

      {report && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">{report.event.name}</h2>
            <button className="btn-secondary inline-flex items-center gap-1.5 py-2 px-3 text-sm" onClick={exportCsv}>
              <Download className="w-4 h-4" />
              {t.reports.exportCsv}
            </button>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-3 text-sm text-slate-500">{t.reports.perItem}</h3>
            {report.items.length === 0 && <div className="text-slate-400 text-sm">{t.reports.noMovements}</div>}
            <div className="space-y-3">
              {report.items.map((it) => (
                <div key={it.item_id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="font-medium">{it.name}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-1 text-sm">
                    <Stat label={t.reports.added} value={fmtQty(it.added, it.unit, it.pack_size, it.pack_unit)} />
                    <Stat label={t.reports.consumed} value={fmtQty(it.consumed, it.unit, it.pack_size, it.pack_unit)} />
                    <Stat label={t.reports.outNow} value={fmtQty(it.out_now, it.unit, it.pack_size, it.pack_unit)} />
                    <Stat label={t.reports.stockNow} value={fmtQty(it.stock_now, it.unit, it.pack_size, it.pack_unit)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {report.by_day && report.by_day.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold mb-3 text-sm text-slate-500">{t.reports.perDay}</h3>
              <div className="space-y-4">
                {groupByDay(report.by_day).map(([pvm, rows]) => (
                  <div key={pvm}>
                    <div className="text-sm font-semibold text-slate-700 mb-1">{fmtDate(pvm)}</div>
                    <ul className="divide-y divide-slate-100">
                      {rows.map((d) => (
                        <li key={d.item_id} className="flex justify-between py-1.5 text-sm">
                          <span>{d.name}</span>
                          <span className="font-medium">
                            {fmtQty(d.maara_unit, d.unit, d.pack_size, d.pack_unit)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function groupByDay(rows: ConsumptionRow[]): [string, ConsumptionRow[]][] {
  const map = new Map<string, ConsumptionRow[]>();
  for (const r of rows ?? []) {
    const key = typeof r.pvm === 'string' ? r.pvm.slice(0, 10) : String(r.pvm);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries());
}
