import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth } from '../auth';

export const itemsRouter = Router();

itemsRouter.use(requireAuth);

// GET /api/items?category=&archived=false&q=  → tuotteet + varastosaldo
itemsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const params: any[] = [];
    const conds: string[] = [];
    let i = 1;

    const category = req.query.category as string | undefined;
    if (category) {
      conds.push(`i.category = $${i++}`);
      params.push(category);
    }
    // archived oletuksena false; 'all' näyttää kaikki.
    const archived = (req.query.archived as string | undefined) ?? 'false';
    if (archived !== 'all') {
      conds.push(`i.archived = $${i++}`);
      params.push(archived === 'true');
    }
    const q = req.query.q as string | undefined;
    if (q) {
      conds.push(`i.name ILIKE $${i++}`);
      params.push(`%${q}%`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT i.id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
              i.returnable, i.archived, i.note, i.created_at,
              COALESCE(vs.qty, 0) AS stock
       FROM items i
       LEFT JOIN varasto_stock vs ON vs.item_id = i.id
       ${where}
       ORDER BY i.name`,
      params
    );
    res.json(rows);
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['ruoka', 'tavara', 'kaluste']),
  unit: z.string().min(1),
  pack_size: z.number().positive().nullable().optional(),
  pack_unit: z.string().min(1).nullable().optional(),
  returnable: z.boolean(),
  note: z.string().nullable().optional(),
});

itemsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO items (name, category, unit, pack_size, pack_unit, returnable, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, category, unit, pack_size, pack_unit, returnable, archived, note, created_at`,
      [b.name, b.category, b.unit, b.pack_size ?? null, b.pack_unit ?? null, b.returnable, b.note ?? null, req.user!.id]
    );
    res.status(201).json({ ...rows[0], stock: 0 });
  })
);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  pack_size: z.number().positive().nullable().optional(),
  pack_unit: z.string().min(1).nullable().optional(),
  returnable: z.boolean().optional(),
  note: z.string().nullable().optional(),
});

itemsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = patchSchema.parse(req.body);
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const key of ['name', 'unit', 'pack_size', 'pack_unit', 'returnable', 'note'] as const) {
      if (b[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        params.push(b[key]);
      }
    }
    if (sets.length === 0) throw new HttpError(400, 'Ei muutettavia kenttiä');
    params.push(id);
    const { rows } = await query(
      `UPDATE items SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, category, unit, pack_size, pack_unit, returnable, archived, note, created_at`,
      params
    );
    if (rows.length === 0) throw new HttpError(404, 'Tuotetta ei löydy');
    res.json(rows[0]);
  })
);

itemsRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query('UPDATE items SET archived = TRUE WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new HttpError(404, 'Tuotetta ei löydy');
    res.json({ ok: true });
  })
);

itemsRouter.post(
  '/:id/unarchive',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query('UPDATE items SET archived = FALSE WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new HttpError(404, 'Tuotetta ei löydy');
    res.json({ ok: true });
  })
);

// GET /api/items/:id → tiedot + varastosaldo + sijaintijakauma + historia
itemsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const itemRes = await query(
      `SELECT i.id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
              i.returnable, i.archived, i.note, i.created_at,
              COALESCE(vs.qty, 0) AS stock
       FROM items i
       LEFT JOIN varasto_stock vs ON vs.item_id = i.id
       WHERE i.id = $1`,
      [id]
    );
    if (itemRes.rows.length === 0) throw new HttpError(404, 'Tuotetta ei löydy');
    const item = itemRes.rows[0];

    // Sijaintijakauma (vain palautuvat, > 0 ulkona).
    const locRes = await query(
      `SELECT ls.location_id, l.name AS location_name, ls.qty
       FROM location_stock ls
       JOIN locations l ON l.id = ls.location_id
       WHERE ls.item_id = $1 AND ls.qty <> 0
       ORDER BY l.name`,
      [id]
    );

    // Historia (uusin ensin).
    const histRes = await query(
      `SELECT m.id, m.type, m.quantity, m.counted, m.location_id, l.name AS location_name,
              m.event_id, e.name AS event_name, m.user_id, u.display_name AS user_name,
              m.note, m.voided, m.voids_id, m.created_at
       FROM movements m
       LEFT JOIN locations l ON l.id = m.location_id
       LEFT JOIN events e ON e.id = m.event_id
       JOIN users u ON u.id = m.user_id
       WHERE m.item_id = $1
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 200`,
      [id]
    );

    res.json({ ...item, locations: locRes.rows, history: histRes.rows });
  })
);
