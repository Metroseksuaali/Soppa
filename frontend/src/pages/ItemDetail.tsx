import { useState } from 'react';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Barcode, ItemDetail, ItemGroup } from '../api';
import { Spinner, ErrorMsg, Modal, CategoryChip } from '../components/ui';
import { ItemPhoto } from '../components/ItemPhoto';
import { ScanButton } from '../components/BarcodeScanner';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { fmtQty, fmtDateTime, typeSign, fmtNum, parseNum } from '../lib/format';
import { t } from '../i18n';

export function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const location = useLocation();
  // Tuotesivulle tullaan kolmesta paikasta: inventaariolistauksesta, etusivun
  // loppu-listasta ja tuoteryhmän jäsenlistasta. Siksi paluu nojaa selaimen
  // historiaan — se tietää oikean paluukohteen myös uusista tulokohdista, ja
  // palauttaa listauksen tarkan tilan (välilehti + haku) ilman erillistä
  // kirjanpitoa. Varasuunta on inventaario: listauksesta tultaessa osoitteessa
  // ovat suodattimet mukana, ja key === 'default' tarkoittaa ettei tässä
  // istunnossa ole mihin palata (suora linkki tai sivun uudelleenlataus).
  const [listParams] = useSearchParams();
  const backTo = `/inventaario${listParams.toString() ? `?${listParams}` : ''}`;
  const canGoBack = location.key !== 'default';

  // Modifier-klikit (uusi välilehti) jätetään selaimelle — siksi vain paljas
  // vasen klikkaus kaapataan historiapaluuksi.
  function onBackClick(e: React.MouseEvent) {
    if (!canGoBack || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(-1);
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['item', id],
    queryFn: () => api.get<ItemDetail>(`/items/${id}`),
  });

  const archiveMut = useMutation({
    mutationFn: (archived: boolean) =>
      api.post(`/items/${id}/${archived ? 'archive' : 'unarchive'}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item', id] });
      qc.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const voidMut = useMutation({
    mutationFn: (movId: number) => api.post(`/movements/${movId}/void`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item', id] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4 md:max-w-2xl">
      <Link
        to={backTo}
        onClick={onBackClick}
        className="inline-flex items-center gap-1 text-brand-ink text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.common.back}
      </Link>

      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{data.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <CategoryChip category={data.category} />
              {data.returnable ? (
                <span className="chip bg-accent-soft text-accent-ink">{t.common.returnable}</span>
              ) : (
                <span className="chip bg-surface-2 text-fg-muted">{t.common.consumable}</span>
              )}
              {data.archived && (
                <span className="chip bg-red-500/10 text-red-700 dark:text-red-300">{t.item.archived}</span>
              )}
            </div>
          </div>
          <button className="btn-secondary py-2 px-3 text-sm" onClick={() => setShowEdit(true)}>
            {t.common.edit}
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-surface-2 p-4 text-center">
          <div className="text-sm text-fg-muted">{t.common.stock}</div>
          <div
            className={`text-3xl font-bold nums ${
              data.stock <= 0 ? 'text-red-600 dark:text-red-400' : 'text-fg'
            }`}
          >
            {fmtQty(data.stock, data.unit, data.pack_size, data.pack_unit)}
          </div>
        </div>

        {data.note && <p className="mt-3 text-sm text-fg-muted">{data.note}</p>}

        <div className="mt-4 flex gap-2">
          <Link to={`/kirjaa?item=${data.id}`} className="btn-primary flex-1 py-2 text-sm">
            {t.item.logAction}
          </Link>
          {data.archived ? (
            <button className="btn-secondary py-2 text-sm" onClick={() => archiveMut.mutate(false)}>
              {t.item.unarchive}
            </button>
          ) : (
            <button className="btn-secondary py-2 text-sm" onClick={() => archiveMut.mutate(true)}>
              {t.item.archive}
            </button>
          )}
        </div>
      </div>

      <ItemPhoto
        itemId={data.id}
        itemName={data.name}
        hasPhoto={data.has_photo}
        photoUpdatedAt={data.photo_updated_at}
      />

      <BarcodeCard itemId={data.id} barcodes={data.barcodes ?? []} />

      {data.returnable && data.locations.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-2">{t.item.outAtLocations}</h2>
          <ul className="divide-y divide-line">
            {data.locations.map((l) => (
              <li key={l.location_id} className="flex justify-between py-2 text-sm">
                <span>{l.location_name}</span>
                <span className="font-semibold nums">{fmtQty(l.qty, data.unit, data.pack_size, data.pack_unit)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-semibold mb-2">{t.item.history}</h2>
        {data.history.length === 0 && <div className="text-fg-subtle text-sm">{t.item.noHistory}</div>}
        <ul className="divide-y divide-line">
          {data.history.map((m) => (
            <li key={m.id} className={`py-2.5 ${m.voided ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    {t.movementTypes[m.type]}
                    {m.location_name && <span className="text-fg-subtle"> · {m.location_name}</span>}
                    {m.sponsored && (
                      <span className="chip bg-violet-500/10 text-violet-700 dark:text-violet-300 ml-2">
                        {t.forecast.sponsoredTag}
                      </span>
                    )}
                    {m.voided && <span className="text-red-500 dark:text-red-400 ml-1">{t.item.voided}</span>}
                  </div>
                  <div className="text-xs text-fg-subtle nums">
                    {fmtDateTime(m.created_at)} · {m.user_name}
                    {m.event_name && ` · ${m.event_name}`}
                  </div>
                  {m.type === 'inventointi' && m.counted != null && (
                    <div className="text-xs text-fg-muted nums">{t.item.counted(`${fmtNum(m.counted)} ${m.unit}`)}</div>
                  )}
                  {m.note && <div className="text-xs text-fg-muted italic">{m.note}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm nums">
                    {typeSign(m.type)}
                    {fmtNum(Math.abs(m.quantity))} {m.unit}
                  </div>
                  {!m.voided && (
                    <button
                      className="text-xs text-red-500 dark:text-red-400 mt-1"
                      onClick={() => {
                        if (confirm(t.item.voidConfirm)) voidMut.mutate(m.id);
                      }}
                    >
                      {t.item.voidButton}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <EditItemModal open={showEdit} onClose={() => setShowEdit(false)} item={data} />
    </div>
  );
}

// Tuotteen viivakoodit. Koodeja voi olla useampi (eri pakkauskoko, uusi ja vanha EAN),
// ja sama koodi voi kuulua vain yhdelle tuotteelle — backend torjuu päällekkäisyyden 409:llä.
function BarcodeCard({ itemId, barcodes }: { itemId: number; barcodes: Barcode[] }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['item', String(itemId)] });
  }

  const add = useMutation({
    mutationFn: (code: string) => api.post(`/items/${itemId}/barcodes`, { code }),
    onSuccess: (_res, code) => {
      setMsg(t.barcode.added(code.trim().toUpperCase()));
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (code: string) => api.del(`/items/${itemId}/barcodes/${encodeURIComponent(code)}`),
    onSuccess: () => {
      setMsg(null);
      refresh();
    },
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{t.barcode.title}</h2>
        <ScanButton
          onDetect={(code) => {
            setMsg(null);
            add.mutate(code);
          }}
          className="btn-secondary py-2 px-3 text-sm flex items-center"
          label={t.barcode.add}
        />
      </div>

      {barcodes.length === 0 ? (
        <div className="text-sm text-fg-subtle">{t.barcode.none}</div>
      ) : (
        <ul className="divide-y divide-line">
          {barcodes.map((b) => (
            <li key={b.code} className="flex items-center justify-between py-2">
              <span className="font-mono text-sm nums">{b.code}</span>
              <button
                className="inline-flex items-center justify-center h-touch w-touch rounded-lg text-fg-subtle hover:bg-surface-2 transition-colors"
                aria-label={t.barcode.remove}
                title={t.barcode.remove}
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(t.barcode.removeConfirm(b.code))) remove.mutate(b.code);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-fg-subtle mt-2">{t.barcode.hint}</p>
      {msg && <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{msg}</div>}
      {add.error && <div className="mt-2"><ErrorMsg error={add.error} /></div>}
      {remove.error && <div className="mt-2"><ErrorMsg error={remove.error} /></div>}
    </div>
  );
}

function EditItemModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: ItemDetail }) {
  const qc = useQueryClient();
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [packSize, setPackSize] = useState(item.pack_size?.toString() ?? '');
  const [packUnit, setPackUnit] = useState(item.pack_unit ?? '');
  const [returnable, setReturnable] = useState(item.returnable);
  const [note, setNote] = useState(item.note ?? '');
  const [groupId, setGroupId] = useState<number | ''>(item.group_id ?? '');

  const { data: groups } = useQuery({
    queryKey: ['groups', 'active'],
    queryFn: () => api.get<ItemGroup[]>('/groups'),
  });
  const chosenGroup = groups?.find((g) => g.id === groupId) ?? null;
  const packNum = packSize ? parseNum(packSize) : null;
  const groupMismatch =
    chosenGroup !== null &&
    unit.trim() !== chosenGroup.base_unit &&
    !(packUnit.trim() === chosenGroup.base_unit && packNum && packNum > 0);

  const mut = useMutation({
    mutationFn: () =>
      api.patch(`/items/${item.id}`, {
        name: name.trim(),
        unit: unit.trim(),
        pack_size: packSize ? parseNum(packSize) : null,
        pack_unit: packUnit.trim() || null,
        returnable,
        note: note.trim() || null,
        group_id: groupId === '' ? null : groupId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item', String(item.id)] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t.itemForm.editTitle}>
      <div className="space-y-3">
        <div>
          <label className="label">{t.common.name}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t.common.unit}</label>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={returnable}
                onChange={(e) => setReturnable(e.target.checked)}
              />
              {t.common.returnable}
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t.common.packSize}</label>
            <input
              className="input"
              inputMode="decimal"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t.common.packUnit}</label>
            <input className="input" value={packUnit} onChange={(e) => setPackUnit(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t.itemForm.group}</label>
          <select
            className="input"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? parseInt(e.target.value, 10) : '')}
          >
            <option value="">{t.itemForm.noGroup}</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.base_unit})
              </option>
            ))}
          </select>
          {groupMismatch && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {t.itemForm.groupIncompatible(chosenGroup!.base_unit)}
            </p>
          )}
        </div>
        <div>
          <label className="label">{t.common.note}</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {mut.error && <ErrorMsg error={mut.error} />}
        <button className="btn-primary w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? t.common.saving : t.common.save}
        </button>
      </div>
    </Modal>
  );
}
