-- 004_movement_import.sql — historiatuonti.
-- Menneiden tapahtumien kulutus (esim. vanhat Excel-taulukot) tuodaan lokiin
-- päivätasolla. Tuontierä merkitään, jotta virheellisen tuonnin voi perua kerralla.

ALTER TABLE movements ADD COLUMN IF NOT EXISTS import_batch TEXT;

CREATE INDEX IF NOT EXISTS idx_mov_import ON movements(import_batch)
  WHERE import_batch IS NOT NULL;
