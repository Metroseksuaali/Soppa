-- 002_item_photos.sql — havainnollistava valokuva per tuote
--
-- Yksi kuva per tuote (item_id on pääavain). Kuva säilötään tietokantaan, jolloin
-- olemassa oleva pg_dump-varmuuskopio (scripts/backup.sh) kattaa myös kuvat eikä
-- uutta levyvolyymiä tarvita.
--
-- Kokorajoitus hoidetaan kahdella tasolla: selain pienentää kuvan ennen lähetystä
-- (frontend/src/lib/image.ts) ja backend hylkää liian ison tavumäärän (routes/items.ts).
-- CHECK-rajat tässä ovat viimeinen suoja, jotta taulu ei voi kasvaa hallitsemattomasti.

CREATE TABLE IF NOT EXISTS item_photos (
  item_id    INT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL CHECK (mime IN ('image/webp','image/jpeg')),
  -- Näyttökuva (pitkä sivu enintään ~1024 px) ja listojen pikkukuva (~256 px).
  data       BYTEA NOT NULL CHECK (octet_length(data)  <= 400000),
  thumb      BYTEA NOT NULL CHECK (octet_length(thumb) <=  60000),
  width      INT,
  height     INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INT REFERENCES users(id)
);
