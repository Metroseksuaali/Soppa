# CLAUDE.md

Ohjeistus Claude Codelle (ja kehittäjille) tässä repossa työskentelyyn. Lue tämä ennen
muutosten tekemistä. Tarkka toteutusmäärittely on [SPEC.md](SPEC.md) — se on totuuden lähde
domain-säännöille, ja [DESIGN.md](DESIGN.md) on totuuden lähde ulkoasulle (värit, tiheys,
komponenttiluokat). Lue DESIGN.md ennen kuin kosket tyyleihin.

## Mikä tämä on

Catering-tiimin varastonhallinta tapahtumiin (korvaa Google Sheets -seurannan). Mobile-first
web-sovellus, suomenkielinen, kirjautumisen takana. Jokaiseen tapahtumaan luodaan oma tili,
jonka admin määrittää etukäteen.

**Ydinperiaate:** varastosaldoa **ei tallenneta lukuna** — se lasketaan aina liikeloki­sta
(`movements`) etumerkillisenä summana. Jokainen muutos jättää jäljen (kuka, mitä, milloin,
mihin tapahtumaan), ja raportit ovat pelkkää lokin suodatusta.

## Teknologiapino

| Kerros | Teknologia |
|--------|-----------|
| Backend | Node 20 + TypeScript + Express, `pg` (suora SQL, ei ORM:ää), `bcrypt`, JWT httpOnly-cookiessa, `zod`, `helmet` |
| Tietokanta | PostgreSQL 16 |
| Frontend | React 18 + TypeScript + Vite, react-router-dom, Tailwind, TanStack Query, PWA, `zxing-wasm` (vain viivakoodin varalukija, ladataan dynaamisesti) |
| Paketointi | Docker Compose; backend tarjoilee API:n + buildatun frontendin samasta portista; Caddy = reverse proxy + automaattinen TLS |

## Repo-rakenne

```
docker-compose.yml         Tuotantopino: db + app + caddy
docker-compose.local.yml   Paikallistesti: julkaisee app-portin, ei Caddyä
Caddyfile                  Reverse proxy + Let's Encrypt TLS
.env.example               Ympäristömuuttujien malli (kopioi -> .env)
backend/
  Dockerfile               Monivaihe: buildaa frontendin + backendin, tarjoilee molemmat
  src/
    index.ts               Käynnistys: waitForDb -> migraatiot -> seed -> Express + staattinen frontend
    config.ts              Ympäristömuuttujat
    db.ts                  pg Pool, query(), withTx(), waitForDb(); NUMERIC luetaan numeroina
    migrate.ts             Numeroidut SQL-migraatiot, idempotentti (schema_migrations)
    auth.ts                JWT-cookie, requireAuth / requireAdmin -middlewaret
    util.ts                asyncHandler, HttpError, errorHandler ({ error }-muoto)
    reports.ts             buildEventReport(), consumptionReport(), forecastReport(),
                           totalsReport() — SQL-summauksia
    routes/                auth, users, items, groups, locations, events, movements, reports(+stock)
  db/
    migrations/001_init.sql  Skeema + varasto_stock / location_stock -näkymät
    migrations/002_item_photos.sql  Tuotekuvat (item_photos)
    migrations/003_event_metrics.sql Tapahtuman mitat (org_count, days) + event_metrics-näkymä
    migrations/004_movement_import.sql Historiatuonnin erätunniste (movements.import_batch)
    migrations/005_item_groups.sql  Tuoteryhmät + sponsorimerkintä + item_group_factor
    migrations/006_item_barcodes.sql Viivakoodit (item_barcodes)
    seed.ts                  Idempotentti: admin-käyttäjä + Varasto-sijainti
frontend/
  src/
    i18n.ts                *** KAIKKI UI-tekstit täällä *** (ks. alla)
    api.ts                 fetch-kääre (credentials: include) + TS-tyypit + photoUrl()
    auth.tsx               AuthProvider / useAuth (react-query /auth/me)
    App.tsx                Reititys + Protected-wrapper
    components/            Layout (alapalkki+yläpalkki), ui (Spinner/Modal/chipit),
                           ItemPhoto (tuotekuvan otto/näyttö + ItemThumb),
                           BarcodeScanner (kameraluku + käsin syöttö, ScanButton)
    lib/format.ts          Numeroiden, päivämäärien ja kaksoisyksikön muotoilu
    lib/image.ts           Kuvan pienennys ja pakkaus selaimessa ennen lähetystä
    lib/barcodeDecoder.ts  zxing-wasm-varalukija (dynaaminen lataus, itse tarjoiltu wasm)
    pages/                 Login, Home, Inventory, ItemDetail, Log, Locations, LocationDetail,
                           Events, Reports, Forecast (kulutusennuste),
                           Import (historiatuonti), Groups (tuoteryhmät), Users
    lib/importParse.ts     Liitetyn taulukon jäsennys tuontiriveiksi (päivä, määrä, tuotenimi)
scripts/                   backup.sh (pg_dump -> .sql.gz), restore.sh
```

