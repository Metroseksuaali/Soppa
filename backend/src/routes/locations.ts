import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth } from '../auth';

export const locationsRouter = Router();

locationsRouter.use(requireAuth);

locationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const activeParam = req.query.active;
    const params: any[] = [];
    let where = '';
    if (activeParam !== undefined) {
      where = 'WHERE l.active = $1';
      params.push(activeParam === 'true');
    }
    // items_out = montako eri tuotetta on juuri nyt ulkona sijainnissa (listan yhteenveto).
    const { rows } = await query(
      `SELECT l.id, l.name, l.kind, l.active, l.created_at,
              COALESCE(s.items_out, 0)::int AS items_out
       FROM locations l
       LEFT JOIN (
         SELECT location_id, COUNT(*) AS items_out FROM location_stock
         WHERE qty > 0 GROUP BY location_id
       ) s ON s.location_id = l.id
       ${where}
       ORDER BY l.kind DESC, l.name`,
      params
    );
    res.json(rows);
  })
);

// Sijainnin sisältö: mitä on juuri nyt ulkona (palautuvat) + mitä täällä on kulutettu.
// Kulutus rajataan aktiiviseen tapahtumaan jos sellainen on — muuten koko historia
// kertyisi vuosien yli eikä kertoisi mitään nykytilasta.
locationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const loc = await query(
      'SELECT id, name, kind, active, created_at FROM locations WHERE id = $1',
      [id]
    );
    if (loc.rows.length === 0) throw new HttpError(404, 'Sijaintia ei löydy');

    const out = await query(
      `SELECT i.id AS item_id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
              ls.qty,
              CASE WHEN i.pack_size IS NOT NULL THEN ls.qty * i.pack_size END AS qty_secondary,
              (p.item_id IS NOT NULL) AS has_photo, p.updated_at AS photo_updated_at
       FROM location_stock ls
       JOIN items i ON i.id = ls.item_id
       LEFT JOIN item_photos p ON p.item_id = i.id
       WHERE ls.location_id = $1 AND ls.qty > 0
       ORDER BY i.category, i.name`,
      [id]
    );

    const ev = await query('SELECT id, name FROM events WHERE active = TRUE LIMIT 1');
    const event = ev.rows[0] ?? null;
    const consumed = await query(
      `SELECT i.id AS item_id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
              SUM(m.quantity) AS qty,
              CASE WHEN i.pack_size IS NOT NULL THEN SUM(m.quantity) * i.pack_size END AS qty_secondary
       FROM movements m
       JOIN items i ON i.id = m.item_id
       WHERE m.location_id = $1 AND m.voided = FALSE AND m.type = 'kulutus'
         AND ($2::int IS NULL OR m.event_id = $2)
       GROUP BY i.id, i.name, i.category, i.unit, i.pack_size, i.pack_unit
       HAVING SUM(m.quantity) > 0
       ORDER BY i.category, i.name`,
      [id, event?.id ?? null]
    );

    res.json({
      location: loc.rows[0],
      out: out.rows,
      consumed: consumed.rows,
      consumed_event: event,
    });
  })
);

const createSchema = z.object({ name: z.string().min(1) });

locationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO locations (name, kind, created_by) VALUES ($1, 'sijainti', $2)
       RETURNING id, name, kind, active, created_at`,
      [name, req.user!.id]
    );
    res.status(201).json(rows[0]);
  })
);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

locationsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = patchSchema.parse(req.body);
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (body.name !== undefined) {
      sets.push(`name = $${i++}`);
      params.push(body.name);
    }
    if (body.active !== undefined) {
      sets.push(`active = $${i++}`);
      params.push(body.active);
    }
    if (sets.length === 0) throw new HttpError(400, 'Ei muutettavia kenttiä');
    params.push(id);
    const { rows } = await query(
      `UPDATE locations SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, kind, active, created_at`,
      params
    );
    if (rows.length === 0) throw new HttpError(404, 'Sijaintia ei löydy');
    res.json(rows[0]);
  })
);
