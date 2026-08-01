import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { asyncHandler, HttpError } from '../util';
import { signToken, cookieOptions, COOKIE_NAME, requireAuth } from '../auth';

export const authRouter = Router();

// Login-rate limit: 5 yritystä / 15 min / IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Liikaa kirjautumisyrityksiä, yritä myöhemmin uudelleen' },
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const { rows } = await query(
      'SELECT id, username, display_name, is_admin, password_hash, active FROM users WHERE username = $1',
      [username]
    );
    const user = rows[0];
    if (!user || !user.active) throw new HttpError(401, 'Väärä käyttäjätunnus tai salasana');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Väärä käyttäjätunnus tai salasana');

    const authUser = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      is_admin: user.is_admin,
    };
    res.cookie(COOKIE_NAME, signToken(authUser), cookieOptions());
    res.json({ user: authUser });
  })
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);
