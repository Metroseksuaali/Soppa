# Catering-inventaario — toteutusmäärittely (SPEC)

> **Toteuttavalle AI:lle:** Tämä on täydellinen määrittely. Rakenna koko sovellus tämän
> mukaan yhdellä kertaa: tietokanta, backend-API, React-frontend, Docker-paketti ja
> seed-data. Noudata skeemaa ja endpoint-sopimuksia kirjaimellisesti. Oletukset on lyöty
> lukkoon kohdassa "Lukitut oletukset" — älä kysy niistä. Kun valmis, sovellus käynnistyy
> komennolla `docker compose up -d` ja läpäisee kohdan "Hyväksymiskriteerit".

---

## 1. Yleiskuvaus

Web-sovellus catering-tiimille tapahtumassa Assembly. Korvaa nykyisen Google
Sheets -seurannan. Käyttö pääasiassa puhelimella. Julkaistaan julkisena verkkopalveluna
kirjautumisen takana (HTTPS). Idea on niin että jokaiseen eventtiin avataan uusi tili jota catering tiimi käyttää. Tilin määrittää aina tapahtumaan admin esikseen. 

Malli on tarkoituksella yksinkertainen: **varasto on oletus**, ja siihen kohdistuu neljä
toimintoa (lisäys, vienti, kulutus, inventointi). Jokainen toiminto kirjautuu lokiin,
josta lasketaan varastosaldo ja josta saadaan tapahtuma- ja päiväkohtaiset raportit.

Kolme tuotekategoriaa: **Ruoka**, **Tavara**, **Kalusteet** — pelkkä suodatin, ei
erillistä logiikkaa.

## 2. Reunaehdot

- **Online-only.** Alle 100 tuotetta, pieni tiimi. Postgres riittää helposti; ei
  erikoisoptimointeja.
- **Ajoympäristö:** yksi Docker-host, julkinen domain + HTTPS, koko sovellus login-seinän
  takana. Tyypillisesti VPS; sama paketti pyörii myös lähiverkossa.
- **Kieli:** käyttöliittymä suomeksi.

## 3. Ydinmalli

### 3.1 Varasto ja saldo
Jokaisella tuotteella on varastosaldo. Saldoa **ei tallenneta erillisenä lukuna** vaan se
lasketaan lokista (summa). Näin jokaisesta muutoksesta jää jälki (kuka, mitä, milloin,
mihin tapahtumaan) ja raportit ovat pelkkää lokin suodatusta.

### 3.2 Neljä toimintoa
- **Lisäys (+):** tavaraa tulee varastoon. Varastosaldo kasvaa.
- **Vienti:** tavara varastosta **sijaintiin** (esim. "Päälava", "Kids", "Combobase", ). Vain
  palautuville tuotteille. Varastosaldo laskee, sijainnin saldo kasvaa.
- **Palautus:** tavara sijainnista takaisin varastoon. Varastosaldo kasvaa, sijainnin
  laskee.
- **Kulutus (−):** tavara poistuu pysyvästi (kertakäyttöastiat, elintarvikkeet).
  Varastosaldo laskee eikä palaa. Voi pitää merkitä sijainti (missä käytettiin)
  raporttia varten.
- **Inventointi:** lasketaan fyysinen määrä; saldo korjataan siihen ja erotus kirjautuu.
  Voi tehdä milloin vain (esim. tapahtuman alussa) — ei pakollinen portti.

### 3.3 Palautuva vs. kuluva = tuotteen ominaisuus
Tuotteella on `returnable`-lippu. Kalusteet ja kiinteä tavara (kulhot, kanisterit) →
palautuvia (vienti/palautus). Elintarvikkeet ja kertakäyttötavara → kuluvia (kulutus).
Valinta tehdään **kerran tuotetta luodessa**, ei joka kirjauksessa. Pitää myös ottaa huomioon että kiinteiden astioiden tai kalusteiden mennessä mahdollisesti rikki niin saldoa pitää silti pystyä vähentämään.

