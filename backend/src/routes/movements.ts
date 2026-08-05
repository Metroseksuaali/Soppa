import { Router } from 'express';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTx } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth } from '../auth';

export const movementsRouter = Router();

movementsRouter.use(requireAuth);

// --- Apurit ------------------------------------------------------------

// Lukitsee tuoterivin ja tarkistaa että se on olemassa (serialisoi rinnakkaiset kirjaukset).
async function lockItem(client: PoolClient, itemId: number) {
  const { rows } = await client.query(
    'SELECT id, returnable, archived FROM items WHERE id = $1 FOR UPDATE',
    [itemId]
  );
  if (rows.length === 0) throw new HttpError(404, 'Tuotetta ei löydy');
  return rows[0] as { id: number; returnable: boolean; archived: boolean };
}

// Nykyinen varastosaldo (etumerkillinen summa lokista, vain voided=false).
async function currentStock(client: PoolClient, itemId: number): Promise<number> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(CASE type
        WHEN 'lisays' THEN quantity
        WHEN 'palautus' THEN quantity
        WHEN 'inventointi' THEN quantity
        WHEN 'vienti' THEN -quantity
        WHEN 'kulutus' THEN -quantity END), 0) AS qty
     FROM movements WHERE item_id = $1 AND voided = FALSE`,
    [itemId]
  );
  return Number(rows[0].qty);
}

// Paljonko tuotetta on ulkona tietyssä sijainnissa juuri nyt.
async function locationOut(client: PoolClient, itemId: number, locationId: number): Promise<number> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(CASE type WHEN 'vienti' THEN quantity WHEN 'palautus' THEN -quantity END), 0) AS qty
     FROM movements
     WHERE item_id = $1 AND location_id = $2 AND voided = FALSE AND type IN ('vienti','palautus')`,
    [itemId, locationId]
  );
  return Number(rows[0].qty);
}

async function activeEventId(client: PoolClient): Promise<number | null> {
  const { rows } = await client.query('SELECT id FROM events WHERE active = TRUE LIMIT 1');
  return rows[0]?.id ?? null;
}

async function assertLocationExists(client: PoolClient, locationId: number) {
  const { rows } = await client.query('SELECT id FROM locations WHERE id = $1', [locationId]);
  if (rows.length === 0) throw new HttpError(404, 'Sijaintia ei löydy');
}

// Palauttaa täydennetyn kirjausrivin (nimineen).
async function fetchMovement(client: PoolClient, id: number) {
  const { rows } = await client.query(
    `SELECT m.id, m.item_id, i.name AS item_name, i.unit, i.pack_size, i.pack_unit,
            m.type, m.quantity, m.counted, m.location_id, l.name AS location_name,
            m.event_id, e.name AS event_name, m.user_id, u.display_name AS user_name,
            m.note, m.voided, m.voids_id, m.sponsored, m.created_at
     FROM movements m
     JOIN items i ON i.id = m.item_id
     LEFT JOIN locations l ON l.id = m.location_id
     LEFT JOIN events e ON e.id = m.event_id
     JOIN users u ON u.id = m.user_id
     WHERE m.id = $1`,
    [id]
  );
  return rows[0];
}

// --- Skeemat -----------------------------------------------------------

const qtySchema = z.number().positive();

const addSchema = z.object({
  item_id: z.number().int(),
  quantity: qtySchema,
  note: z.string().nullable().optional(),
  // Sponsorilahjoitus: tavara saatiin maksutta. Vaikuttaa vain siihen mistä tavara
  // tuli — kulutus ja ennuste lasketaan samoin kuin ostetusta tavarasta.
  sponsored: z.boolean().optional(),
});
const deploySchema = z.object({
  item_id: z.number().int(),
  location_id: z.number().int(),
  quantity: qtySchema,
  note: z.string().nullable().optional(),
});
const consumeSchema = z.object({
  item_id: z.number().int(),
  quantity: qtySchema,
  location_id: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
});
const inventorySchema = z.object({
  item_id: z.number().int(),
  counted: z.number().min(0),
  note: z.string().nullable().optional(),
});

// --- Kirjaukset --------------------------------------------------------

