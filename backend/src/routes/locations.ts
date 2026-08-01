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
      where = 'WHERE active = $1';
      params.push(activeParam === 'true');
    }
    const { rows } = await query(
      `SELECT id, name, kind, active, created_at FROM locations ${where} ORDER BY kind DESC, name`,
      params
    );
    res.json(rows);
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