### 3.4 Kaksoisyksikkö
Tuotteella on laskentayksikkö ja valinnainen pakkauskoko. Esim. Leipä: `unit='pkt'`,
`pack_size=0.167`, `pack_unit='kg'`. Raportit näyttävät molemmat: "12 pkt (2,0 kg)".
Jos `pack_size` puuttuu, näytetään vain laskentayksikkö.

### 3.5 Tapahtumat
Kevyt: tapahtumalla on nimi ja aktiivisuustila. Yksi tapahtuma on aktiivinen kerrallaan,
ja uudet kirjaukset leimataan siihen. Varastosaldo on **jatkuva** tapahtumien yli (ei
nollausta). Tuote joka ei enää palaa käyttöön (esim. sponsorin lahjoittama juusto)
hoidetaan **arkistoimalla** se, kun sitä ei enää tarvita — ei erillistä mekanismia.

## 4. Teknologiapino (lukittu)

- **Backend:** Node.js 20 + TypeScript + Express. Postgres-ajuri `pg` (suora SQL, ei
  ORM:ää). `bcrypt` salasanoille, JWT httpOnly-cookiessa, `zod` validointiin, `helmet`.
- **Tietokanta:** PostgreSQL 16.
- **Frontend:** React 18 + TypeScript + Vite. `react-router-dom`, Tailwind CSS,
  `@tanstack/react-query`. Mobile-first. Web-manifest + `vite-plugin-pwa` (kotinäyttöön).
- **Paketointi:** Docker + docker-compose. Backend tarjoilee API:n (`/api/*`) ja
  buildatun frontendin samasta portista. Caddy reverse proxy + automaattinen TLS.
- **Migraatiot:** numeroidut SQL-tiedostot `db/migrations/NNN_*.sql`, ajetaan
  käynnistyksessä idempotentisti (`schema_migrations`-taulu).

Projektirakenne:
```
/ (repo-juuri = O:\vibecode\Catering)
  docker-compose.yml   .env.example   README.md
  backend/  (package.json, tsconfig.json, Dockerfile, src/, db/migrations/, db/seed.ts)
  frontend/ (package.json, tsconfig.json, vite.config.ts, index.html, src/)
  scripts/  (backup.sh, restore.sh)
```

## 5. Tietokantaskeema

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);
-- Vain yksi tapahtuma aktiivisena kerrallaan:
CREATE UNIQUE INDEX one_active_event ON events (active) WHERE active;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sijainti' CHECK (kind IN ('varasto','sijainti')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);

CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ruoka','tavara','kaluste')),
  unit TEXT NOT NULL,              -- laskentayksikkö: 'pkt','kpl','l','kg'
  pack_size NUMERIC(12,4),         -- valinnainen: sekundääriyksikköä per 1 unit (esim. 0.167)
  pack_unit TEXT,                  -- valinnainen: 'kg','l'
  returnable BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT REFERENCES users(id)
);