// Lisäys (+)
movementsRouter.post(
  '/add',
  asyncHandler(async (req, res) => {
    const b = addSchema.parse(req.body);
    const mv = await withTx(async (client) => {
      await lockItem(client, b.item_id);
      const eventId = await activeEventId(client);
      const { rows } = await client.query(
        `INSERT INTO movements (item_id, type, quantity, event_id, user_id, note, sponsored)
         VALUES ($1, 'lisays', $2, $3, $4, $5, $6) RETURNING id`,
        [b.item_id, b.quantity, eventId, req.user!.id, b.note ?? null, b.sponsored ?? false]
      );
      return fetchMovement(client, rows[0].id);
    });
    res.status(201).json(mv);
  })
);

// Vienti (returnable-only), varastosaldo ei saa mennä negatiiviseksi
movementsRouter.post(
  '/deploy',
  asyncHandler(async (req, res) => {
    const b = deploySchema.parse(req.body);
    const mv = await withTx(async (client) => {
      const item = await lockItem(client, b.item_id);
      if (!item.returnable) throw new HttpError(400, 'Vienti sallittu vain palautuville tuotteille');
      await assertLocationExists(client, b.location_id);
      const stock = await currentStock(client, b.item_id);
      if (stock - b.quantity < 0) throw new HttpError(409, `Varastosaldo ei riitä (saldo ${stock})`);
      const eventId = await activeEventId(client);
      const { rows } = await client.query(
        `INSERT INTO movements (item_id, type, quantity, location_id, event_id, user_id, note)
         VALUES ($1, 'vienti', $2, $3, $4, $5, $6) RETURNING id`,
        [b.item_id, b.quantity, b.location_id, eventId, req.user!.id, b.note ?? null]
      );
      return fetchMovement(client, rows[0].id);
    });
    res.status(201).json(mv);
  })
);

// Palautus (returnable-only), ei enempää kuin sijainnissa on ulkona
movementsRouter.post(
  '/return',
  asyncHandler(async (req, res) => {
    const b = deploySchema.parse(req.body);
    const mv = await withTx(async (client) => {
      const item = await lockItem(client, b.item_id);
      if (!item.returnable) throw new HttpError(400, 'Palautus sallittu vain palautuville tuotteille');
      await assertLocationExists(client, b.location_id);
      const out = await locationOut(client, b.item_id, b.location_id);
      if (b.quantity > out) throw new HttpError(409, `Sijainnissa on ulkona vain ${out}`);
      const eventId = await activeEventId(client);
      const { rows } = await client.query(
        `INSERT INTO movements (item_id, type, quantity, location_id, event_id, user_id, note)
         VALUES ($1, 'palautus', $2, $3, $4, $5, $6) RETURNING id`,
        [b.item_id, b.quantity, b.location_id, eventId, req.user!.id, b.note ?? null]
      );
      return fetchMovement(client, rows[0].id);
    });
    res.status(201).json(mv);
  })
);

// Kulutus (−), sijainti valinnainen, ei negatiiviseksi
movementsRouter.post(
  '/consume',
  asyncHandler(async (req, res) => {
    const b = consumeSchema.parse(req.body);
    const mv = await withTx(async (client) => {
      await lockItem(client, b.item_id);
      if (b.location_id != null) await assertLocationExists(client, b.location_id);
      const stock = await currentStock(client, b.item_id);
      if (stock - b.quantity < 0) throw new HttpError(409, `Varastosaldo ei riitä (saldo ${stock})`);
      const eventId = await activeEventId(client);
      const { rows } = await client.query(
        `INSERT INTO movements (item_id, type, quantity, location_id, event_id, user_id, note)
         VALUES ($1, 'kulutus', $2, $3, $4, $5, $6) RETURNING id`,
        [b.item_id, b.quantity, b.location_id ?? null, eventId, req.user!.id, b.note ?? null]
      );
      return fetchMovement(client, rows[0].id);
    });
    res.status(201).json(mv);
  })
);

