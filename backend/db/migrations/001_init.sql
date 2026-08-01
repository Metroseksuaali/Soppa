-- 001_init.sql — Catering-inventaario perusskeema
-- Ajetaan idempotentisti käynnistyksessä (schema_migrations hoitaa versioinnin).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);
-- Vain yksi tapahtuma aktiivisena kerrallaan:
CREATE UNIQUE INDEX IF NOT EXISTS one_active_event ON events (active) WHERE active;

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sijainti' CHECK (kind IN ('varasto','sijainti')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ruoka','tavara','kaluste')),
  unit TEXT NOT NULL,              -- laskentayksikkö: 'pkt','kpl','l','kg'
  pack_size NUMERIC(12,4),         -- valinnainen: sekundääriyksikköä per 1 unit (esim. 0.167)
  pack_unit TEXT,                  -- valinnainen: 'kg','l'
  returnable BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  -- barcode TEXT,                 -- mahdollinen tuleva laajennus, ei toteuteta tässä versiossa
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS movements (
  id BIGSERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES items(id),
  type TEXT NOT NULL CHECK (type IN ('lisays','vienti','palautus','kulutus','inventointi')),
  quantity NUMERIC(12,3) NOT NULL, -- laskentayksikössä; inventoinnissa etumerkillinen korjausdelta
  counted NUMERIC(12,3),           -- vain inventointi: laskettu absoluuttinen määrä (audit)
  location_id INT REFERENCES locations(id), -- vienti/palautus: kohde; kulutus: valinnainen
  event_id INT REFERENCES events(id),
  user_id INT NOT NULL REFERENCES users(id),
  note TEXT,
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  voids_id BIGINT REFERENCES movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_item    ON movements(item_id);
CREATE INDEX IF NOT EXISTS idx_mov_event   ON movements(event_id);
CREATE INDEX IF NOT EXISTS idx_mov_type    ON movements(type);
CREATE INDEX IF NOT EXISTS idx_mov_created ON movements(created_at);
CREATE INDEX IF NOT EXISTS idx_mov_loc     ON movements(location_id);

-- Varastosaldo = lokin etumerkillinen summa.
CREATE OR REPLACE VIEW varasto_stock AS
SELECT i.id AS item_id,
  COALESCE(SUM(CASE m.type
    WHEN 'lisays'      THEN m.quantity
    WHEN 'palautus'    THEN m.quantity
    WHEN 'inventointi' THEN m.quantity
    WHEN 'vienti'      THEN -m.quantity
    WHEN 'kulutus'     THEN -m.quantity
  END), 0) AS qty
FROM items i
LEFT JOIN movements m ON m.item_id = i.id AND m.voided = FALSE
GROUP BY i.id;

-- Paljonko palautuvaa tuotetta on juuri nyt ulkona kussakin sijainnissa:
CREATE OR REPLACE VIEW location_stock AS
SELECT m.item_id, m.location_id,
  COALESCE(SUM(CASE m.type WHEN 'vienti' THEN m.quantity
                           WHEN 'palautus' THEN -m.quantity END), 0) AS qty
FROM movements m
WHERE m.voided = FALSE AND m.location_id IS NOT NULL
  AND m.type IN ('vienti','palautus')
GROUP BY m.item_id, m.location_id;
