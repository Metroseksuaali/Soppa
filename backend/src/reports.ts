import { query } from './db';

const TZ = 'Europe/Helsinki';

// Tapahtuman yhteenveto: per tuote lisätty, kulutettu, ulkona nyt, varastosaldo nyt.
// group_by=day lisää päiväkohtaisen kulutuserittelyn.
export async function buildEventReport(eventId: number, groupByDay: boolean) {
  const eventRes = await query(
    'SELECT id, name, active, starts_at, ends_at, created_at FROM events WHERE id = $1',
    [eventId]
  );
  if (eventRes.rows.length === 0) return null;
  const event = eventRes.rows[0];

  // Per tuote: lisätty (Σ lisays) ja kulutettu (Σ kulutus) tässä tapahtumassa.
  const perItem = await query(
    `SELECT i.id AS item_id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
            COALESCE(SUM(CASE WHEN m.type = 'lisays' THEN m.quantity ELSE 0 END), 0) AS added,
            COALESCE(SUM(CASE WHEN m.type = 'kulutus' THEN m.quantity ELSE 0 END), 0) AS consumed
     FROM items i
     JOIN movements m ON m.item_id = i.id AND m.voided = FALSE AND m.event_id = $1
     GROUP BY i.id
     HAVING COALESCE(SUM(CASE WHEN m.type IN ('lisays','kulutus') THEN 1 ELSE 0 END), 0) > 0
        OR COALESCE(SUM(CASE WHEN m.type = 'lisays' THEN m.quantity ELSE 0 END), 0) <> 0
        OR COALESCE(SUM(CASE WHEN m.type = 'kulutus' THEN m.quantity ELSE 0 END), 0) <> 0
     ORDER BY i.name`,
    [eventId]
  );

  // Ulkona nyt (koko location_stock, ei tapahtumasidonnainen) ja varastosaldo nyt.
  const itemIds = perItem.rows.map((r: any) => r.item_id);
  let outNow: Record<number, number> = {};
  let stockNow: Record<number, number> = {};
  if (itemIds.length > 0) {
    const outRes = await query(
      `SELECT item_id, COALESCE(SUM(qty), 0) AS qty FROM location_stock
       WHERE item_id = ANY($1) GROUP BY item_id`,
      [itemIds]
    );
    for (const r of outRes.rows) outNow[r.item_id] = Number(r.qty);
    const stockRes = await query(`SELECT item_id, qty FROM varasto_stock WHERE item_id = ANY($1)`, [itemIds]);
    for (const r of stockRes.rows) stockNow[r.item_id] = Number(r.qty);
  }

  const items = perItem.rows.map((r: any) => ({
    ...r,
    out_now: outNow[r.item_id] ?? 0,
    stock_now: stockNow[r.item_id] ?? 0,
  }));

  const report: any = { event, items };

  if (groupByDay) {
    const byDay = await query(
      `SELECT date(m.created_at AT TIME ZONE $2) AS pvm,
              i.id AS item_id, i.name, i.unit, i.pack_size, i.pack_unit,
              SUM(m.quantity) AS maara_unit,
              SUM(m.quantity) * i.pack_size AS maara_sekundaari
       FROM movements m JOIN items i ON i.id = m.item_id
       WHERE m.type = 'kulutus' AND m.voided = FALSE AND m.event_id = $1
       GROUP BY pvm, i.id
       ORDER BY pvm, i.name`,
      [eventId, TZ]
    );
    report.by_day = byDay.rows;
  }

  return report;
}

// --- Kulutusennuste ---
//
// Idea: menekki on sidoksissa tapahtuman kokoon. Kun tiedetään paljonko tuotetta on
// kulunut aiemmissa tapahtumissa ja kuinka monta orgia niissä oli, saadaan kerroin
// (kulutus / orgi tai kulutus / orgi / päivä), jolla tulevan tapahtuman tarve arvioidaan.
// Kaikki summat lasketaan liikelokista — mitään ei tallenneta valmiiksi laskettuna.

export interface ForecastInput {
  eventIds: number[];
  orgCount: number;
  days: number;
  category?: string;
}

interface ForecastHistoryRow {
  event_id: number;
  event_name: string;
  /** pg palauttaa timestamptz:n Date-oliona; JSON-vastauksessa se on ISO-merkkijono. */
  starts_at: Date | string | null;
  org_count: number;
  days: number;
  consumed: number;
  per_org: number;
  per_org_day: number;
}