// Inventointi: delta = counted − nykysaldo
movementsRouter.post(
  '/inventory',
  asyncHandler(async (req, res) => {
    const b = inventorySchema.parse(req.body);
    const mv = await withTx(async (client) => {
      await lockItem(client, b.item_id);
      const stock = await currentStock(client, b.item_id);
      const delta = b.counted - stock;
      const eventId = await activeEventId(client);
      const { rows } = await client.query(
        `INSERT INTO movements (item_id, type, quantity, counted, event_id, user_id, note)
         VALUES ($1, 'inventointi', $2, $3, $4, $5, $6) RETURNING id`,
        [b.item_id, delta, b.counted, eventId, req.user!.id, b.note ?? null]
      );
      return fetchMovement(client, rows[0].id);
    });
    res.status(201).json(mv);
  })
);

// --- Historiatuonti ----------------------------------------------------
//
// Menneen tapahtuman kulutus tuodaan lokiin päivätasolla, jotta päiväkohtainen
// erittely (rakennuspäivät vs. tapahtumapäivät) säilyy. Rivit leimataan annettuun
// tapahtumaan — ei aktiiviseen — ja aikaleimaksi tulee annetun päivän keskipäivä
// Helsingin aikaa, jolloin päiväryhmittely (§11) osuu oikealle päivälle.
//
// Saldo: `balance_with_additions` luo jokaiselle tuodulle kulutukselle vastaavan
// lisäyksen samalle päivälle, jolloin nettovaikutus nykysaldoon on nolla. Ilman sitä
// tuonti voi viedä saldon negatiiviseksi — se tarkistetaan ja tuonti perutaan (409).

const importRowSchema = z.object({
  item_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Päivämäärä muodossa VVVV-KK-PP'),
  quantity: qtySchema,
  type: z.enum(['kulutus', 'lisays']).default('kulutus'),
  note: z.string().nullable().optional(),
  sponsored: z.boolean().optional(), // vain lisäysriveillä merkityksellinen
});

const importSchema = z.object({
  event_id: z.number().int().positive(),
  balance_with_additions: z.boolean().default(true),
  rows: z.array(importRowSchema).min(1).max(2000),
});

// Annettu päivä klo 12 Helsingin aikaa -> timestamptz.
const IMPORT_TS = `($1::date + time '12:00') AT TIME ZONE 'Europe/Helsinki'`;

movementsRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const b = importSchema.parse(req.body);
    const batch = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const result = await withTx(async (client) => {
      const ev = await client.query('SELECT id, name FROM events WHERE id = $1', [b.event_id]);
      if (ev.rows.length === 0) throw new HttpError(404, 'Tapahtumaa ei löydy');

      // Lukitse tuotteet id-järjestyksessä, jotta rinnakkaiset kirjaukset eivät lukkiudu.
      const itemIds = Array.from(new Set(b.rows.map((r) => r.item_id))).sort((x, y) => x - y);
      const nameById = new Map<number, string>();
      for (const id of itemIds) {
        const { rows } = await client.query('SELECT id, name FROM items WHERE id = $1 FOR UPDATE', [id]);
        if (rows.length === 0) throw new HttpError(404, `Tuotetta ei löydy (id ${id})`);
        nameById.set(id, rows[0].name);
      }

      let inserted = 0;
      for (const row of b.rows) {
        await client.query(
          `INSERT INTO movements (item_id, type, quantity, event_id, user_id, note, import_batch, sponsored, created_at)
           VALUES ($2, $3, $4, $5, $6, $7, $8, $9, ${IMPORT_TS})`,
          [
            row.date,
            row.item_id,
            row.type,
            row.quantity,
            b.event_id,
            req.user!.id,
            row.note ?? null,
            batch,
            row.type === 'lisays' ? row.sponsored ?? false : false,
          ]
        );
        inserted++;
        if (b.balance_with_additions && row.type === 'kulutus') {
          await client.query(
            `INSERT INTO movements (item_id, type, quantity, event_id, user_id, note, import_batch, created_at)
             VALUES ($2, 'lisays', $3, $4, $5, $6, $7, ${IMPORT_TS})`,
            [row.date, row.item_id, row.quantity, b.event_id, req.user!.id, 'Historiatuonti', batch]
          );
          inserted++;
        }
      }

      // Yksikään saldo ei saa jäädä negatiiviseksi tuonnin jälkeen.
      for (const id of itemIds) {
        const stock = await currentStock(client, id);
        if (stock < 0) {
          throw new HttpError(
            409,
            `Tuonti veisi tuotteen "${nameById.get(id)}" saldon negatiiviseksi (${stock}). ` +
              'Tuo myös lisäykset tai käytä automaattista tasausta.'
          );
        }
      }

      return {
        batch,
        inserted,
        rows: b.rows.length,
        balancing: inserted - b.rows.length, // automaattisesti luodut lisäysrivit
        event: ev.rows[0],
        items: itemIds.length,
      };
    });

    res.status(201).json(result);
  })
);

