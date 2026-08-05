-- 003_event_metrics.sql — tapahtuman mitat kulutusennustetta varten.
-- Menekki suhteutetaan orgien määrään (ja halutessa tapahtuman kestoon), jotta
-- tulevan tapahtuman tarve voidaan arvioida aiempien tapahtumien kulutuksesta.

ALTER TABLE events ADD COLUMN IF NOT EXISTS org_count INT;  -- orgien (henkilöiden) määrä
ALTER TABLE events ADD COLUMN IF NOT EXISTS days INT;       -- kesto päivinä, käsin syötetty

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_org_count_positive;
ALTER TABLE events ADD CONSTRAINT events_org_count_positive
  CHECK (org_count IS NULL OR org_count > 0);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_days_positive;
ALTER TABLE events ADD CONSTRAINT events_days_positive
  CHECK (days IS NULL OR (days > 0 AND days <= 365));

-- Tapahtuman efektiiviset mitat. Kesto: käsin syötetty > päivämääräväli >
-- kulutuskirjausten eri päivien määrä > 1. Näin vanhoillekin tapahtumille saadaan
-- järkevä kesto ilman käsityötä.
CREATE OR REPLACE VIEW event_metrics AS
SELECT
  e.id AS event_id,
  e.org_count,
  e.days AS days_manual,
  COALESCE(
    e.days,
    CASE
      WHEN e.starts_at IS NOT NULL AND e.ends_at IS NOT NULL
      THEN GREATEST(
        1,
        (date(e.ends_at AT TIME ZONE 'Europe/Helsinki')
         - date(e.starts_at AT TIME ZONE 'Europe/Helsinki')) + 1
      )
    END,
    NULLIF((
      SELECT COUNT(DISTINCT date(m.created_at AT TIME ZONE 'Europe/Helsinki'))
      FROM movements m
      WHERE m.event_id = e.id AND m.voided = FALSE AND m.type = 'kulutus'
    ), 0),
    1
  )::int AS days_effective
FROM events e;
