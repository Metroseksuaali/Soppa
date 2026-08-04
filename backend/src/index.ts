import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config, isProd } from './config';
import { waitForDb, pool } from './db';
import { runMigrations } from './migrate';
import { seed } from '../db/seed';
import { errorHandler } from './util';

import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { itemsRouter } from './routes/items';
import { locationsRouter } from './routes/locations';
import { eventsRouter } from './routes/events';
import { movementsRouter } from './routes/movements';
import { stockRouter, reportsRouter } from './routes/reports';

async function main() {
  await waitForDb();
  await runMigrations();
  await seed();

  const app = express();
  app.set('trust proxy', 1); // Caddyn takana; rate-limit ja Secure-cookie toimivat oikein.

  app.use(
    helmet({
      // CSP pois käytöstä SPA:n yksinkertaisuuden vuoksi (Caddy hoitaa muuten otsikot).
      contentSecurityPolicy: false,
    })
  );
  // Tuotekuvan lähetys (PUT /api/items/:id/photo) tarvitsee muuta API:a suuremman
  // runkorajan: base64-koodattu näyttökuva + pikkukuva mahtuu 1 Mt:iin. Muut reitit
  // pysyvät body-parserin oletusrajassa (100 kt).
  const photoBodyPath = /^\/api\/items\/\d+\/photo$/;
  const jsonDefault = express.json();
  const jsonPhoto = express.json({ limit: '1mb' });
  app.use((req, res, next) => (photoBodyPath.test(req.path) ? jsonPhoto : jsonDefault)(req, res, next));
  app.use(cookieParser());

  // Kehityksessä frontend pyörii eri portissa (Vite) → salli cookie-CORS.
  if (!isProd) {
    app.use(
      cors({
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true,
      })
    );
  }

  // Terveystarkistus.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/locations', locationsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/movements', movementsRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/reports', reportsRouter);

  // Tuntematon API-reitti → 404 JSON (ei SPA-fallback).
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ei löydy' }));

  // Tarjoile buildattu frontend samasta portista.
  const staticDir = [
    path.resolve(__dirname, '../../public'), // dist/src -> backend/public
    path.resolve(__dirname, '../public'),
    path.resolve(process.cwd(), 'public'),
  ].find((d) => fs.existsSync(d));

  if (staticDir) {
    app.use(express.static(staticDir));
    // SPA-fallback: kaikki muut GET-pyynnöt → index.html.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    console.warn('Frontend build -kansiota ei löytynyt (public/). API toimii silti.');
  }

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`Catering-backend käynnissä portissa ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Käynnistys epäonnistui:', err);
  pool.end().finally(() => process.exit(1));
});
