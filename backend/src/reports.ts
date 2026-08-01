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
