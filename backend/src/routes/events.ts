import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth } from '../auth';
import { buildEventReport } from '../reports';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

// Tapahtuman perusrivi + ennustelaskennan mitat (org_count, kesto).
const EVENT_COLS = `e.id, e.name, e.active, e.starts_at, e.ends_at, e.created_at,
                    em.org_count, em.days_manual, em.days_effective`;

eventsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT ${EVENT_COLS}, e.created_by
       FROM events e JOIN event_metrics em ON em.event_id = e.id
       ORDER BY e.created_at DESC`
    );
    res.json(rows);
  })
);

eventsRouter.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT ${EVENT_COLS}
       FROM events e JOIN event_metrics em ON em.event_id = e.id
       WHERE e.active = TRUE LIMIT 1`
    );
    res.json(rows[0] ?? null);
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  org_count: z.number().int().positive().nullable().optional(),
  days: z.number().int().positive().max(365).nullable().optional(),
});

eventsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const ins = await query(
      `INSERT INTO events (name, active, created_by, org_count, days)
       VALUES ($1, FALSE, $2, $3, $4) RETURNING id`,
      [body.name, req.user!.id, body.org_count ?? null, body.days ?? null]
    );
    // Erillinen haku: CTE:n INSERT ei näy saman lauseen SELECTille (snapshot-eristys).
    const { rows } = await query(
      `SELECT ${EVENT_COLS}
       FROM events e JOIN event_metrics em ON em.event_id = e.id
       WHERE e.id = $1`,
      [ins.rows[0].id]
    );
    res.status(201).json(rows[0]);
  })
);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  org_count: z.number().int().positive().nullable().optional(),
  days: z.number().int().positive().max(365).nullable().optional(),
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
      if (body.org_count !== undefined) {
        await client.query('UPDATE events SET org_count = $1 WHERE id = $2', [body.org_count, id]);
      }
      if (body.days !== undefined) {
        await client.query('UPDATE events SET days = $1 WHERE id = $2', [body.days, id]);
      }
      const { rows } = await client.query(
        `SELECT ${EVENT_COLS}
         FROM events e JOIN event_metrics em ON em.event_id = e.id
         WHERE e.id = $1`,
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
    const upd = await query(
      `UPDATE events SET active = FALSE, ends_at = now() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (upd.rows.length === 0) throw new HttpError(404, 'Tapahtumaa ei löydy');
    const { rows } = await query(
      `SELECT ${EVENT_COLS}
       FROM events e JOIN event_metrics em ON em.event_id = e.id
       WHERE e.id = $1`,
      [id]
    );
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
