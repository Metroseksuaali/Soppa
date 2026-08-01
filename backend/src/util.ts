import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Käärii async-reitin niin että virheet menevät error-middlewarelle.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// Sovelluksen virhe jolla on HTTP-koodi ja suomenkielinen viesti.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Globaali virhekäsittelijä: aina { error } -muoto.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Virheellinen syöte', details: err.issues });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Postgres unique-rikkomus tms.
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as any).code;
    if (code === '23505') return res.status(409).json({ error: 'Arvo on jo käytössä' });
  }
  console.error('Käsittelemätön virhe:', err);
  return res.status(500).json({ error: 'Palvelinvirhe' });
}
