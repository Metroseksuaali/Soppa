// Historiatuonnin tekstijäsennin: taulukosta liitetyt rivit -> kirjausriveiksi.
//
// Muoto: tuote <sarkain tai puolipiste> päivä <sarkain tai puolipiste> määrä [<...> tyyppi]
// Pilkkua EI käytetä erottimena, koska se on suomalainen desimaalierotin ("2,5 kg").

import { Item, MovementType } from '../api';
import { parseNum } from './format';

export interface ParsedRow {
  line: number;
  itemName: string;
  item: Item | null;
  date: string | null; // ISO VVVV-KK-PP
  quantity: number | null;
  type: 'kulutus' | 'lisays';
  error: string | null;
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const FI = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/; // 4.8.2026 tai 4.8.

// Päivämäärä ISO-muotoon. Vuosi voi puuttua suomalaisesta muodosta -> fallbackYear.
export function parseDate(s: string, fallbackYear: number): string | null {
  const v = s.trim();
  const iso = ISO.exec(v);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const fi = FI.exec(v);
  if (fi) return toIso(fi[3] ? Number(fi[3]) : fallbackYear, Number(fi[2]), Number(fi[1]));
  return null;
}

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Torjuu esim. 31.2. — Date normalisoi sen maaliskuuksi.
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function parseType(s: string | undefined): 'kulutus' | 'lisays' | null {
  if (!s || !s.trim()) return 'kulutus';
  const v = normalize(s);
  if (v === 'kulutus' || v === 'kulutettu') return 'kulutus';
  if (v === 'lisäys' || v === 'lisays' || v === 'lisätty' || v === 'lisatty') return 'lisays';
  return null;
}

export function parseImportText(text: string, items: Item[], fallbackYear: number): ParsedRow[] {
  const byName = new Map<string, Item>();
  for (const it of items) byName.set(normalize(it.name), it);

  const out: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const cells = raw.split(/[\t;]/).map((c) => c.trim());
    const row: ParsedRow = {
      line: idx + 1,
      itemName: cells[0] ?? '',
      item: null,
      date: null,
      quantity: null,
      type: 'kulutus',
      error: null,
    };

    if (cells.length < 3) {
      row.error = 'Rivillä pitää olla tuote, päivä ja määrä';
      out.push(row);
      return;
    }

    row.item = byName.get(normalize(cells[0])) ?? null;
    row.date = parseDate(cells[1], fallbackYear);
    const qty = parseNum(cells[2]);
    row.quantity = Number.isFinite(qty) ? qty : null;
    const type = parseType(cells[3]);
    if (type) row.type = type;

    // Otsikkorivi (esim. "Tuote  Päivä  Määrä") tunnistuu siitä ettei mikään kenttä jäsenny.
    if (!row.item && !row.date && row.quantity === null && idx === 0) return;

    if (!row.item) row.error = 'Tuotetta ei löydy tällä nimellä';
    else if (!row.date) row.error = 'Päivämäärää ei tunnistettu (esim. 4.8.2026 tai 2026-08-04)';
    else if (row.quantity === null) row.error = 'Määrää ei tunnistettu';
    else if (row.quantity <= 0) row.error = 'Määrän pitää olla positiivinen';
    else if (!type) row.error = 'Tyypin pitää olla kulutus tai lisäys';

    out.push(row);
  });

  return out;
}

export type { MovementType };
