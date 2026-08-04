# CLAUDE.md

Ohjeistus Claude Codelle (ja kehittäjille) tässä repossa työskentelyyn. Lue tämä ennen
muutosten tekemistä. Tarkka toteutusmäärittely on [SPEC.md](SPEC.md) — se on totuuden lähde
domain-säännöille.

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
| Frontend | React 18 + TypeScript + Vite, react-router-dom, Tailwind, TanStack Query, PWA |
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
    reports.ts             buildEventReport(), consumptionReport() — SQL-summauksia
    routes/                auth, users, items, locations, events, movements, reports(+stock)
  db/
    migrations/001_init.sql  Skeema + varasto_stock / location_stock -näkymät
    migrations/002_item_photos.sql  Tuotekuvat (item_photos)
    seed.ts                  Idempotentti: admin-käyttäjä + Varasto-sijainti
frontend/
  src/
    i18n.ts                *** KAIKKI UI-tekstit täällä *** (ks. alla)
    api.ts                 fetch-kääre (credentials: include) + TS-tyypit + photoUrl()
    auth.tsx               AuthProvider / useAuth (react-query /auth/me)
    App.tsx                Reititys + Protected-wrapper
    components/            Layout (alapalkki+yläpalkki), ui (Spinner/Modal/chipit),
                           ItemPhoto (tuotekuvan otto/näyttö + ItemThumb)
    lib/format.ts          Numeroiden, päivämäärien ja kaksoisyksikön muotoilu
    lib/image.ts           Kuvan pienennys ja pakkaus selaimessa ennen lähetystä
    pages/                 Login, Home, Inventory, ItemDetail, Log, Locations, LocationDetail,
                           Events, Reports, Users
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
- **Oikeudet:** flat — kaikki kirjautuneet voivat kirjata ja perua (void). Vain admin:
  käyttäjähallinta (`/api/users`). Audit-loki (`user_id` joka rivillä) antaa jäljitettävyyden.
- **Raporttien aikavyöhyke:** päiväryhmittely `Europe/Helsinki`
  (`date(created_at AT TIME ZONE 'Europe/Helsinki')`). Vain `voided=FALSE` lasketaan.

## Muutosten jälkeen

- Backend: `cd backend && npm run build` (tsc) läpäistävä.
- Frontend: `cd frontend && npm run build` (tsc + vite) läpäistävä.
- Live-instanssin päivitys: `docker compose ... up -d --build app` (data säilyy `pgdata`-volumessa).

## Ei kuulu tähän versioon

Offline-tila, viivakoodit, useampi varasto, toimittaja-/hinta-/kustannushallinta, ennusteet.
`items`-tauluun on jätetty kommentti mahdollisesta `barcode`-sarakkeesta — ei toteuteta.
