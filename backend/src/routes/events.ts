import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth } from '../auth';
import { buildEventReport } from '../reports';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      'SELECT id, name, active, starts_at, ends_at, created_at, created_by FROM events ORDER BY created_at DESC'
    );
    res.json(rows);
  })
);

eventsRouter.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      'SELECT id, name, active, starts_at, ends_at, created_at FROM events WHERE active = TRUE LIMIT 1'
    );
    res.json(rows[0] ?? null);
  })
);

const createSchema = z.object({ name: z.string().min(1) });

eventsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO events (name, active, created_by) VALUES ($1, FALSE, $2)
       RETURNING id, name, active, starts_at, ends_at, created_at`,
      [name, req.user!.id]
    );
    res.status(201).json(rows[0]);
  })
);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

eventsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = patchSchema.parse(req.body);

    const result = await withTx(async (client) => {
      // Aktivointi: tee tästä ainoa aktiivinen (nollaa muut ensin unique-indeksin takia).
      if (body.active === true) {
        await client.query('UPDATE events SET active = FALSE WHERE active = TRUE AND id <> $1', [id]);
        await client.query(
          'UPDATE events SET active = TRUE, starts_at = COALESCE(starts_at, now()) WHERE id = $1',
          [id]
        );
      } else if (body.active === false) {
        await client.query('UPDATE events SET active = FALSE WHERE id = $1', [id]);
      }
      if (body.name !== undefined) {
        await client.query('UPDATE events SET name = $1 WHERE id = $2', [body.name, id]);
      }
      const { rows } = await client.query(
        'SELECT id, name, active, starts_at, ends_at, created_at FROM events WHERE id = $1',
        [id]
      );
      return rows[0];
    });

    if (!result) throw new HttpError(404, 'Tapahtumaa ei löydy');
    res.json(result);
  })
);

eventsRouter.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await query(
      `UPDATE events SET active = FALSE, ends_at = now() WHERE id = $1
       RETURNING id, name, active, starts_at, ends_at, created_at`,
      [id]
    );
    if (rows.length === 0) throw new HttpError(404, 'Tapahtumaa ei löydy');
    res.json(rows[0]);
  })
);

eventsRouter.get(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const groupByDay = req.query.group_by === 'day';
    const report = await buildEventReport(id, groupByDay);
    if (!report) throw new HttpError(404, 'Tapahtumaa ei löydy');
    res.json(report);
  })
);
