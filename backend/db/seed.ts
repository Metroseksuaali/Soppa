import bcrypt from 'bcrypt';
import { pool } from '../src/db';
import { config } from '../src/config';

// Idempotentti seed: luo admin-käyttäjän ja Varasto-sijainnin jos niitä ei ole.
export async function seed(): Promise<void> {
  // Admin-käyttäjä.
  const existingAdmin = await pool.query('SELECT id FROM users WHERE username = $1', [config.adminUsername]);
  if (existingAdmin.rowCount === 0) {
    const hash = await bcrypt.hash(config.adminPassword, 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, is_admin, active)
       VALUES ($1, $2, $3, TRUE, TRUE)`,
      [config.adminUsername, hash, 'Ylläpitäjä']
    );
    console.log(`Seed: admin-käyttäjä '${config.adminUsername}' luotu.`);
  } else {
    console.log(`Seed: admin-käyttäjä '${config.adminUsername}' on jo olemassa.`);
  }

  // Varasto-sijainti (kind='varasto').
  const existingVarasto = await pool.query("SELECT id FROM locations WHERE kind = 'varasto'");
  if (existingVarasto.rowCount === 0) {
    await pool.query("INSERT INTO locations (name, kind, active) VALUES ('Varasto', 'varasto', TRUE)");
    console.log('Seed: Varasto-sijainti luotu.');
  } else {
    console.log('Seed: Varasto-sijainti on jo olemassa.');
  }
}

// Salli myös suora ajo: `node dist/db/seed.js`.
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed valmis.');
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed epäonnistui:', err);
      process.exit(1);
    });
}