## Domain-malli (lue tämä ennen kuin kosket movements-logiikkaan)

**Viisi kirjaustyyppiä** (`movements.type`), vaikutus varastosaldoon:

| Tyyppi | Varasto | location_id | Rajoite |
|--------|---------|-------------|---------|
| `lisays` | + | – | – |
| `vienti` | − | pakollinen (sijainti) | vain `returnable=true`; ei negatiiviseksi (409) |
| `palautus` | + | pakollinen (sijainti) | vain `returnable=true`; ei enempää kuin ulkona (409) |
| `kulutus` | − | valinnainen | ei negatiiviseksi (409) |
| `inventointi` | + delta | – | delta = counted − nykysaldo; `counted` talteen auditille |

- **Palautuva vs. kuluva** on **tuotteen** ominaisuus (`items.returnable`), valitaan tuotetta
  luodessa — ei joka kirjauksessa. Palautuvia viedään/palautetaan sijainteihin; kuluvat
  poistuvat pysyvästi kulutuksella. Rikkoutuneen astian voi vähentää kulutuksella.
- **Kaksoisyksikkö:** `unit` (laskentayksikkö) + valinnainen `pack_size` × `pack_unit`.
  Raportit näyttävät molemmat, esim. "12 pkt (2,0 kg)". Muotoilu: `fmtQty()` [lib/format.ts](frontend/src/lib/format.ts).
- **Tapahtumat:** yksi aktiivinen kerrallaan (`events.active` unique-partial-index). Uudet
  kirjaukset leimataan aktiiviseen tapahtumaan backendissä. Varastosaldo **jatkuu**
  tapahtumien yli (ei nollausta). Kertaluontoinen tuote hoidetaan **arkistoimalla**.
- **Void:** virheellisen kirjauksen voi perua (`voided=true`). Rivi jää lokiin näkyviin mutta
  poistuu saldolaskennasta. Kaikki saldo-SQL suodattaa `voided = FALSE`.
- **Tuotekuva:** yksi valinnainen valokuva per tuote (`item_photos`), pelkkä tunnistamisen
  apu — ei vaikuta saldoon eikä raportteihin. **Kuvaa ei koskaan kutista backend**: selain
  pienentää sen ennen lähetystä ([lib/image.ts](frontend/src/lib/image.ts)) 1024 px /
  ~150 kt näyttökuvaksi + 256 px pikkukuvaksi, ja backend vain torjuu ylisuuret
  (400 kt / 60 kt) sekä tarkistaa tyypin taikatavuista. Näin ei tarvita `sharp`-tyyppistä
  natiivikirjastoa. Kuvat ovat tietokannassa → `scripts/backup.sh` kattaa ne.
- **Sijaintinäkymä:** `GET /api/locations/:id` kertoo mitä sijainnissa on **juuri nyt ulkona**
  (`location_stock`, qty > 0) ja mitä siellä on **kulutettu** (rajattuna aktiiviseen tapahtumaan
  jos sellainen on, muuten koko historia). Näkymä ei tuo uutta dataa — se on olemassa olevan
  lokin suodatus. Palautus tehdään siitä samasta listasta rasti ruutuun, ja jokainen rastittu
  tuote kirjataan omana `POST /movements/return` -kutsunaan (normaalit rajoitteet pätevät).
- **Kulutusennuste:** tapahtumaan kirjataan `org_count` (orgien määrä) ja valinnainen
  `days`; `event_metrics`-näkymä päättelee puuttuvan keston (päivämääräväli → kulutus-
  kirjausten päivät → 1). Ennuste = Σ kulutus / Σ orgit (tai Σ orgi-päivät) × suunniteltu
  koko; ostettava = arvio − varastosaldo. Vain `kulutus`-tyyppi lasketaan menekiksi, ja
  vain tapahtumat joilla on `org_count`. Ennuste ei kirjaa mitään — se on lokin luku.
  Yksityiskohdat [SPEC.md](SPEC.md) §3.7.
