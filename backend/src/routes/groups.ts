import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth } from '../auth';

// Tuoteryhmät: "Juusto", "Leikkele (kana)" jne. Ryhmällä on perusyksikkö, johon
// jäsentuotteiden määrät muunnetaan (ks. item_group_factor -näkymä, migraatio 005).
export const groupsRouter = Router();

groupsRouter.use(requireAuth);

groupsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const withInactive = req.query.active === 'all';
    const { rows } = await query(
      `SELECT g.id, g.name, g.base_unit, g.active, g.created_at,
              COUNT(i.id) FILTER (WHERE i.archived = FALSE)::int AS item_count,
              -- Tuotteet joiden määrää ei voi muuntaa ryhmän perusyksikköön:
              COUNT(f.item_id) FILTER (WHERE f.factor IS NULL)::int AS incompatible_count
       FROM item_groups g
       LEFT JOIN items i ON i.group_id = g.id
       LEFT JOIN item_group_factor f ON f.item_id = i.id AND i.archived = FALSE
       ${withInactive ? '' : 'WHERE g.active = TRUE'}
       GROUP BY g.id
       ORDER BY g.name`
    );
    res.json(rows);
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  base_unit: z.string().min(1).max(12),
});

groupsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    try {
      const { rows } = await query(
        `INSERT INTO item_groups (name, base_unit, created_by) VALUES ($1, $2, $3)
         RETURNING id, name, base_unit, active, created_at`,
        [b.name, b.base_unit, req.user!.id]
      );
      res.status(201).json({ ...rows[0], item_count: 0, incompatible_count: 0 });
    } catch (err: any) {
      if (err?.code === '23505') throw new HttpError(409, 'Samanniminen ryhmä on jo olemassa');
      throw err;
    }
  })
);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  base_unit: z.string().min(1).max(12).optional(),
  active: z.boolean().optional(),
});

groupsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = patchSchema.parse(req.body);
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const key of ['name', 'base_unit', 'active'] as const) {
      if (b[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        params.push(b[key]);
      }
    }
    if (sets.length === 0) throw new HttpError(400, 'Ei muutettavia kenttiä');
    params.push(id);
    try {
      const { rows } = await query(
        `UPDATE item_groups SET ${sets.join(', ')} WHERE id = $${i}
         RETURNING id, name, base_unit, active, created_at`,
        params
      );
      if (rows.length === 0) throw new HttpError(404, 'Ryhmää ei löydy');
      res.json(rows[0]);
    } catch (err: any) {
      if (err?.code === '23505') throw new HttpError(409, 'Samanniminen ryhmä on jo olemassa');
      throw err;
    }
  })
);

// Ryhmän tuotteet + muunnoskerroin (näyttää myös yhteismitattomat).
groupsRouter.get(
  '/:id/items',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query(
      `SELECT i.id, i.name, i.unit, i.pack_size, i.pack_unit, i.archived, f.factor
       FROM items i
       LEFT JOIN item_group_factor f ON f.item_id = i.id
       WHERE i.group_id = $1
       ORDER BY i.archived, i.name`,
      [id]
    );
    res.json(rows);
  })
);
