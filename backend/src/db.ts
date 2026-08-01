import { Pool, PoolClient } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

// Kaikki NUMERIC-sarakkeet luetaan JS-numeroina (pg palauttaa oletuksena stringinä).
import { types } from 'pg';
types.setTypeParser(1700, (val: string) => (val === null ? null : parseFloat(val)));

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const res = await pool.query(text, params);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

// Transaktioapuri: ajaa callbackin yhdessä transaktiossa ja peruu virheen sattuessa.
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Odota kunnes tietokantayhteys aukeaa (db-kontti voi olla vielä käynnistymässä).
export async function waitForDb(retries = 30, delayMs = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`Odotetaan tietokantaa (${i + 1}/${retries})… ${msg}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Tietokantaan ei saatu yhteyttä.');
}