- **Historiatuonti:** `POST /api/movements/import` on **ainoa** reitti joka kirjaa menneelle
  päivälle ja muuhun kuin aktiiviseen tapahtumaan (annettu päivä klo 12 Helsingin aikaa).
  Oletuksena jokaista tuotua kulutusta vastaa samanpäiväinen lisäys → nykysaldo ei muutu.
  Erä merkitään `movements.import_batch`iin, jolloin sen voi perua kerralla. Älä lisää
  päivämäärä-/tapahtumaparametreja tavallisiin kirjausreitteihin — invariantti "kirjaus
  menee aktiiviseen tapahtumaan nyt" pidetään voimassa. [SPEC.md](SPEC.md) §3.9.
- **Tuoteryhmä & sponsorius:** ryhmä (`items.group_id` → `item_groups`) yhdistää saman
  tarpeen eri brändit; ryhmän perusyksikköön muunnetaan `item_group_factor`-näkymällä
  (kerroin NULL = ei yhteismitallinen, jätetään summasta pois). Sponsorius on
  **kirjauksen** ominaisuus (`movements.sponsored`, vain `lisays`), ei tuotteen — sama
  tuote voi olla kerran lahjoitus ja kerran ostettu. Sponsoroitu tavara lasketaan
  ennusteeseen normaalisti; se näkyy erillisenä lukuna. [SPEC.md](SPEC.md) §3.8.
- **Viivakoodi:** vaihtoehtoinen tapa löytää tuote (`item_barcodes`, `code` on pääavain →
  yksi koodi osoittaa aina yhteen tuotteeseen; 409 jos koodi on jo toisella). Koodi ei
  kirjaa mitään eikä vaikuta saldoon — se korvaa vain nimellä etsimisen. Normalisointi
  (välit pois, isot kirjaimet) tehdään backendissä, jotta kamera, käsiskanneri ja käsin
  kirjoitus tuottavat saman avaimen. Kameraluvussa on **kaksi moottoria**: selaimen oma
  `BarcodeDetector` kun se löytyy (Android Chrome), muuten `zxing-wasm` dynaamisesti
  ladattuna (iOS-Safari, Firefox — iPhonessa kaikki selaimet ovat WebKitiä, joten omaa
  lukijaa ei ole). Wasm (~1 Mt) ladataan vasta kun skanneri avataan sellaisessa selaimessa,
  se tarjoillaan omasta `/assets`ista (ei CDN:ää) ja on jätetty PWA:n esilatauksen
  ulkopuolelle (`globIgnores`, [vite.config.ts](frontend/vite.config.ts)). Käsin syöttö on
  aina näkyvissä — älä piilota sitä fallbackiksi. [SPEC.md](SPEC.md) §3.10.
- **Saldon lasku:** näkymät `varasto_stock` ja `location_stock` [001_init.sql](backend/db/migrations/001_init.sql).
  Movements-reitit laskevat saldon transaktion sisällä uudelleen (rivilukitus `FOR UPDATE`),
  jotta rinnakkaiset kirjaukset eivät vie saldoa negatiiviseksi.

## UI-tekstien lokalisaatio

**Kaikki käyttöliittymässä näkyvät merkkijonot ovat [frontend/src/i18n.ts](frontend/src/i18n.ts):ssä.**
Älä kovakoodaa tekstiä komponentteihin. Käytä `import { t } from '../i18n'` ja viittaa esim.
`t.log.title`. Dynaamiset tekstit ovat funktioita: `t.home.welcome(name)`, `t.log.confirm(type)`.
Kategoriat (`t.categories`), kirjaustyypit (`t.movementTypes`) ja jaetut sanat (`t.common`)
ovat myös siellä. Sovellus on yksikielinen (suomi); rakenne on valmis monistettavaksi jos
tarvitaan lisää kieliä.

## Ulkoasu

Säännöt ovat [DESIGN.md](DESIGN.md):ssä; tässä vain tärkeimmät: värit tulevat **tokeneista**
([index.css](frontend/src/index.css) + [tailwind.config.js](frontend/tailwind.config.js)),
eli uusi koodi käyttää `bg-surface` / `text-fg` / `border-line` -tyyppisiä semanttisia
luokkia — **ei** `slate-*`-luokkia, heksavärejä eikä `dark:`-variantteja (tumma teema on
tokenien vaihto). Ilme on Assemblyn: violetti pääväri, teal tehoste, liukuväri vain
tunnuspinnoilla. `index.css`:n lopussa on väliaikainen `!important`-yhteensopivuuslohko
migroimattomille sivuille — sitä ei laajenneta.