export async function forecastReport(input: ForecastInput) {
  const { eventIds, orgCount, days, category } = input;

  // Pohjatapahtumat. Ilman orgien määrää tapahtumaa ei voi käyttää kertoimen
  // laskentaan — se palautetaan erikseen, jotta käyttöliittymä voi huomauttaa.
  const evRes = await query(
    `SELECT e.id, e.name, e.starts_at, e.ends_at, em.org_count, em.days_effective
     FROM events e
     JOIN event_metrics em ON em.event_id = e.id
     WHERE e.id = ANY($1)
     ORDER BY COALESCE(e.starts_at, e.created_at)`,
    [eventIds]
  );

  const usable = evRes.rows.filter((r: any) => Number(r.org_count) > 0);
  const skipped = evRes.rows
    .filter((r: any) => !(Number(r.org_count) > 0))
    .map((r: any) => ({ event_id: r.id, name: r.name }));

  const basis = {
    org_count: orgCount,
    days,
    events_used: usable.map((r: any) => ({
      event_id: r.id,
      name: r.name,
      starts_at: r.starts_at,
      org_count: Number(r.org_count),
      days: Number(r.days_effective),
    })),
    events_skipped: skipped,
  };

  if (usable.length === 0) return { basis, items: [] };

  const usableIds = usable.map((r: any) => r.id);
  const meta = new Map<number, { name: string; starts_at: string | null; org_count: number; days: number }>();
  for (const r of usable) {
    meta.set(r.id, {
      name: r.name,
      starts_at: r.starts_at,
      org_count: Number(r.org_count),
      days: Number(r.days_effective),
    });
  }

  // Kulutus per tuote per tapahtuma. Vain kulutus-tyyppi: se on ainoa joka kuvaa
  // pysyvää menekkiä (vienti/palautus liikuttavat palautuvia edestakaisin).
  const params: any[] = [usableIds];
  let catCond = '';
  if (category !== undefined) {
    params.push(category);
    catCond = `AND i.category = $${params.length}`;
  }
  const consRes = await query(
    `SELECT m.event_id, m.item_id, SUM(m.quantity) AS consumed
     FROM movements m
     JOIN items i ON i.id = m.item_id
     WHERE m.type = 'kulutus' AND m.voided = FALSE AND m.event_id = ANY($1) ${catCond}
     GROUP BY m.event_id, m.item_id
     HAVING SUM(m.quantity) > 0`,
    params
  );

  const itemIds = Array.from(new Set(consRes.rows.map((r: any) => Number(r.item_id))));
  if (itemIds.length === 0) return { basis, items: [] };

  const itemRes = await query(
    `SELECT i.id, i.name, i.category, i.unit, i.pack_size, i.pack_unit, i.archived,
            COALESCE(vs.qty, 0) AS stock_now
     FROM items i
     LEFT JOIN varasto_stock vs ON vs.item_id = i.id
     WHERE i.id = ANY($1)
     ORDER BY i.category, i.name`,
    [itemIds]
  );

  const history = new Map<number, ForecastHistoryRow[]>();
  for (const r of consRes.rows) {
    const itemId = Number(r.item_id);
    const ev = meta.get(Number(r.event_id));
    if (!ev) continue;
    const consumed = Number(r.consumed);
    if (!history.has(itemId)) history.set(itemId, []);
    history.get(itemId)!.push({
      event_id: Number(r.event_id),
      event_name: ev.name,
      starts_at: ev.starts_at,
      org_count: ev.org_count,
      days: ev.days,
      consumed,
      per_org: consumed / ev.org_count,
      per_org_day: consumed / (ev.org_count * ev.days),
    });
  }

  const items = itemRes.rows.map((it: any) => {
    const rows = (history.get(Number(it.id)) ?? []).sort((a, b) => ts(a.starts_at) - ts(b.starts_at));
    const totalConsumed = sum(rows.map((r) => r.consumed));
    const totalOrgs = sum(rows.map((r) => r.org_count));
    const totalOrgDays = sum(rows.map((r) => r.org_count * r.days));

    // Painotettu keskiarvo: iso tapahtuma painaa enemmän kuin pieni.
    const perOrg = totalOrgs > 0 ? totalConsumed / totalOrgs : 0;
    const perOrgDay = totalOrgDays > 0 ? totalConsumed / totalOrgDays : 0;

    const estPerOrg = perOrg * orgCount;
    const estPerOrgDay = perOrgDay * orgCount * days;
    const stockNow = Number(it.stock_now);

    return {
      item_id: Number(it.id),
      name: it.name,
      category: it.category,
      unit: it.unit,
      pack_size: it.pack_size,
      pack_unit: it.pack_unit,
      archived: it.archived,
      // Luottamus: montako tapahtumaa arvion takana ja kuinka paljon hajontaa.
      events_used: rows.length,
      events_total: usable.length,
      per_org_min: rows.length ? Math.min(...rows.map((r) => r.per_org)) : 0,
      per_org_max: rows.length ? Math.max(...rows.map((r) => r.per_org)) : 0,
      per_org_day_min: rows.length ? Math.min(...rows.map((r) => r.per_org_day)) : 0,
      per_org_day_max: rows.length ? Math.max(...rows.map((r) => r.per_org_day)) : 0,
      total_consumed: totalConsumed,
      per_org: perOrg,
      per_org_day: perOrgDay,
      estimate_per_org: estPerOrg,
      estimate_per_org_day: estPerOrgDay,
      stock_now: stockNow,
      to_buy_per_org: Math.max(0, estPerOrg - stockNow),
      to_buy_per_org_day: Math.max(0, estPerOrgDay - stockNow),
      history: rows,
    };
  });

  return { basis, items };
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

// Aikaleima järjestämistä varten; puuttuva päivämäärä menee ensimmäiseksi.
function ts(v: Date | string | null): number {
  return v ? new Date(v).getTime() : 0;
}

// --- Vapaa kulutustilasto ---
//
// Kokonaiskulutus per tuote valituista tapahtumista + tapahtumakohtainen erittely
// aikajärjestyksessä (kertymäkäyrän piirtämiseen). Ilman event_ids-suodatinta
// mukaan tulee koko historia, myös ilman tapahtumaleimaa kirjatut.
export async function totalsReport(filters: {
  eventIds?: number[];
  itemId?: number;
  category?: string;
}) {
  const conds = ["m.type = 'kulutus'", 'm.voided = FALSE'];
  const params: any[] = [];
  if (filters.eventIds !== undefined) {
    params.push(filters.eventIds);
    conds.push(`m.event_id = ANY($${params.length})`);
  }
  if (filters.itemId !== undefined) {
    params.push(filters.itemId);
    conds.push(`m.item_id = $${params.length}`);
  }
  if (filters.category !== undefined) {
    params.push(filters.category);
    conds.push(`i.category = $${params.length}`);
  }
  const where = conds.join(' AND ');

  const totals = await query(
    `SELECT i.id AS item_id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
            SUM(m.quantity) AS total_unit,
            CASE WHEN i.pack_size IS NOT NULL THEN SUM(m.quantity) * i.pack_size END AS total_secondary,
            COUNT(DISTINCT m.event_id)::int AS events_used
     FROM movements m JOIN items i ON i.id = m.item_id
     WHERE ${where}
     GROUP BY i.id
     ORDER BY i.category, i.name`,
    params
  );

  const byEvent = await query(
    `SELECT m.item_id, m.event_id, e.name AS event_name,
            COALESCE(e.starts_at, e.created_at) AS event_at,
            SUM(m.quantity) AS maara_unit,
            CASE WHEN i.pack_size IS NOT NULL THEN SUM(m.quantity) * i.pack_size END AS maara_sekundaari
     FROM movements m
     JOIN items i ON i.id = m.item_id
     LEFT JOIN events e ON e.id = m.event_id
     WHERE ${where}
     GROUP BY m.item_id, m.event_id, e.name, e.starts_at, e.created_at, i.pack_size
     ORDER BY event_at NULLS FIRST, m.item_id`,
    params
  );

  return { items: totals.rows, by_event: byEvent.rows };
}

// Kulutus per tuote per päivä (koko historia tai suodatettuna).
export async function consumptionReport(filters: {
  event_id?: number;
  date?: string;
  item_id?: number;
  category?: string;
}) {
  const conds = ["m.type = 'kulutus'", 'm.voided = FALSE'];
  const params: any[] = [TZ];
  let i = 2;
  if (filters.event_id !== undefined) {
    conds.push(`m.event_id = $${i++}`);
    params.push(filters.event_id);
  }
  if (filters.item_id !== undefined) {
    conds.push(`m.item_id = $${i++}`);
    params.push(filters.item_id);
  }
  if (filters.category !== undefined) {
    conds.push(`i.category = $${i++}`);
    params.push(filters.category);
  }
  if (filters.date !== undefined) {
    conds.push(`date(m.created_at AT TIME ZONE $1) = $${i++}`);
    params.push(filters.date);
  }

  const { rows } = await query(
    `SELECT date(m.created_at AT TIME ZONE $1) AS pvm,
            i.id AS item_id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
            SUM(m.quantity) AS maara_unit,
            SUM(m.quantity) * i.pack_size AS maara_sekundaari
     FROM movements m JOIN items i ON i.id = m.item_id
     WHERE ${conds.join(' AND ')}
     GROUP BY pvm, i.id
     ORDER BY pvm, i.name`,
    params
  );
  return rows;
}
