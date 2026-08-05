-- 005_item_groups.sql — tuoteryhmät ja sponsorimerkintä.
--
-- Tuoteryhmä ("Juusto", "Leikkele (kana)") kokoaa brändit ja pakkauskoot yhteen:
-- ennusteessa merkitsee tarve, ei se kenen leipää sattui olemaan hyllyssä.
-- Ryhmällä on perusyksikkö, johon tuotteen määrä muunnetaan pakkauskoon avulla.
--
-- Sponsorius kiinnitetään *kirjaukseen*, ei tuotteeseen: sama juusto voi olla
-- yhtenä vuonna lahjoitus ja toisena ostettu. Kulutus (ja siten ennuste) on
-- riippumaton siitä kuka tavaran maksoi — sponsorius kertoo vain mistä se tuli.

CREATE TABLE IF NOT EXISTS item_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  -- Perusyksikkö on vapaa teksti kuten items.unit: 'kg', 'l', 'kpl', 'pkt', 'prk'…
  -- Ryhmä toimii kun jäsentuotteen oma yksikkö tai pakkausyksikkö on tämä.
  base_unit TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS item_groups_name_uniq ON item_groups (lower(name));

ALTER TABLE items ADD COLUMN IF NOT EXISTS group_id INT REFERENCES item_groups(id);
CREATE INDEX IF NOT EXISTS idx_items_group ON items(group_id);

ALTER TABLE movements ADD COLUMN IF NOT EXISTS sponsored BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_mov_sponsored ON movements(sponsored) WHERE sponsored;

-- Tuotteen määrän muunnoskerroin ryhmän perusyksikköön.
-- NULL = tuote ei ole yhteismitallinen ryhmän kanssa (puuttuva tai eri pakkausyksikkö),
-- jolloin se jätetään ryhmäsummasta pois ja siitä huomautetaan käyttöliittymässä.
CREATE OR REPLACE VIEW item_group_factor AS
SELECT i.id AS item_id,
       g.id AS group_id,
       g.name AS group_name,
       g.base_unit,
       CASE
         WHEN i.unit = g.base_unit THEN 1::numeric
         WHEN i.pack_unit = g.base_unit AND i.pack_size IS NOT NULL THEN i.pack_size
       END AS factor
FROM items i
JOIN item_groups g ON g.id = i.group_id;
