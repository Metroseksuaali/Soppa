// Kevyt API-kääre. Kaikki pyynnöt cookie-autentikoituja (credentials: include).

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Virhe (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// Tuotekuvan osoite. v = photo_updated_at toimii välimuistiavaimena: kun kuva
// vaihtuu, URL muuttuu ja selain hakee uuden version (backend sallii pitkän cachen).
export function photoUrl(itemId: number, v?: string | null, size: 'full' | 'thumb' = 'full'): string {
  const path = size === 'thumb' ? `/api/items/${itemId}/photo/thumb` : `/api/items/${itemId}/photo`;
  return v ? `${path}?v=${encodeURIComponent(v)}` : path;
}

// --- Tyypit ---

export type Category = 'ruoka' | 'tavara' | 'kaluste';
export type MovementType = 'lisays' | 'vienti' | 'palautus' | 'kulutus' | 'inventointi';

export interface User {
  id: number;
  username: string;
  display_name: string;
  is_admin: boolean;
  active?: boolean;
  created_at?: string;
}

export interface Item {
  id: number;
  name: string;
  category: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  returnable: boolean;
  archived: boolean;
  note: string | null;
  created_at: string;
  stock: number;
  has_photo: boolean;
  photo_updated_at: string | null;
  group_id: number | null;
  group_name: string | null;
  group_base_unit: GroupUnit | null;
  /** Kerroin tuotteen yksiköstä ryhmän perusyksikköön; null = ei yhteismitallinen. */
  group_factor: number | null;
}

/** Ryhmän perusyksikkö — vapaa teksti kuten tuotteen yksikkö ('kg', 'l', 'pkt'…). */
export type GroupUnit = string;

export interface ItemGroup {
  id: number;
  name: string;
  base_unit: GroupUnit;
  active: boolean;
  created_at: string;
  item_count: number;
  incompatible_count: number;
}

export interface GroupMember {
  id: number;
  name: string;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  archived: boolean;
  factor: number | null;
}

export interface LocationDist {
  location_id: number;
  location_name: string;
  qty: number;
}

export interface Movement {
  id: number;
  item_id: number;
  item_name: string;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  type: MovementType;
  quantity: number;
  counted: number | null;
  location_id: number | null;
  location_name: string | null;
  event_id: number | null;
  event_name: string | null;
  user_id: number;
  user_name: string;
  note: string | null;
  voided: boolean;
  voids_id: number | null;
  /** Lisäys saatiin sponsorilta (maksuton). Muissa tyypeissä aina false. */
  sponsored: boolean;
  created_at: string;
}

export interface Barcode {
  code: string;
  created_at: string;
}

export interface ItemDetail extends Item {
  locations: LocationDist[];
  history: Movement[];
  barcodes: Barcode[];
}

/** Viivakoodi → tuote. null = koodia ei ole liitetty mihinkään tuotteeseen. */
export async function lookupBarcode(code: string): Promise<Item | null> {
  try {
    return await api.get<Item>(`/items/lookup?code=${encodeURIComponent(code)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export interface Location {
  id: number;
  name: string;
  kind: 'varasto' | 'sijainti';
  active: boolean;
  created_at: string;
  items_out?: number;
}

// Rivi sijaintinäkymässä: joko ulkona oleva palautuva tuote tai täällä kulutettu tuote.
export interface LocationItemRow {
  item_id: number;
  name: string;
  category: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  qty: number;
  qty_secondary: number | null;
  has_photo?: boolean;
  photo_updated_at?: string | null;
}

export interface LocationDetail {
  location: Location;
  out: LocationItemRow[];
  consumed: LocationItemRow[];
  consumed_event: { id: number; name: string } | null;
}

export interface EventRow {
  id: number;
  name: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  /** Orgien määrä — ennusteen skaalauskerroin. null = ei kirjattu. */
  org_count: number | null;
  /** Käsin syötetty kesto päivinä (null = päätellään päivämääristä/kirjauksista). */
  days_manual: number | null;
  /** Efektiivinen kesto: käsin syötetty > päivämääräväli > kirjauspäivien määrä > 1. */
  days_effective: number;
}

export interface StockRow {
  item_id: number;
  name: string;
  category: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  returnable: boolean;
  stock: number;
  stock_secondary: number | null;
}

export interface ConsumptionRow {
  pvm: string;
  item_id: number;
  name: string;
  category?: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  maara_unit: number;
  maara_sekundaari: number | null;
}

// --- Historiatuonti ---

export interface ImportRowInput {
  item_id: number;
  date: string; // VVVV-KK-PP
  quantity: number;
  type: 'kulutus' | 'lisays';
  note?: string | null;
}

export interface ImportResult {
  batch: string;
  /** Kaikki luodut kirjaukset (tuodut rivit + tasaavat lisäykset). */
  inserted: number;
  /** Tuodut rivit sellaisenaan. */
  rows: number;
  /** Automaattisesti luodut tasaavat lisäysrivit. */
  balancing: number;
  event: { id: number; name: string };
  items: number;
}

export interface ImportBatch {
  batch: string;
  event_id: number | null;
  event_name: string | null;
  rows_total: number;
  rows_voided: number;
  first_date: string;
  last_date: string;
}

// --- Ennuste ---

export type ForecastBasis = 'per_org' | 'per_org_day';

export interface ForecastHistoryRow {
  event_id: number;
  event_name: string;
  starts_at: string | null;
  org_count: number;
  days: number;
  consumed: number;
  sponsored: number;
  per_org: number;
  per_org_day: number;
}

/** Sponsoriosuus: skaalattu orgeihin kuten tarvekin. */
export interface SponsorFields {
  sponsored_events: number;
  total_sponsored: number;
  sponsored_per_org: number;
  sponsored_estimate: number;
}

export interface ForecastGroup extends SponsorFields {
  group_id: number;
  name: string;
  base_unit: GroupUnit;
  events_used: number;
  events_total: number;
  per_org_min: number;
  per_org_max: number;
  per_org_day_min: number;
  per_org_day_max: number;
  total_consumed: number;
  per_org: number;
  per_org_day: number;
  estimate_per_org: number;
  estimate_per_org_day: number;
  stock_now: number;
  to_buy_per_org: number;
  to_buy_per_org_day: number;
  incompatible_items: { item_id: number; name: string; unit: string }[];
  history: ForecastHistoryRow[];
}

export interface ForecastItem extends SponsorFields {
  item_id: number;
  name: string;
  category: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  archived: boolean;
  group_id: number | null;
  group_name: string | null;
  group_base_unit: GroupUnit | null;
  group_factor: number | null;
  events_used: number;
  events_total: number;
  per_org_min: number;
  per_org_max: number;
  per_org_day_min: number;
  per_org_day_max: number;
  total_consumed: number;
  per_org: number;
  per_org_day: number;
  estimate_per_org: number;
  estimate_per_org_day: number;
  stock_now: number;
  to_buy_per_org: number;
  to_buy_per_org_day: number;
  history: ForecastHistoryRow[];
}

export interface ForecastReport {
  basis: {
    org_count: number;
    days: number;
    events_used: { event_id: number; name: string; starts_at: string | null; org_count: number; days: number }[];
    events_skipped: { event_id: number; name: string }[];
  };
  items: ForecastItem[];
  groups: ForecastGroup[];
}

// --- Vapaa kulutustilasto ---

export interface TotalsItem {
  item_id: number;
  name: string;
  category: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: string | null;
  total_unit: number;
  total_secondary: number | null;
  events_used: number;
}

export interface TotalsByEvent {
  item_id: number;
  event_id: number | null;
  event_name: string | null;
  event_at: string | null;
  maara_unit: number;
  maara_sekundaari: number | null;
}

export interface TotalsReport {
  items: TotalsItem[];
  by_event: TotalsByEvent[];
}

export interface EventReport {
  event: EventRow;
  items: {
    item_id: number;
    name: string;
    category: Category;
    unit: string;
    pack_size: number | null;
    pack_unit: string | null;
    added: number;
    added_sponsored: number;
    consumed: number;
    out_now: number;
    stock_now: number;
  }[];
  by_day?: ConsumptionRow[];
}
