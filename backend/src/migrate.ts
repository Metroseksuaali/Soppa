import fs from 'fs';
import path from 'path';
import { pool } from './db';

// Ajaa numeroidut SQL-migraatiot idempotentisti. schema_migrations pitää kirjaa ajetuista.
export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Migraatiokansio: sekä lähdekoodissa (db/migrations) että buildatussa kuvassa.
  const candidates = [
    path.resolve(__dirname, '../../db/migrations'), // dist/src -> backend/db/migrations
    path.resolve(__dirname, '../db/migrations'),
    path.resolve(process.cwd(), 'db/migrations'),
  ];
  const dir = candidates.find((d) => fs.existsSync(d));
  if (!dir) {
    throw new Error('Migraatiokansiota ei löytynyt: ' + candidates.join(', '));
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    (await pool.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Migraatio ajettu: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Migraatio epäonnistui: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('Migraatiot valmiit.');
}