CREATE TABLE movements (
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
CREATE INDEX idx_mov_item    ON movements(item_id);
CREATE INDEX idx_mov_event   ON movements(event_id);
CREATE INDEX idx_mov_type    ON movements(type);
CREATE INDEX idx_mov_created ON movements(created_at);
CREATE INDEX idx_mov_loc     ON movements(location_id);

CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 6. Saldon laskenta (näkymät)

Varastosaldo = lokin etumerkillinen summa. Etumerkit tyypeittäin: `lisays` +, `palautus`
+, `inventointi` + (delta jo etumerkillinen), `vienti` −, `kulutus` −.

```sql
CREATE VIEW varasto_stock AS
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
CREATE VIEW location_stock AS
SELECT m.item_id, m.location_id,
  COALESCE(SUM(CASE m.type WHEN 'vienti' THEN m.quantity
                           WHEN 'palautus' THEN -m.quantity END), 0) AS qty
FROM movements m
WHERE m.voided = FALSE AND m.location_id IS NOT NULL
  AND m.type IN ('vienti','palautus')
GROUP BY m.item_id, m.location_id;
```

## 7. Toimintotyypit

| type          | Vaikutus varastoon | location_id | Rajoite |
|---------------|--------------------|-------------|---------|
| `lisays`      | + quantity         | –           | – |
| `vienti`      | − quantity         | pakollinen (sijainti) | vain `returnable=true` |
| `palautus`    | + quantity         | pakollinen (sijainti) | vain `returnable=true` |
| `kulutus`     | − quantity         | valinnainen | – |
| `inventointi` | + delta            | –           | delta = counted − nykysaldo |

Inventoinnissa backend laskee nykysaldon, `delta = counted − nykysaldo`, ja tallentaa
rivin jossa `quantity = delta` (voi olla negatiivinen) ja `counted` = laskettu luku.

## 8. API-endpointit

Kaikki JSON, autentikointi cookiessa. Virheet `{ error }` + HTTP-koodi.

**Auth**
- `POST /api/auth/login { username, password }` · `POST /api/auth/logout` · `GET /api/auth/me`

**Käyttäjät** (admin)
- `GET /api/users` · `POST /api/users {username,password,display_name,is_admin}`
- `PATCH /api/users/:id {display_name?,is_admin?,active?,password?}`

**Tuotteet**
- `GET /api/items?category=&archived=false&q=` → tuotteet + varastosaldo (varasto_stock)
- `POST /api/items {name,category,unit,pack_size?,pack_unit?,returnable,note?}`
- `PATCH /api/items/:id {name?,unit?,pack_size?,pack_unit?,returnable?,note?}`
- `POST /api/items/:id/archive` · `POST /api/items/:id/unarchive`
- `GET /api/items/:id` → tiedot + varastosaldo + sijaintijakauma (palautuvat) + historia

**Sijainnit**
- `GET /api/locations?active=true` · `POST /api/locations {name}` (kind='sijainti')
- `PATCH /api/locations/:id {name?,active?}`

**Tapahtumat**
- `GET /api/events` · `GET /api/events/active` · `POST /api/events {name}`
- `PATCH /api/events/:id {name?,active?}` (active=true → tekee tästä ainoan aktiivisen)
- `POST /api/events/:id/close` (asettaa ends_at, active=false)

**Kirjaukset** (loki). Jokainen leimataan aktiiviseen tapahtumaan (event_id) ja käyttäjään.
- `POST /api/movements/add       {item_id, quantity, note?}`
- `POST /api/movements/deploy    {item_id, location_id, quantity, note?}`  (vienti; vaatii returnable)
- `POST /api/movements/return    {item_id, location_id, quantity, note?}`  (palautus; vaatii returnable)
- `POST /api/movements/consume   {item_id, quantity, location_id?, note?}` (kulutus)
- `POST /api/movements/inventory {item_id, counted, note?}`                (inventointi; laskee deltan)
- `GET  /api/movements?event_id=&item_id=&type=&location_id=&from=&to=&limit=&offset=` → loki, uusin ensin
- `POST /api/movements/:id/void` → merkitsee rivin `voided=true` (poistaa sen vaikutuksen saldosta)

**Saldot & raportit** (§11)
- `GET /api/stock` → varastosaldo per tuote (+ pack_size → sekundäärimäärä)
- `GET /api/events/:id/report?group_by=day` → tapahtuman yhteenveto + päiväkohtainen kulutus
- `GET /api/reports/consumption?event_id=&date=&item_id=&category=` → kulutus (kpl + paino)

**Validointi:** `deploy`/`return` vain kun `returnable=true` (muuten 400). `vienti`,
`kulutus` eivät saa viedä varastosaldoa negatiiviseksi (409). `return` ei saa palauttaa
enempää kuin sijainnissa on ulkona (409).

## 9. Autentikointi & tietoturva

- Käyttäjätunnus + salasana (bcrypt cost ≥ 12). JWT httpOnly-cookiessa (30 pv).
- **Flat-oikeudet:** kaikki kirjautuneet saavat kirjata ja korjata (void) kenen tahansa
  kirjauksia. Audit-loki (`user_id` joka rivissä) antaa jäljitettävyyden.
- **Admin** lisäksi: käyttäjähallinta.
- Julkinen näkyvyys: cookie `Secure`+`SameSite=Lax`, login-rate limit (5/15min/IP), ei
  julkista rekisteröitymistä, `helmet`, http→https. Postgres vain sisäverkossa (ei porttia
  ulos). Kaikki `/api/*` (paitsi login) vaatii cookien.

## 10. Frontend — näkymät

Mobile-first, isot napit, suomeksi. Alapalkki: Etusivu / Inventaario / Kirjaa / Raportit.

1. **Kirjautuminen.**
2. **Etusivu:** aktiivinen tapahtuma + pikanapit (Lisää / Vie / Palauta / Kuluta /
   Inventoi).
3. **Inventaario:** tuotelista varastosaldoineen, välilehdet Ruoka/Tavara/Kalusteet, haku.
   Tuotenäkymä: varastosaldo, montako ulkona (palautuvat, per sijainti), historia,
   muokkaa/arkistoi.
4. **Kirjaa (nopea vuo):** valitse tuote → toiminto → määrä (+ sijainti kun vienti/palautus)
   → vahvista. Muistaa viimeksi käytetyn sijainnin oletuksena.
5. **Sijainnit:** listaa/luo/piilota sijainteja.
6. **Tapahtumat:** luo, aseta aktiiviseksi, sulje.
7. **Raportit:** tapahtumavalinta → yhteenveto per tuote + päiväkohtainen kulutus; näyttää
   sekä laskentayksikön että painon. Vienti CSV:nä.
8. **Käyttäjät** (admin).

UX: negatiivista saldoa ei sallita — selkeä virhe. Määrät sallivat desimaalit. Inventointi
näyttää nykysaldon esitäytettynä, käyttäjä korjaa lasketun luvun.

## 11. Raportit

Kaikki raportit ovat lokin (`movements`) suodatusta ja summausta. Päiväryhmittely käyttää
aikavyöhykettä **Europe/Helsinki**: `date(created_at AT TIME ZONE 'Europe/Helsinki')`.
Vain `voided = FALSE` rivit lasketaan.

**Kulutus per tuote per päivä** — ydinraportti. Esim. "päivänä X Leivän kulutus 12 pkt":
```sql
SELECT date(m.created_at AT TIME ZONE 'Europe/Helsinki') AS pvm,
       i.name, i.unit, i.pack_size, i.pack_unit,
       SUM(m.quantity) AS maara_unit,
       SUM(m.quantity) * i.pack_size AS maara_sekundaari
FROM movements m JOIN items i ON i.id = m.item_id
WHERE m.type = 'kulutus' AND m.voided = FALSE
  AND m.event_id = $1              -- valinnainen tapahtumasuodatus
GROUP BY pvm, i.id
ORDER BY pvm, i.name;
```
→ näytetään "12 pkt (2,0 kg)". Sama kaava ilman `event_id`-ehtoa antaa koko historian.

**Tapahtuman yhteenveto** (`GET /api/events/:id/report`): per tuote lisätty (Σ lisays),
kulutettu (Σ kulutus), ulkona nyt (location_stock summa), varastosaldo nyt. `group_by=day`
lisää päiväkohtaisen kulutuserittelyn yllä olevalla kaavalla.

## 12. Julkaisu

`docker-compose.yml` — palvelut:
- `db`: postgres:16, volume `pgdata`, **ei porttia ulos**.
- `app`: buildaa backendin + frontendin, ajaa migraatiot + seedin käynnistyksessä,
  tarjoilee portista 8080 (ei suoraan internetiin).
- `caddy`: portit 80/443, automaattinen Let's Encrypt -TLS domainille, http→https, proxy
  → `app:8080`. Ainoa julkisesti avoin palvelu.

`.env.example`:
```
POSTGRES_USER=catering
POSTGRES_PASSWORD=vaihda_tama
POSTGRES_DB=catering
DATABASE_URL=postgres://catering:vaihda_tama@db:5432/catering
JWT_SECRET=vaihda_tama_pitka_satunnainen
ADMIN_USERNAME=admin
ADMIN_PASSWORD=vaihda_tama
APP_PORT=8080
DOMAIN=catering.esimerkki.fi
ACME_EMAIL=oma@sposti.fi
```

Käynnistys: (1) odota db, (2) aja migraatiot, (3) aja seed (idempotentti), (4) käynnistä
palvelin. `scripts/backup.sh` = `pg_dump` → aikaleimattu `.sql.gz`; READMEen ohje
ajastetusta (cron) varmuuskopiosta.

## 13. Seed-data (idempotentti)

Luo jos ei ole: admin-käyttäjä (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) ja **Varasto**-sijainti
(`kind='varasto'`). Ei muita pakollisia rivejä.

## 14. Ei kuulu tähän versioon

Offline-tila, viivakoodit, useampi varasto, toimittaja-/hinta-/kustannushallinta,
monikielisyys, ennusteet. (Jätä `items`-tauluun kommentti mahdollisesta `barcode`-
sarakkeesta, mutta älä toteuta.)

## 15. Hyväksymiskriteerit

1. `docker compose up -d` nostaa sovelluksen; migraatiot + seed ajetaan; admin kirjautuu.
2. Voi luoda tuotteen (kaikki kolme kategoriaa, kaksoisyksikkö) ja se näkyy oikealla
   välilehdellä varastosaldoineen.
3. **Lisäys** kasvattaa varastosaldoa; **kulutus** pienentää; saldo lasketaan lokista.
4. **Palautuva** tuote: vienti sijaintiin pienentää varastoa ja kasvattaa sijainnin saldoa;
   palautus palauttaa. Kuluvaa tuotetta ei voi viedä (400).
5. Varastosaldoa ei voi viedä negatiiviseksi viennillä/kulutuksella (409).
6. **Inventointi:** annettu laskettu luku korjaa varastosaldon täsmälleen siihen; erotus
   näkyy lokissa (`quantity`=delta, `counted`=laskettu).
7. Väärän kirjauksen voi korjata `void`illa: saldo palautuu, molemmat näkyvät lokissa.
8. **Raportti** antaa tapahtuma- ja päiväkohtaisen kulutuksen per tuote sekä laskenta-
   yksikössä että painossa (esim. "12 pkt (2,0 kg)").
9. Audit-loki näyttää jokaisesta kirjauksesta kuka, mitä, milloin, tyyppi, sijainti,
   tapahtuma.

## 16. Lukitut oletukset (toteuta näin)

- Varasto on oletussijainti; saldo lasketaan lokista, ei tallenneta lukuna.
- Palautuva vs. kuluva on **tuotteen** ominaisuus (`returnable`), valitaan tuotetta
  luodessa.
- Kulutus poistaa pysyvästi; sijainti on kulutuksessa vain valinnainen raporttimerkintä.
- Inventointi on vapaaehtoinen toiminto milloin vain, ei pakollinen portti.
- Yksi varasto, yksi aktiivinen tapahtuma kerrallaan. Varastosaldo jatkuu tapahtumien yli.
- Kertaluontoinen tuote (esim. sponsorituote) hoidetaan arkistoimalla, ei erillismekanismilla.
- Päiväryhmittely aikavyöhykkeellä Europe/Helsinki.