## Ajaminen

**Tuotanto** (vaatii julkisen domainin + DNS:n Caddyn TLS:lle):
```bash
cp .env.example .env      # täytä salasanat, JWT_SECRET, DOMAIN, ACME_EMAIL
docker compose up -d
```
Käynnistys ajaa migraatiot + seedin automaattisesti. Kirjaudu `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

**Paikallinen testi** (ilman TLS:ää, portti 8080 selaimeen):
```bash
# .env: aseta COOKIE_SECURE=false ja DOMAIN=localhost
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d db app
```

**Kehitys** (hot reload): `cd backend && npm run dev` sekä `cd frontend && npm run dev`
(Vite portissa 5173 proxyttaa `/api` -> `localhost:8080`). Aseta backendille `COOKIE_SECURE=false`.

## Konventiot & sudenkuopat

- **Salaisuudet:** `.env` on `.gitignore`ssa — älä koskaan committaa sitä. Malliksi vain `.env.example`.
- **UTF-8:** Finnish ä/ö toimii (Express + Postgres UTF-8). Jos näet "Leip�" Windows-terminaalissa,
  se on vain konsolin koodisivun näyttöongelma, ei datan korruptio — selain renderöi oikein.
- **Cookie:** JWT httpOnly + `SameSite=Lax`. `COOKIE_SECURE=true` tuotannossa (HTTPS), `false`
  paikallisessa HTTP-testissä muuten cookie ei tallennu.
- **bcrypt:** Dockerfile käyttää `node:20-slim` (glibc), jotta bcrypt saa valmiit binäärit
  ilman kääntämistä. Älä vaihda `alpine`en ilman build-työkalujen lisäämistä.
- **Migraatiot:** vain lisää uusi `db/migrations/NNN_*.sql`; älä muokkaa jo ajettuja. Ne ajetaan
  aakkosjärjestyksessä transaktiossa ja kirjataan `schema_migrations`-tauluun.
- **Validointi:** kaikki bodyt `zod`illa reiteissä; virheet palautuvat `{ error }` + HTTP-koodi.
- **Runkoraja:** `express.json()` on oletusrajassa (100 kt) kaikkialla paitsi
  `PUT /api/items/:id/photo`, jolle [index.ts](backend/src/index.ts) antaa 1 Mt. Älä nosta
  globaalia rajaa — se on tarkoituksella tiukka.
- **Listan tila osoitteessa:** inventaarion välilehti ja haku ovat query-parametreissa
  (`/inventaario?cat=kaluste&q=mikro`, päivitys `replace: true` ettei historia täyty).
  Tuotelinkit kantavat parametrit mukanaan ja tuotesivun paluulinkki palauttaa ne. Älä
  siirrä näitä `useState`iin — silloin tuotteesta palaaminen pudottaa käyttäjän takaisin
  Ruoka-välilehdelle.
- **Reittien järjestys:** `GET /api/items/lookup` on rekisteröitävä ennen `GET /:id`:tä,
  muuten Express tulkitsee "lookup"in id:ksi. Sama pätee kaikkiin uusiin sanareitteihin.
- **Oikeudet:** flat — kaikki kirjautuneet voivat kirjata ja perua (void). Vain admin:
  käyttäjähallinta (`/api/users`). Audit-loki (`user_id` joka rivillä) antaa jäljitettävyyden.
- **Raporttien aikavyöhyke:** päiväryhmittely `Europe/Helsinki`
  (`date(created_at AT TIME ZONE 'Europe/Helsinki')`). Vain `voided=FALSE` lasketaan.

## Muutosten jälkeen

- Backend: `cd backend && npm run build` (tsc) läpäistävä.
- Frontend: `cd frontend && npm run build` (tsc + vite) läpäistävä.
- Live-instanssin päivitys: `docker compose ... up -d --build app` (data säilyy `pgdata`-volumessa).

## Ei kuulu tähän versioon

Offline-tila, useampi varasto, toimittaja-/hinta-/kustannushallinta.
Kulutusennuste on toteutettu, mutta pidetään yksinkertaisena: painotettu keskiarvo
valituista tapahtumista — ei tuoreuspainotusta eikä kausimallinnusta.
Viivakoodi on toteutettu vain hakutapana: ei ulkoisia tuotetietokantoja, ei omien
koodien generointia, ei skannauksesta suoraan syntyvää kirjausta.
