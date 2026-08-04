import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { asyncHandler } from '../util';
import { requireAuth } from '../auth';
import { consumptionReport, forecastReport, totalsReport } from '../reports';

// /api/stock ja /api/reports/* -reitit.
export const stockRouter = Router();
export const reportsRouter = Router();

stockRouter.use(requireAuth);
reportsRouter.use(requireAuth);

// Varastosaldo per tuote (+ sekundäärimäärä pack_sizen mukaan).
stockRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT i.id AS item_id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
              i.returnable, i.archived,
              COALESCE(vs.qty, 0) AS stock,
              CASE WHEN i.pack_size IS NOT NULL THEN COALESCE(vs.qty, 0) * i.pack_size END AS stock_secondary
       FROM items i
       LEFT JOIN varasto_stock vs ON vs.item_id = i.id
       WHERE i.archived = FALSE
       ORDER BY i.category, i.name`
    );
    res.json(rows);
  })
);

// Kulutus (kpl + paino) suodattimin.
reportsRouter.get(
  '/consumption',
  asyncHandler(async (req, res) => {
    const filters: any = {};
    if (req.query.event_id) filters.event_id = parseInt(req.query.event_id as string, 10);
    if (req.query.item_id) filters.item_id = parseInt(req.query.item_id as string, 10);
    if (req.query.category) filters.category = req.query.category as string;
    if (req.query.date) filters.date = req.query.date as string;
    const rows = await consumptionReport(filters);
    res.json(rows);
  })
);

// Kulutusennuste: arvio tulevan tapahtuman tarpeesta valittujen menneiden
// tapahtumien menekin perusteella. POST, koska pohjatapahtumat tulevat listana.
const forecastSchema = z.object({
  event_ids: z.array(z.number().int().positive()).min(1),
  org_count: z.number().int().positive(),
  days: z.number().int().positive().max(365).default(1),
  category: z.enum(['ruoka', 'tavara', 'kaluste']).optional(),
});

reportsRouter.post(
  '/forecast',
  asyncHandler(async (req, res) => {
    const body = forecastSchema.parse(req.body);
    const report = await forecastReport({
      eventIds: body.event_ids,
      orgCount: body.org_count,
      days: body.days,
      category: body.category,
    });
    res.json(report);
  })
);

// Kokonaiskulutus per tuote (+ tapahtumakohtainen erittely kertymää varten).
reportsRouter.get(
  '/totals',
  asyncHandler(async (req, res) => {
    const filters: any = {};
    if (req.query.event_ids) {
      const ids = String(req.query.event_ids)
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n));
      if (ids.length > 0) filters.eventIds = ids;
    }
    if (req.query.item_id) filters.itemId = parseInt(req.query.item_id as string, 10);
    if (req.query.category) filters.category = req.query.category as string;
    const report = await totalsReport(filters);
    res.json(report);
  })
);
