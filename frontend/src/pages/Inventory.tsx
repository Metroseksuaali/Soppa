import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, lookupBarcode, Item, Category, ItemGroup } from '../api';
import { Spinner, ErrorMsg, Modal, CategoryChip } from '../components/ui';
import { ItemThumb } from '../components/ItemPhoto';
import { ScanButton, SCAN_IN_FIELD } from '../components/BarcodeScanner';
import { fmtQty, parseNum } from '../lib/format';
import { t } from '../i18n';

const TABS: Category[] = ['ruoka', 'tavara', 'kaluste'];

export function InventoryPage() {
  // Välilehti ja haku elävät osoitteessa, ei komponentin tilassa: kun tuotteesta palataan
  // takaisin, listaus avautuu siihen kategoriaan josta lähdettiin (replace = ei roskaa
  // selaimen historiaan välilehteä vaihdettaessa).
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const catParam = params.get('cat') as Category | null;
  const tab: Category = catParam && TABS.includes(catParam) ? catParam : 'ruoka';
  const q = params.get('q') ?? '';
  const [showCreate, setShowCreate] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ text: string; hint?: string } | null>(null);

  function setParam(key: 'cat' | 'q', value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['items', tab, q],
    queryFn: () =>
      api.get<Item[]>(`/items?category=${tab}&archived=false${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });

  // Listalta tuotteeseen mennään nykyinen suodatus mukana, jotta paluulinkki osaa palata siihen.
  const listQuery = params.toString();
  const itemLink = (id: number) => `/inventaario/${id}${listQuery ? `?${listQuery}` : ''}`;

  async function onScan(code: string) {
    setScanMsg(null);
    try {
      const item = await lookupBarcode(code);
      if (item) navigate(itemLink(item.id));
      else setScanMsg({ text: t.barcode.notFound(code), hint: t.barcode.notFoundHint });
    } catch {
      setScanMsg({ text: t.barcode.lookupFailed });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t.inventory.title}</h1>

      {/* Skannaus on hakemisen vaihtoehto, joten se istuu hakukentän sisällä;
          uuden tuotteen luonti on eri asia ja siksi oma nappi vieressä. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="input pr-11"
            placeholder={t.inventory.search}
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
          />
          <ScanButton onDetect={onScan} className={SCAN_IN_FIELD} />
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowCreate(true)}>
          {t.inventory.newItem}
        </button>
      </div>

      {scanMsg && (
        <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm">
          {scanMsg.text}
          {scanMsg.hint && <span className="block text-xs mt-1">{scanMsg.hint}</span>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 bg-surface-2 rounded-xl p-1">
        {TABS.map((cat) => (
          <button
            key={cat}
            onClick={() => setParam('cat', cat)}
            className={`py-2 min-h-touch rounded-lg text-sm font-semibold transition-colors ${
              // Täytetty pilleri, ei sävypinta: sävy hukkuu yhtä lailla sävytettyyn
              // kiskoon, eikä valittu välilehti erottunut riittävästi.
              tab === cat ? 'bg-brand text-brand-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {t.categories[cat]}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorMsg error={error} />}

      {data && data.length === 0 && (
        <div className="text-center text-fg-subtle py-10">{t.inventory.empty}</div>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {data?.map((item) => (
          <li key={item.id}>
            <Link to={itemLink(item.id)} className="card p-4 flex items-center gap-3">
              <ItemThumb item={item} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{item.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <CategoryChip category={item.category} />
                  {item.returnable ? (
                    <span className="chip bg-accent-soft text-accent-ink">{t.common.returnable}</span>
                  ) : (
                    <span className="chip bg-surface-2 text-fg-muted">{t.common.consumable}</span>
                  )}
                </div>
              </div>
              <div className={`text-right font-bold nums ${item.stock <= 0 ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
                {fmtQty(item.stock, item.unit, item.pack_size, item.pack_unit)}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <CreateItemModal open={showCreate} onClose={() => setShowCreate(false)} defaultCategory={tab} />
    </div>
  );
}

function CreateItemModal({
  open,
  onClose,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  defaultCategory: Category;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [unit, setUnit] = useState('kpl');
  const [packSize, setPackSize] = useState('');
  const [packUnit, setPackUnit] = useState('');
  const [returnable, setReturnable] = useState(false);
  const [note, setNote] = useState('');
  const [groupId, setGroupId] = useState<number | ''>('');

  const { data: groups } = useQuery({
    queryKey: ['groups', 'active'],
    queryFn: () => api.get<ItemGroup[]>('/groups'),
  });
  const chosenGroup = groups?.find((g) => g.id === groupId) ?? null;

  // Varoita jos tuotteen määrää ei voi muuntaa ryhmän perusyksikköön.
  const packNum = packSize ? parseNum(packSize) : null;
  const groupMismatch =
    chosenGroup !== null &&
    unit.trim() !== chosenGroup.base_unit &&
    !(packUnit.trim() === chosenGroup.base_unit && packNum && packNum > 0);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Item>('/items', {
        name: name.trim(),
        category,
        unit: unit.trim(),
        pack_size: packSize ? parseNum(packSize) : null,
        pack_unit: packUnit.trim() || null,
        returnable,
        note: note.trim() || null,
        group_id: groupId === '' ? null : groupId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      reset();
      onClose();
    },
  });

  function reset() {
    setName('');
    setUnit('kpl');
    setPackSize('');
    setPackUnit('');
    setReturnable(false);
    setNote('');
    setGroupId('');
  }

  return (
    <Modal open={open} onClose={onClose} title={t.itemForm.createTitle}>
      <div className="space-y-3">
        <div>
          <label className="label">{t.common.name}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t.itemForm.category}</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {TABS.map((cat) => (
              <option key={cat} value={cat}>
                {t.categories[cat]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t.common.unit}</label>
            <input className="input" placeholder={t.itemForm.unitPlaceholder} value={unit} onChange={(e) => setUnit(e.target.value)} />
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
            <label className="label">{t.itemForm.packSizeLabel}</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder={t.itemForm.packSizePlaceholder}
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t.common.packUnit}</label>
            <input className="input" placeholder={t.itemForm.packUnitPlaceholder} value={packUnit} onChange={(e) => setPackUnit(e.target.value)} />
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
          <p className="text-xs text-fg-subtle mt-1">{t.itemForm.groupHint}</p>
          {groupMismatch && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {t.itemForm.groupIncompatible(chosenGroup!.base_unit)}
            </p>
          )}
        </div>
        <div>
          <label className="label">{t.itemForm.noteLabel}</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {mutation.error && <ErrorMsg error={mutation.error} />}

        <button
          className="btn-primary w-full"
          disabled={!name.trim() || !unit.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t.common.saving : t.itemForm.create}
        </button>
      </div>
    </Modal>
  );
}
