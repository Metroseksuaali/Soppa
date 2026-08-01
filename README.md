# Catering-inventaario

Web-sovellus catering-tiimin varastonhallintaan tapahtumissa. Korvaa Google Sheets
-seurannan. Mobile-first, suomenkielinen, kirjautumisen takana.

Malli on yksinkertainen: **varasto on oletus**, ja siihen kohdistuu neljä toimintoa
(lisäys, vienti, kulutus, inventointi) — jokainen kirjautuu lokiin, josta varastosaldo ja
raportit lasketaan.

## Teknologia

- **Backend:** Node 20 + TypeScript + Express, `pg` (suora SQL), `bcrypt`, JWT
  httpOnly-cookiessa, `zod`, `helmet`.
- **Tietokanta:** PostgreSQL 16 (saldo lasketaan lokista, ei tallenneta lukuna).
- **Frontend:** React 18 + TypeScript + Vite, react-router, Tailwind, TanStack Query, PWA.
- **Julkaisu:** Docker Compose. Backend tarjoilee API:n ja buildatun frontendin samasta
  portista; Caddy hoitaa reverse proxyn + automaattisen TLS:n.

## Käynnistys (tuotanto)

1. Kopioi ympäristötiedosto ja täytä arvot (etenkin salasanat ja `JWT_SECRET`):

   ```bash
   cp .env.example .env
   ```

   Aseta `DOMAIN` osoittamaan palvelimeen ja `ACME_EMAIL` Let's Encryptiä varten.
   Huom: `DATABASE_URL`:n salasanan tulee vastata `POSTGRES_PASSWORD`-arvoa.

2. Nosta pino:

   ```bash
   docker compose up -d
   ```

   Käynnistyessä sovellus (1) odottaa tietokantaa, (2) ajaa migraatiot, (3) ajaa seedin
   (luo admin-käyttäjän ja Varasto-sijainnin), (4) käynnistää palvelimen.

3. Avaa `https://<DOMAIN>` ja kirjaudu tunnuksilla `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

Jokaiseen tapahtumaan kannattaa perustaa oma catering-käyttäjä (Käyttäjät-näkymä, admin).

### Lähiverkko / ilman domainia

Sama paketti pyörii lähiverkossa. TLS ilman julkista domainia ei toimi Let's Encryptillä;
aja tällöin `app`-palvelu suoraan (portti `8080`) tai käytä Caddyn `tls internal`
-asetusta. Kehityskäytössä helpointa on ajaa backend + frontend erikseen (alla).

## Kehitys

Backend:

```bash
cd backend
npm install
# tarvitset paikallisen Postgresin; aseta DATABASE_URL, JWT_SECRET, ADMIN_* ympäristöön
npm run dev
```

Frontend (eri terminaalissa):

```bash
cd frontend
npm install
npm run dev
```

Vite pyörii portissa 5173 ja proxyttaa `/api` backendiin (`localhost:8080`).
Aseta backendin ympäristöön `COOKIE_SECURE=false` kehityksessä (http).

## Ydinkäsitteet

- **Neljä toimintoa:** Lisäys (+), Vienti (varasto → sijainti, vain palautuvat), Palautus
  (sijainti → varasto), Kulutus (−, pysyvä), sekä Inventointi (korjaa saldon laskettuun
  lukuun; erotus kirjautuu lokiin).
- **Palautuva vs. kuluva** on tuotteen ominaisuus (`returnable`), valitaan tuotetta
  luodessa. Palautuvia viedään/palautetaan; kuluvia kulutetaan. Rikkoutunutta astiaa voi
  vähentää kulutuksella.
- **Kaksoisyksikkö:** laskentayksikkö + valinnainen pakkauskoko → raportit näyttävät
  molemmat, esim. "12 pkt (2,0 kg)".
- **Tapahtumat:** yksi aktiivinen kerrallaan; uudet kirjaukset leimataan siihen.
  Varastosaldo jatkuu tapahtumien yli. Kertaluontoinen tuote hoidetaan arkistoimalla.
- **Void:** virheellisen kirjauksen voi perua; sen vaikutus poistuu saldosta mutta rivi jää
  lokiin näkyviin.

## Varmuuskopiot

```bash
./scripts/backup.sh                 # -> backups/catering_YYYYMMDD_HHMMSS.sql.gz
./scripts/restore.sh backups/<tiedosto>.sql.gz
```

Ajastettu päivittäinen varmuuskopio (host-crontab), esim. klo 03:00:

```cron
0 3 * * * cd /polku/Catering && ./scripts/backup.sh >> /var/log/catering-backup.log 2>&1
```

## Tietoturva

- Salasanat `bcrypt` (cost 12). JWT httpOnly + `Secure` + `SameSite=Lax` -cookiessa (30 pv).
- Login-rate limit 5 / 15 min / IP. Ei julkista rekisteröitymistä.
- Flat-oikeudet: kaikki kirjautuneet voivat kirjata ja perua (void) kirjauksia; audit-loki
  (`user_id` joka rivillä) antaa jäljitettävyyden. Admin lisäksi: käyttäjähallinta.
- Postgres ei ole julkisesti auki; ainoa avoin palvelu on Caddy (80/443).

## API (lyhyesti)

Kaikki `/api/*` (paitsi login) vaatii cookien. Vastaukset JSON, virheet `{ error }`.

| Alue | Endpointit |
|------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Käyttäjät (admin) | `GET/POST /api/users`, `PATCH /api/users/:id` |
| Tuotteet | `GET/POST /api/items`, `GET/PATCH /api/items/:id`, `POST /api/items/:id/archive|unarchive` |
| Sijainnit | `GET/POST /api/locations`, `PATCH /api/locations/:id` |
| Tapahtumat | `GET /api/events`, `GET /api/events/active`, `POST /api/events`, `PATCH /api/events/:id`, `POST /api/events/:id/close`, `GET /api/events/:id/report` |
| Kirjaukset | `POST /api/movements/{add,deploy,return,consume,inventory}`, `GET /api/movements`, `POST /api/movements/:id/void` |
| Saldot/raportit | `GET /api/stock`, `GET /api/reports/consumption` |

## Rakenne

```
docker-compose.yml  Caddyfile  .env.example  README.md
backend/   Express-API + migraatiot + seed (tarjoilee myös frontendin)
frontend/  React-sovellus (Vite, Tailwind, PWA)
scripts/   backup.sh, restore.sh
```
