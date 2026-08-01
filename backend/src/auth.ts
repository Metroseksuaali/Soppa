import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { HttpError } from './util';

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  is_admin: boolean;
}

// Laajenna Express Request user-kentällä.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const COOKIE_NAME = 'catering_token';

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax' as const,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

// Vaatii kirjautuneen käyttäjän.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Kirjautuminen vaaditaan');
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser & { iat: number; exp: number };
    req.user = {
      id: payload.id,
      username: payload.username,
      display_name: payload.display_name,
      is_admin: payload.is_admin,
    };
    next();
  } catch {
    throw new HttpError(401, 'Istunto vanhentunut');
  }
}

// Vaatii admin-oikeudet (requireAuth pitää ajaa ensin).
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.is_admin) throw new HttpError(403, 'Vaatii ylläpitäjän oikeudet');
  next();
}
