import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../db';
import { asyncHandler, HttpError } from '../util';
import { requireAuth, requireAdmin } from '../auth';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      'SELECT id, username, display_name, is_admin, active, created_at FROM users ORDER BY username'
    );
    res.json(rows);
  })
);

const createSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(6),
  display_name: z.string().min(1),
  is_admin: z.boolean().optional().default(false),
});

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const hash = await bcrypt.hash(body.password, 12);
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, is_admin, active, created_at`,
      [body.username, hash, body.display_name, body.is_admin]
    );
    res.status(201).json(rows[0]);
  })
);

const patchSchema = z.object({
  display_name: z.string().min(1).optional(),
  is_admin: z.boolean().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = patchSchema.parse(req.body);

    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (body.display_name !== undefined) {
      sets.push(`display_name = $${i++}`);
      params.push(body.display_name);
    }
    if (body.is_admin !== undefined) {
      sets.push(`is_admin = $${i++}`);
      params.push(body.is_admin);
    }
    if (body.active !== undefined) {
      sets.push(`active = $${i++}`);
      params.push(body.active);
    }
    if (body.password !== undefined) {
      sets.push(`password_hash = $${i++}`);
      params.push(await bcrypt.hash(body.password, 12));
    }
    if (sets.length === 0) throw new HttpError(400, 'Ei muutettavia kenttiä');

    params.push(id);
    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, username, display_name, is_admin, active, created_at`,
      params
    );
    if (rows.length === 0) throw new HttpError(404, 'Käyttäjää ei löydy');
    res.json(rows[0]);
  })
);
