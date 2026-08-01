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
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};

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
  created_at: string;
}

export interface ItemDetail extends Item {
  locations: LocationDist[];
  history: Movement[];
}

export interface Location {
  id: number;
  name: string;
  kind: 'varasto' | 'sijainti';
  active: boolean;
  created_at: string;
}

export interface EventRow {
  id: number;
  name: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
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
    consumed: number;
    out_now: number;
    stock_now: number;
  }[];
  by_day?: ConsumptionRow[];
}
