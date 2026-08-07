import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, lookupBarcode, Item, Location, MovementType } from '../api';
import { Spinner, ErrorMsg } from '../components/ui';
import { ItemThumb } from '../components/ItemPhoto';
import { ScanButton } from '../components/BarcodeScanner';
import { fmtQty, fmtNum, parseNum } from '../lib/format';
import { t } from '../i18n';

type Action = 'lisays' | 'vienti' | 'palautus' | 'kulutus' | 'inventointi';

const ACTIONS: { key: Action; label: string; needsLoc: boolean; returnableOnly: boolean }[] = [
  { key: 'lisays', label: t.home.actions.lisays, needsLoc: false, returnableOnly: false },
  { key: 'vienti', label: t.home.actions.vienti, needsLoc: true, returnableOnly: true },
  { key: 'palautus', label: t.home.actions.palautus, needsLoc: true, returnableOnly: true },
  { key: 'kulutus', label: t.home.actions.kulutus, needsLoc: false, returnableOnly: false },
  { key: 'inventointi', label: t.home.actions.inventointi, needsLoc: false, returnableOnly: false },
];

const LAST_LOC_KEY = 'catering_last_location';

export function LogPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const [itemId, setItemId] = useState<number | null>(null);
  const [action, setAction] = useState<Action>('lisays');
  const [quantity, setQuantity] = useState('');
  const [counted, setCounted] = useState('');
  const [locationId, setLocationId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [sponsored, setSponsored] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scanMsg, setScanMsg] = useState<{ text: string; hint?: string } | null>(null);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', 'all-active'],
    queryFn: () => api.get<Item[]>('/items?archived=false'),
  });
  const { data: locations } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => api.get<Location[]>('/locations?active=true'),
  });

  const selectedItem = useMemo(() => items?.find((i) => i.id === itemId) ?? null, [items, itemId]);

  // Alusta query-parametreista.
  useEffect(() => {
    const a = params.get('action') as Action | null;
    if (a && ACTIONS.some((x) => x.key === a)) setAction(a);
    const it = params.get('item');
    if (it) setItemId(parseInt(it, 10));
  }, [params]);

  // Muista viimeksi käytetty sijainti.
  useEffect(() => {
    const saved = localStorage.getItem(LAST_LOC_KEY);
    if (saved) setLocationId(parseInt(saved, 10));
  }, []);

  // Jos valittu toiminto ei sovi tuotteelle (kuluva + vienti), vaihda lisäykseen.
  useEffect(() => {
    if (selectedItem && !selectedItem.returnable) {
      const cfg = ACTIONS.find((a) => a.key === action);
      if (cfg?.returnableOnly) setAction('lisays');
    }
  }, [selectedItem, action]);

  const actionCfg = ACTIONS.find((a) => a.key === action)!;
  const sijainnit = (locations ?? []).filter((l) => l.kind === 'sijainti');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!itemId) throw new Error(t.log.chooseItemError);
      const q = parseNum(quantity);
      const c = parseNum(counted);
      switch (action) {
        case 'lisays':
          return api.post('/movements/add', {
            item_id: itemId,
            quantity: q,
            note: note || null,
            sponsored,
          });
        case 'vienti':
          return api.post('/movements/deploy', { item_id: itemId, location_id: locationId, quantity: q, note: note || null });
        case 'palautus':
          return api.post('/movements/return', { item_id: itemId, location_id: locationId, quantity: q, note: note || null });
        case 'kulutus':
          return api.post('/movements/consume', {
            item_id: itemId,
            quantity: q,
            location_id: locationId ?? null,
            note: note || null,
          });
        case 'inventointi':
          return api.post('/movements/inventory', { item_id: itemId, counted: c, note: note || null });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['item'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      if (actionCfg.needsLoc && locationId) localStorage.setItem(LAST_LOC_KEY, String(locationId));
      setDone(t.log.done(t.movementTypes[action], selectedItem?.name ?? ''));
      setQuantity('');
      setCounted('');
      setNote('');
      setSponsored(false);
    },
  });

  // Vienti/palautus koskee vain palautuvia tuotteita → suodata tuotelista niihin.
  const filteredItems = (items ?? []).filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      (!actionCfg.returnableOnly || i.returnable)
  );

  // Viivakoodi vain valitsee tuotteen — määrä ja toiminto kysytään kuten ennenkin.
  async function onScan(code: string) {
    setScanMsg(null);
    try {
      const found = await lookupBarcode(code);
      if (!found) {
        setScanMsg({ text: t.barcode.notFound(code), hint: t.barcode.notFoundHint });
        return;
      }
      // Kirjata voi vain aktiivisia tuotteita; arkistoitu ei ole valintalistalla.
      if (!(items ?? []).some((i) => i.id === found.id)) {
        setScanMsg({ text: t.barcode.archivedItem(found.name) });
        return;
      }
      setItemId(found.id);
      setSearch('');
    } catch {
      setScanMsg({ text: t.barcode.lookupFailed });
    }
  }

  const canSubmit =
    !!itemId &&
    (action === 'inventointi' ? counted !== '' : quantity !== '' && parseNum(quantity) > 0) &&
    (!actionCfg.needsLoc || !!locationId);

  if (itemsLoading) return <Spinner />;

  return (
    <div className="space-y-4 md:max-w-xl">
      <h1 className="text-xl font-bold">{t.log.title}</h1>

      {done && (
        <div className="rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-2 text-sm flex justify-between items-center">
          <span>{done}</span>
          <button onClick={() => setDone(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* 1. Tuote */}
      <div className="card p-4">
        <label className="label">{t.log.step1Item}</label>
        {selectedItem ? (
          <div className="flex items-center gap-3">
            <ItemThumb item={selectedItem} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{selectedItem.name}</div>
              <div className="text-sm text-fg-muted nums">
                {t.log.balance(fmtQty(selectedItem.stock, selectedItem.unit, selectedItem.pack_size, selectedItem.pack_unit))}
                {' · '}
                {selectedItem.returnable ? t.common.returnable : t.common.consumable}
              </div>
            </div>
            <button
              className="text-brand-ink text-sm font-medium"
              onClick={() => {
                setItemId(null);
                setScanMsg(null);
              }}
            >
              {t.log.change}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-2">
              <input
                className="input"
                placeholder={t.inventory.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ScanButton onDetect={onScan} />
            </div>

            {scanMsg && (
              <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm mb-2">
                {scanMsg.text}
                {scanMsg.hint && <span className="block text-xs mt-1">{scanMsg.hint}</span>}
              </div>
            )}
            <div className="max-h-56 overflow-y-auto divide-y divide-line">
              {filteredItems.map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    setItemId(i.id);
                    setSearch('');
                  }}
                  className="w-full text-left py-2.5 flex items-center gap-3"
                >
                  <ItemThumb item={i} size="sm" />
                  <span className="font-medium flex-1 min-w-0 truncate">{i.name}</span>
                  <span className="text-sm text-fg-muted nums">{fmtNum(i.stock)} {i.unit}</span>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-fg-subtle text-sm py-3">
                  {actionCfg.returnableOnly && search === '' ? t.log.noReturnable : t.log.noMatches}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedItem && (
        <>
          {/* 2. Toiminto */}
          <div className="card p-4">
            <label className="label">{t.log.step2Action}</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIONS.filter((a) => !a.returnableOnly || selectedItem.returnable).map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAction(a.key)}
                  className={`py-2.5 min-h-touch rounded-lg text-sm font-semibold border ${
                    action === a.key
                      ? 'bg-brand text-brand-fg border-brand'
                      : 'bg-surface text-fg-muted border-line-strong'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Määrä / laskettu */}
          <div className="card p-4 space-y-3">
            {action === 'inventointi' ? (
              <div>
                <label className="label">{t.log.step3Counted(selectedItem.unit)}</label>
                <div className="text-xs text-fg-subtle mb-1 nums">
                  {t.log.currentBalance(`${fmtNum(selectedItem.stock)} ${selectedItem.unit}`)}
                </div>
                <input
                  className="input text-lg"
                  inputMode="decimal"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  onFocus={() => {
                    if (counted === '') setCounted(String(selectedItem.stock));
                  }}
                  placeholder={String(selectedItem.stock)}
                />
              </div>
            ) : (
              <div>
                <label className="label">{t.log.step3Quantity(selectedItem.unit)}</label>
                <input
                  className="input text-lg"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            {(actionCfg.needsLoc || action === 'kulutus') && (
              <div>
                <label className="label">
                  {t.log.location}
                  {action === 'kulutus' ? t.log.locationOptional : ''}
                </label>
                <select
                  className="input"
                  value={locationId ?? ''}
                  onChange={(e) => setLocationId(e.target.value ? parseInt(e.target.value, 10) : null)}
                >
                  <option value="">{action === 'kulutus' ? t.log.noLocationOption : t.log.chooseLocation}</option>
                  {sijainnit.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sponsorius koskee vain saapuvaa tavaraa. */}
            {action === 'lisays' && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 mt-0.5 shrink-0"
                  checked={sponsored}
                  onChange={(e) => setSponsored(e.target.checked)}
                />
                <span>
                  <span className="font-medium">{t.log.sponsored}</span>
                  <span className="block text-xs text-fg-subtle">{t.log.sponsoredHint}</span>
                </span>
              </label>
            )}

            <div>
              <label className="label">{t.itemForm.noteLabel}</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {mutation.error && <ErrorMsg error={mutation.error} />}

            <button className="btn-primary w-full" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? t.common.saving : t.log.confirm(t.movementTypes[action])}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