// Tuontierien listaus (uusin ensin) — mistä tapahtumasta, montako riviä, miltä ajalta.
movementsRouter.get(
  '/imports',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT m.import_batch AS batch, m.event_id, e.name AS event_name,
              COUNT(*)::int AS rows_total,
              COUNT(*) FILTER (WHERE m.voided)::int AS rows_voided,
              -- ::text jotta päivä ei siirry aikavyöhykemuunnoksissa selaimessa
              min(date(m.created_at AT TIME ZONE 'Europe/Helsinki'))::text AS first_date,
              max(date(m.created_at AT TIME ZONE 'Europe/Helsinki'))::text AS last_date,
              max(m.id) AS last_id
       FROM movements m
       LEFT JOIN events e ON e.id = m.event_id
       WHERE m.import_batch IS NOT NULL
       GROUP BY m.import_batch, m.event_id, e.name
       ORDER BY last_id DESC
       LIMIT 50`
    );
    res.json(rows);
  })
);

// Tuontierän peruminen: merkitsee erän rivit voided-tilaan (rivit jäävät lokiin näkyviin).
movementsRouter.post(
  '/imports/:batch/undo',
  asyncHandler(async (req, res) => {
    const batch = req.params.batch;
    const { rowCount } = await query(
      'UPDATE movements SET voided = TRUE WHERE import_batch = $1 AND voided = FALSE',
      [batch]
    );
    if (rowCount === 0) throw new HttpError(404, 'Tuontierää ei löydy tai se on jo peruttu');
    res.json({ batch, voided: rowCount });
  })
);

// Loki (uusin ensin) suodattimin
movementsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const conds: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      event_id: 'm.event_id',
      item_id: 'm.item_id',
      type: 'm.type',
      location_id: 'm.location_id',
    };
    for (const key of Object.keys(map)) {
      const val = req.query[key];
      if (val !== undefined) {
        conds.push(`${map[key]} = $${i++}`);
        params.push(key === 'type' ? val : parseInt(val as string, 10));
      }
    }
    if (req.query.from) {
      conds.push(`m.created_at >= $${i++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conds.push(`m.created_at <= $${i++}`);
      params.push(req.query.to);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const limit = Math.min(parseInt((req.query.limit as string) ?? '100', 10) || 100, 500);
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;

    const { rows } = await query(
      `SELECT m.id, m.item_id, i.name AS item_name, i.unit, i.pack_size, i.pack_unit,
              m.type, m.quantity, m.counted, m.location_id, l.name AS location_name,
              m.event_id, e.name AS event_name, m.user_id, u.display_name AS user_name,
              m.note, m.voided, m.voids_id, m.sponsored, m.created_at
       FROM movements m
       JOIN items i ON i.id = m.item_id
       LEFT JOIN locations l ON l.id = m.location_id
       LEFT JOIN events e ON e.id = m.event_id
       JOIN users u ON u.id = m.user_id
       ${where}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json(rows);
  })
);

// Void: peruu kirjauksen vaikutuksen saldosta
movementsRouter.post(
  '/:id/void',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await withTx(async (client) => {
      const { rows } = await client.query('SELECT id, voided FROM movements WHERE id = $1 FOR UPDATE', [id]);
      if (rows.length === 0) throw new HttpError(404, 'Kirjausta ei löydy');
      if (rows[0].voided) throw new HttpError(409, 'Kirjaus on jo peruttu');
      await client.query('UPDATE movements SET voided = TRUE WHERE id = $1', [id]);
      return fetchMovement(client, id);
    });
    res.json(result);
  })
);
