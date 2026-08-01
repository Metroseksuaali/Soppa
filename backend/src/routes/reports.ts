import { Router } from 'express';
import { query } from '../db';
import { asyncHandler } from '../util';
import { requireAuth } from '../auth';
import { consumptionReport } from '../reports';

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
