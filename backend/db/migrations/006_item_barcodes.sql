-- 006_item_barcodes.sql — viivakoodit tuotteen löytämiseen.
--
-- Viivakoodi on *tunniste*, ei tuotteen ominaisuus: samalle tuotteelle kertyy helposti
-- useampi koodi (eri pakkauskoko, myyntierän oma koodi, vanha ja uusi EAN), ja koodi voi
-- siirtyä tuotteelta toiselle. Siksi oma taulu eikä sarake items-taulussa.
--
-- Koodi on pääavain: yksi koodi osoittaa aina täsmälleen yhteen tuotteeseen, jolloin
-- skannaus on yksiselitteinen haku eikä valintalista. Jos koodi on jo toisella tuotteella,
-- API vastaa 409:llä ja kertoo kummalla — hiljaista siirtoa ei tehdä.
--
-- Viivakoodi ei vaikuta saldoon, lokiin eikä raportteihin. Se on vain nopeampi tapa
-- löytää oikea tuote kuin nimen selaaminen.

CREATE TABLE IF NOT EXISTS item_barcodes (
  -- Normalisoitu API:ssa: välit pois, isot kirjaimet. EAN-13, EAN-8, UPC, Code 128…
  code TEXT PRIMARY KEY,
  item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_item_barcodes_item ON item_barcodes(item_id);
