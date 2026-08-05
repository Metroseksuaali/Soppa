import { Router, Request, Response } from 'express';
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

    // Kuvan tavuja ei koskaan haeta listaukseen — vain tieto onko kuva ja milloin
    // se päivittyi (jälkimmäinen toimii <img>-URL:n välimuistiavaimena).
    const { rows } = await query(
      `SELECT i.id, i.name, i.category, i.unit, i.pack_size, i.pack_unit,
              i.returnable, i.archived, i.note, i.created_at,
              i.group_id, f.group_name, f.base_unit AS group_base_unit, f.factor AS group_factor,
              COALESCE(vs.qty, 0) AS stock,
              (p.item_id IS NOT NULL) AS has_photo, p.updated_at AS photo_updated_at
       FROM items i
       LEFT JOIN varasto_stock vs ON vs.item_id = i.id
       LEFT JOIN item_photos p ON p.item_id = i.id
       LEFT JOIN item_group_factor f ON f.item_id = i.id
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
  group_id: z.number().int().positive().nullable().optional(),
});

itemsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO items (name, category, unit, pack_size, pack_unit, returnable, note, group_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, category, unit, pack_size, pack_unit, returnable, archived, note, group_id, created_at`,
      [
        b.name,
        b.category,
        b.unit,
        b.pack_size ?? null,
        b.pack_unit ?? null,
        b.returnable,
        b.note ?? null,
        b.group_id ?? null,
        req.user!.id,
      ]
    );
    res.status(201).json({ ...rows[0], stock: 0, has_photo: false, photo_updated_at: null });
  })
);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  pack_size: z.number().positive().nullable().optional(),
  pack_unit: z.string().min(1).nullable().optional(),
  returnable: z.boolean().optional(),
  note: z.string().nullable().optional(),
  group_id: z.number().int().positive().nullable().optional(),
});

itemsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = patchSchema.parse(req.body);
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const key of ['name', 'unit', 'pack_size', 'pack_unit', 'returnable', 'note', 'group_id'] as const) {
      if (b[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        params.push(b[key]);
      }
    }
    if (sets.length === 0) throw new HttpError(400, 'Ei muutettavia kenttiä');
    params.push(id);
    const { rows } = await query(
      `UPDATE items SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, category, unit, pack_size, pack_unit, returnable, archived, note, group_id, created_at,
                 EXISTS (SELECT 1 FROM item_photos p WHERE p.item_id = items.id) AS has_photo,
                 (SELECT p.updated_at FROM item_photos p WHERE p.item_id = items.id) AS photo_updated_at`,
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
              i.group_id, f.group_name, f.base_unit AS group_base_unit, f.factor AS group_factor,
              COALESCE(vs.qty, 0) AS stock,
              (p.item_id IS NOT NULL) AS has_photo, p.updated_at AS photo_updated_at
       FROM items i
       LEFT JOIN varasto_stock vs ON vs.item_id = i.id
       LEFT JOIN item_photos p ON p.item_id = i.id
       LEFT JOIN item_group_factor f ON f.item_id = i.id
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
              m.note, m.voided, m.voids_id, m.sponsored, m.created_at
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

// --- Tuotekuva ---------------------------------------------------------------
//
// Yksi kuva per tuote. Selain pienentää ja pakkaa kuvan ennen lähetystä
// (frontend/src/lib/image.ts), joten backend ei tarvitse kuvankäsittelykirjastoa.
// Tässä varmistetaan vain että data on aitoa WebP/JPEG:iä ja mahtuu budjettiin —
// asiakaspuolen pakkaukseen ei voi luottaa yksinään.

const MAX_PHOTO_BYTES = 400_000; // ~1024 px pitkä sivu, laatu ~0,7
const MAX_THUMB_BYTES = 60_000; // ~256 px pitkä sivu

// Tunnista tiedostotyyppi taikatavuista, älä luota lähettäjän ilmoitukseen.
function sniffMime(buf: Buffer): 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function decodePhoto(base64: string, maxBytes: number, label: string): { buf: Buffer; mime: string } {
  const buf = Buffer.from(base64, 'base64');
  if (buf.length === 0) throw new HttpError(400, `${label}: tyhjä kuva`);
  if (buf.length > maxBytes) {
    throw new HttpError(413, `${label}: kuva on liian suuri (${Math.round(buf.length / 1024)} kt)`);
  }
  const mime = sniffMime(buf);
  if (!mime) throw new HttpError(400, `${label}: tuntematon kuvamuoto (vain JPEG ja WebP)`);
  return { buf, mime };
}

const photoSchema = z.object({
  data: z.string().min(1), // base64, näyttökuva
  thumb: z.string().min(1), // base64, pikkukuva listoihin
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
});

// PUT /api/items/:id/photo — luo tai korvaa tuotteen kuva.
itemsRouter.put(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = photoSchema.parse(req.body);

    const main = decodePhoto(b.data, MAX_PHOTO_BYTES, 'Kuva');
    const thumb = decodePhoto(b.thumb, MAX_THUMB_BYTES, 'Pikkukuva');
    if (thumb.mime !== main.mime) throw new HttpError(400, 'Kuvan ja pikkukuvan muoto poikkeaa');

    const exists = await query('SELECT 1 FROM items WHERE id = $1', [id]);
    if (exists.rows.length === 0) throw new HttpError(404, 'Tuotetta ei löydy');

    const { rows } = await query(
      `INSERT INTO item_photos (item_id, mime, data, thumb, width, height, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (item_id) DO UPDATE
         SET mime = EXCLUDED.mime, data = EXCLUDED.data, thumb = EXCLUDED.thumb,
             width = EXCLUDED.width, height = EXCLUDED.height,
             updated_at = now(), updated_by = EXCLUDED.updated_by
       RETURNING updated_at`,
      [id, main.mime, main.buf, thumb.buf, b.width ?? null, b.height ?? null, req.user!.id]
    );
    res.json({ has_photo: true, photo_updated_at: rows[0].updated_at, bytes: main.buf.length });
  })
);

itemsRouter.delete(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await query('DELETE FROM item_photos WHERE item_id = $1', [id]);
    if (rowCount === 0) throw new HttpError(404, 'Tuotteella ei ole kuvaa');
    res.json({ has_photo: false, photo_updated_at: null });
  })
);

// Kuvan tarjoilu. URL:ssa on ?v=<photo_updated_at>, joten sisältö on annetulla
// URL:lla muuttumaton → pitkä välimuisti. Ilman v-parametria pakotetaan revalidointi.
// private = jaettu välimuisti (proxy) ei saa säilöä kirjautumisen takaista kuvaa.
async function sendPhoto(req: Request, res: Response, column: 'data' | 'thumb') {
  const id = parseInt(req.params.id, 10);
  const { rows } = await query(`SELECT mime, ${column} AS bytes FROM item_photos WHERE item_id = $1`, [id]);
  if (rows.length === 0) throw new HttpError(404, 'Kuvaa ei löydy');
  res.set('Content-Type', rows[0].mime);
  res.set('Cache-Control', req.query.v ? 'private, max-age=31536000, immutable' : 'private, no-cache');
  // Express laskee ETagin ja vastaa 304:llä jos selaimella on jo sama versio.
  res.send(rows[0].bytes);
}

itemsRouter.get('/:id/photo', asyncHandler((req, res) => sendPhoto(req, res, 'data')));
itemsRouter.get('/:id/photo/thumb', asyncHandler((req, res) => sendPhoto(req, res, 'thumb')));
