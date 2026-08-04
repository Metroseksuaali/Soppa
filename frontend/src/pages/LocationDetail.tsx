import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, Category, LocationDetail, LocationItemRow } from '../api';
import { Spinner, ErrorMsg, CategoryChip } from '../components/ui';
import { ItemThumb } from '../components/ItemPhoto';
import { ArrowLeft, Check } from 'lucide-react';
import { fmtQty, fmtNum, parseNum } from '../lib/format';
import { t } from '../i18n';

// Kalusteet ensin: ne ovat se osa, joka pitää oikeasti hakea sijainnista takaisin.
const CATEGORY_ORDER: Category[] = ['kaluste', 'tavara', 'ruoka'];

function groupByCategory(rows: LocationItemRow[]): [Category, LocationItemRow[]][] {
  return CATEGORY_ORDER.map((c) => [c, rows.filter((r) => r.category === c)] as [Category, LocationItemRow[]]).filter(
    ([, rows]) => rows.length > 0
  );
}

export function LocationDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();

  // Valinta palautusta varten: item_id -> määrä syötteenä. Avaimen olemassaolo = rastittu.
  const [sel, setSel] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ text: string; failed: boolean } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['location', id],
    queryFn: () => api.get<LocationDetail>(`/locations/${id}`),
  });

  const returnMut = useMutation({
    mutationFn: async () => {
      const picks = Object.entries(sel)
        .map(([itemId, qty]) => ({ item_id: parseInt(itemId, 10), quantity: parseNum(qty) }))
        .filter((p) => p.quantity > 0);
      let ok = 0;
      const errors: string[] = [];
      // Yksi kirjaus per tuote — jokainen jää lokiin omana palautuksenaan.
      for (const p of picks) {
        try {
          await api.post('/movements/return', {
            item_id: p.item_id,
            location_id: Number(id),
            quantity: p.quantity,
          });
          ok++;
        } catch (e) {
          errors.push(e instanceof ApiError ? e.message : t.app.unknownError);
        }
      }
      return { ok, errors };
    },
    onSuccess: ({ ok, errors }) => {
      setSel({});
      const parts: string[] = [];
      if (ok > 0) parts.push(t.locationDetail.returned(ok));
      // Näytä myös ensimmäinen virheteksti — se kertoo yleensä suoraan syyn (esim. "ulkona vain 4").
      if (errors.length > 0) parts.push(t.locationDetail.partialFailed(errors.length, errors[0]));
      setResult(parts.length ? { text: parts.join(' · '), failed: errors.length > 0 } : null);
      qc.invalidateQueries({ queryKey: ['location', id] });
      qc.invalidateQueries({ queryKey: ['locations'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['item'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  if (!data) return null;

  const { location, out, consumed } = data;
  const selCount = Object.keys(sel).length;

  function toggle(row: LocationItemRow) {
    setResult(null);
    setSel((prev) => {
      const next = { ...prev };
      if (row.item_id in next) delete next[row.item_id];
      else next[row.item_id] = fmtNum(row.qty);
      return next;
    });
  }

  function selectAll() {
    setResult(null);
    setSel(Object.fromEntries(out.map((r) => [r.item_id, fmtNum(r.qty)])));
  }

  return (
    <div className="space-y-4 md:max-w-2xl pb-20">
      <Link to="/sijainnit" className="inline-flex items-center gap-1 text-brand text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        {t.locations.title}
      </Link>

      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold">{location.name}</h1>
        {location.kind === 'varasto' && (
          <span className="chip bg-slate-100 text-slate-600">{t.locations.warehouseTag}</span>
        )}
        {!location.active && <span className="chip bg-red-100 text-red-700">{t.locations.hiddenTag}</span>}
      </div>

      {result && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            result.failed ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'
          }`}
        >
          {result.text}
        </div>
      )}
      {returnMut.error && <ErrorMsg error={returnMut.error} />}

      {/* ===== Ulkona nyt + palautuksen rastiruudut ===== */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="font-semibold">{t.locationDetail.outNow}</h2>
          {out.length > 0 && (
            <button
              className="text-sm text-brand font-medium"
              onClick={() => (selCount === out.length ? setSel({}) : selectAll())}
            >
              {selCount === out.length ? t.locationDetail.clearSelection : t.locationDetail.selectAll}
            </button>
          )}
        </div>

        {out.length === 0 ? (
          <div className="text-slate-400 text-sm py-2">{t.locationDetail.outEmpty}</div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">{t.locationDetail.returnHint}</p>
            {groupByCategory(out).map(([category, rows]) => (
              <div key={category} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  {t.categories[category]}
                </div>
                <ul className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const checked = row.item_id in sel;
                    return (
                      <li key={row.item_id} className="py-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-5 w-5 shrink-0"
                            checked={checked}
                            onChange={() => toggle(row)}
                            aria-label={row.name}
                          />
                          <button className="flex items-center gap-3 min-w-0 flex-1 text-left" onClick={() => toggle(row)}>
                            <ItemThumb
                              item={{
                                id: row.item_id,
                                name: row.name,
                                has_photo: !!row.has_photo,
                                photo_updated_at: row.photo_updated_at ?? null,
                              }}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{row.name}</div>
                              <div className="text-xs text-slate-500">
                                {fmtQty(row.qty, row.unit, row.pack_size, row.pack_unit)}
                              </div>
                            </div>
                          </button>
                          {checked && (
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                className="input w-20 px-2 py-1.5 text-sm text-right"
                                inputMode="decimal"
                                value={sel[row.item_id]}
                                onChange={(e) => setSel((prev) => ({ ...prev, [row.item_id]: e.target.value }))}
                              />
                              <span className="text-xs text-slate-500 w-8">{row.unit}</span>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ===== Kulutettu täällä (informatiivinen, ei vaikuta palautukseen) ===== */}
      <div className="card p-4">
        <h2 className="font-semibold">{t.locationDetail.consumedHere}</h2>
        <p className="text-xs text-slate-500 mb-2">
          {data.consumed_event
            ? t.locationDetail.consumedInEvent(data.consumed_event.name)
            : t.locationDetail.consumedAllTime}
        </p>
        {consumed.length === 0 ? (
          <div className="text-slate-400 text-sm">{t.locationDetail.consumedEmpty}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {consumed.map((row) => (
              <li key={row.item_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryChip category={row.category} />
                  <span className="truncate">{row.name}</span>
                </div>
                <span className="font-semibold shrink-0">
                  {fmtQty(row.qty, row.unit, row.pack_size, row.pack_unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== Kelluva palautusnappi (näkyy vasta kun jotain on rastittu) ===== */}
      {selCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 px-3 pt-3 pb-[4.5rem] md:pb-3 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="mx-auto w-full max-w-2xl">
            <button
              className="btn-primary w-full shadow-lg"
              disabled={returnMut.isPending}
              onClick={() => returnMut.mutate()}
            >
              <Check className="w-5 h-5" />
              {returnMut.isPending ? t.locationDetail.returning : t.locationDetail.returnSelected(selCount)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
