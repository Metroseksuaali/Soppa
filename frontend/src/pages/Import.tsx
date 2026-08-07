import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, EventRow, Item, ImportBatch, ImportResult } from '../api';
import { Spinner, ErrorMsg } from '../components/ui';
import { parseImportText, ParsedRow } from '../lib/importParse';
import { fmtNum, fmtDate } from '../lib/format';
import { t } from '../i18n';

export function ImportPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [balance, setBalance] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: events } = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => api.get<EventRow[]>('/events'),
  });
  // Arkistoidutkin tuotteet mukaan: historiassa voi olla tuotteita joita ei enää käytetä.
  const { data: items } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => api.get<Item[]>('/items?archived=all'),
  });
  const { data: batches } = useQuery({
    queryKey: ['imports'],
    queryFn: () => api.get<ImportBatch[]>('/movements/imports'),
  });

  const event = events?.find((e) => e.id === eventId) ?? null;

  // Vuosi puuttuvalle vuosiluvulle ("4.8."): tapahtuman alkupäivä, muuten kuluva vuosi.
  const fallbackYear = event?.starts_at
    ? new Date(event.starts_at).getFullYear()
    : new Date().getFullYear();

  const parsed = useMemo(
    () => (items ? parseImportText(text, items, fallbackYear) : []),
    [text, items, fallbackYear]
  );
  const okRows = parsed.filter((r) => !r.error);
  const badRows = parsed.filter((r) => r.error);

  const importMut = useMutation({
    mutationFn: () =>
      api.post<ImportResult>('/movements/import', {
        event_id: eventId,
        balance_with_additions: balance,
        rows: okRows.map((r) => ({
          item_id: r.item!.id,
          date: r.date!,
          quantity: r.quantity!,
          type: r.type,
          sponsored: r.sponsored,
        })),
      }),
    onSuccess: (res) => {
      setResult(res);
      setText('');
      qc.invalidateQueries();
    },
  });

  const undoMut = useMutation({
    mutationFn: (batch: string) => api.post<{ voided: number }>(`/movements/imports/${batch}/undo`),
    onSuccess: () => {
      setResult(null);
      qc.invalidateQueries();
    },
  });

  return (
    <div className="space-y-4 md:max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-1 text-brand-ink text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        {t.common.backHome}
      </Link>
      <h1 className="text-xl font-bold">{t.importPage.title}</h1>
      <p className="text-sm text-fg-muted">{t.importPage.intro}</p>

      {/* 1. Tapahtuma */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-sm text-fg-muted">{t.importPage.eventTitle}</h2>
        <select
          className="input"
          value={eventId ?? ''}
          onChange={(e) => setEventId(e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">{t.importPage.chooseEvent}</option>
          {events?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.active ? t.reports.activeSuffix : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-fg-subtle">{t.importPage.eventHint}</p>
      </div>

      {/* 2. Rivit */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-sm text-fg-muted">{t.importPage.dataTitle}</h2>
        <p className="text-xs text-fg-subtle">{t.importPage.formatHint}</p>
        <pre className="text-xs bg-surface-2 text-fg-muted rounded-lg p-3 overflow-x-auto whitespace-pre">
          {t.importPage.example}
        </pre>
        <textarea
          className="input font-mono"
          rows={8}
          placeholder={t.importPage.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="w-5 h-5 accent-brand mt-0.5 shrink-0"
            checked={balance}
            onChange={(e) => setBalance(e.target.checked)}
          />
          <span>
            <span className="font-medium">{t.importPage.balanceLabel}</span>
            <span className="block text-xs text-fg-subtle">{t.importPage.balanceHint}</span>
          </span>
        </label>
      </div>

      {/* 3. Esikatselu */}
      {parsed.length > 0 && (
        <div className="card p-4 space-y-2">
          <h2 className="font-semibold text-sm text-fg-muted">{t.importPage.previewTitle}</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="chip bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 nums">
              {t.importPage.okRows(okRows.length)}
            </span>
            {badRows.length > 0 && (
              <span className="chip bg-amber-500/10 text-amber-700 dark:text-amber-300 nums">
                {t.importPage.errorRows(badRows.length)}
              </span>
            )}
          </div>

          {badRows.length > 0 && (
            <>
              <p className="text-xs text-amber-700 dark:text-amber-300">{t.importPage.missingItemsHint}</p>
              <ul className="text-xs space-y-1">
                {badRows.slice(0, 30).map((r) => (
                  <li key={r.line} className="flex gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium">{t.importPage.lineLabel(r.line)}</span>
                      {r.itemName ? ` · ${r.itemName}` : ''} — {r.error}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {okRows.length > 0 && <PreviewTable rows={okRows} />}

          <button
            className="btn-primary w-full"
            disabled={eventId === null || okRows.length === 0 || importMut.isPending}
            onClick={() => importMut.mutate()}
          >
            {importMut.isPending ? t.importPage.importing : t.importPage.doImport(okRows.length)}
          </button>
          {eventId === null && (
            <p className="text-xs text-amber-700 dark:text-amber-300">{t.importPage.chooseEvent}</p>
          )}
        </div>
      )}

      {importMut.error && <ErrorMsg error={importMut.error} />}

      {result && (
        <div className="card p-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{t.importPage.doneTitle}</div>
              <div className="text-sm text-fg-muted nums">
                {t.importPage.doneBody(result.rows, result.event.name)}
                {result.balancing > 0 && (
                  <span className="block">{t.importPage.doneBalancing(result.balancing)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/raportit?event=${result.event.id}`} className="btn-secondary py-2 text-sm flex-1 text-center">
              {t.importPage.toReport}
            </Link>
            <button
              className="btn-danger py-2 text-sm flex-1"
              onClick={() => {
                if (confirm(t.importPage.undoConfirm)) undoMut.mutate(result.batch);
              }}
            >
              {t.importPage.undo}
            </button>
          </div>
        </div>
      )}

      {/* Aiemmat tuonnit */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-sm text-fg-muted">{t.importPage.batchesTitle}</h2>
        {!batches && <Spinner />}
        {batches?.length === 0 && <div className="text-fg-subtle text-sm">{t.importPage.noBatches}</div>}
        <ul className="divide-y divide-line">
          {batches?.map((b) => {
            const allVoided = b.rows_voided >= b.rows_total;
            return (
              <li key={b.batch} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium block truncate">{b.event_name ?? '—'}</span>
                  <span className="text-xs text-fg-subtle nums">
                    {t.importPage.batchRow(b.rows_total, fmtDate(b.first_date), fmtDate(b.last_date))}
                    {allVoided && ` · ${t.importPage.batchVoided}`}
                  </span>
                </span>
                {!allVoided && (
                  <button
                    className="inline-flex items-center min-h-touch text-sm text-red-600 dark:text-red-400 font-medium shrink-0"
                    onClick={() => {
                      if (confirm(t.importPage.undoConfirm)) undoMut.mutate(b.batch);
                    }}
                  >
                    {t.importPage.undo}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {undoMut.error && <ErrorMsg error={undoMut.error} />}
      </div>
    </div>
  );
}

// Esikatselu: mitä lokiin tallentuu, päivä kerrallaan.
function PreviewTable({ rows }: { rows: ParsedRow[] }) {
  const byDate = useMemo(() => {
    const map = new Map<string, ParsedRow[]>();
    for (const r of rows) {
      const key = r.date!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {byDate.map(([date, dayRows]) => (
        <div key={date}>
          <div className="text-sm font-semibold text-fg mb-1 nums">{fmtDate(date)}</div>
          <ul className="divide-y divide-line text-sm">
            {dayRows.map((r) => (
              <li key={r.line} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  {r.item!.name}
                  {r.type === 'lisays' && (
                    <span className="chip bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ml-2">
                      {t.movementTypes.lisays}
                    </span>
                  )}
                  {r.sponsored && (
                    <span className="chip bg-violet-500/10 text-violet-700 dark:text-violet-300 ml-2">
                      {t.forecast.sponsoredTag}
                    </span>
                  )}
                </span>
                <span className="font-medium text-fg shrink-0 nums">
                  {fmtNum(r.quantity!)} {r.item!.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
