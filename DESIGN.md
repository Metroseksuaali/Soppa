# DESIGN.md

Käyttöliittymän pelisäännöt. [CLAUDE.md](CLAUDE.md) kertoo miten repossa työskennellään ja
[SPEC.md](SPEC.md) on totuuden lähde domain-säännöille — tämä tiedosto on totuuden lähde
**ulkoasulle**: väreille, tiheydelle, mitoille ja komponenttiluokille.

Toteutus on kahdessa tiedostossa: tokenit ja komponenttiluokat
[frontend/src/index.css](frontend/src/index.css):ssä, niiden Tailwind-nimet
[frontend/tailwind.config.js](frontend/tailwind.config.js):ssä. Kaikki UI-tekstit ovat
erikseen [frontend/src/i18n.ts](frontend/src/i18n.ts):ssä — älä kovakoodaa merkkijonoja.

## Periaatteet

1. **Neutraali kromi, väri merkitsee jotain.** Palkit, kortit ja listat ovat neutraaleja
   pintoja. Väri varataan tilalle ja merkitykselle (aktiivinen sivu, kirjaustyyppi,
   varoitus). Kun väri on harvinaista, se myös huomataan.
2. **Kompakti mutta kosketettava.** Tiheä typografia ja pienet paddingit, mutta jokainen
   kosketuskohde on vähintään 44 × 44 px. Tiheys tulee fonttikoosta, ei kosketusalasta.
3. **Reuna, ei varjo.** Kortit erottuvat 1px reunalla. Varjot katoavat tummassa teemassa,
   reunat eivät.
4. **Tokenit, ei heksoja.** Jokainen väri tulee tokenista. Uusi koodi ei sisällä
   `slate-*`-luokkia eikä heksavärejä.
5. **Mobiili ensin.** Peruskoko on puhelin; `md:`-varianteilla lisätään työpöydän väljyys.

## Ilme: Assembly

Soppa on Assembly-tapahtuman työkalu, joten tunnusvärit ovat Assemblyn: **violetti
päävärinä ja teal tehosteena**, ja niiden liukuväri tunnuspinnoilla.

| Rooli | Missä käytetään |
|-------|-----------------|
| **Violetti** (`brand`) | Navigaatio ja ensisijaiset toiminnot: aktiivinen navilinkki, valittu välilehti, `btn-primary`, kentän fokusrengas |
| **Teal** (`accent`) | Aktiivinen tapahtuma ja palautuva tuote — asiat jotka ovat käynnissä tai tulevat takaisin |
| **Liukuväri** (`bg-brand-gradient`) | Vain tunnuspinnat: logolaatta palkeissa, kirjautumisen logo ja otsikko |

> **`brand` on täyttöväri, ei tekstiväri.** Sama violetti joka toimii napin täyttönä on
> lukukelvoton tekstinä tummaa pohjaa vasten. Tekstille ja ikoneille on `text-brand-ink`,
> joka vaalenee tummassa teemassa. `text-brand` on aina virhe. Sama pätee tealiin:
> `text-accent-ink`, ei `text-accent`.

Liukuväri ei kuulu napeille, korteille eikä palkeille — silloin siitä tulee taustakuvio ja
ilme muuttuu levottomaksi. `text-brand-gradient` on vain isoille otsikoille: leikattu
tekstiväri ei noudata kontrastisääntöjä pienessä koossa.

## Väritokenit

Arvot ovat RGB-kanavia CSS-muuttujissa, jotka `tailwind.config.js` kääräisee muotoon
`rgb(var(--c-x) / <alpha-value>)`. Siksi sekä `bg-surface` että `bg-brand/10` toimivat.

| Luokka | Token | Käyttö |
|--------|-------|--------|
| `bg-app` | `--c-bg` | Sivun pohja |
| `bg-surface` | `--c-surface` | Kortit, palkit, modaalit |
| `bg-surface-2` | `--c-surface-2` | Hover, korostettu rivi, huomaamaton täyttö |
| `border-line` | `--c-line` | Reunat ja jakajat (`divide-line`) |
| `border-line-strong` | `--c-line-strong` | Kentän reuna, vahvempi jakaja |
| `text-fg` | `--c-fg` | Leipäteksti ja otsikot |
| `text-fg-muted` | `--c-fg-muted` | Toissijainen teksti, labelit |
| `text-fg-subtle` | `--c-fg-subtle` | Pikkuteksti, ikonit, placeholder |
| `bg-brand` | `--c-brand` | Brand-täyttö |
| `text-brand-fg` | `--c-brand-fg` | Teksti brand-täytön päällä |
| `text-brand-ink` | `--c-brand-ink` | Brandin värinen teksti tavallisella pinnalla |
| `bg-brand-soft` | `--c-brand-soft` | Sävypinta: aktiivinen navilinkki, merkit |
| `bg-accent` / `text-accent-ink` / `bg-accent-soft` | `--c-accent*` | Teal-tehoste, sama kolmijako |

`bg-brand-soft` on **valmiiksi sekoitettu** väri, ei `bg-brand/10`. Läpinäkyvä violetti
katoaa lähes mustaan pohjaan — sävypinnan pitää olla oma token kummallekin teemalle.

Kaksi eri brand-tekstitokenia on tarkoituksellista: `brand-fg` on täytön päälle,
`brand-ink` pinnalle. Tummassa teemassa ne menevät eri suuntiin — täyttö pysyy tummana
violettina (valkoinen teksti säilyttää kontrastin) mutta `brand-ink` vaalenee.

## Teemat

Tumma teema on **tokenien vaihto**: `:root.dark` määrittelee samat muuttujat uusilla
arvoilla. Semanttisia luokkia käyttävä komponentti toimii molemmissa teemoissa ilman
`dark:`-variantteja — älä lisää niitä.

Yksi poikkeus: **värilliset sävypinnat** (kirjaustyypit, varoitukset) tarvitsevat
`dark:`-variantin tekstivärille, koska Tailwindin väriasteikko ei ole tokenoitu. Kuvio on
aina sama — läpinäkyvä täyttö, vaaleneva teksti:

```jsx
className="bg-amber-500/10 text-amber-700 dark:text-amber-300"
```

Käytä `/10`-läpinäkyvyyttä, älä `-50`/`-100`-sävyjä: läpinäkyvä täyttö sulautuu kumpaan
tahansa pohjaan, kiinteä vaalea sävy hohtaa tummassa teemassa.

Teema luetaan `localStorage`ista (`catering_theme`) ennen renderöintiä
[index.html](frontend/index.html):ssä, jotta vaaleaa välähdystä ei tule. Sama skripti ja
Layoutin vaihtonappi päivittävät `<meta name="theme-color">`-arvon, joten selaimen
osoitepalkki seuraa yläpalkin pintaa. Jos muutat `--c-surface`- tai `--c-bg`-arvoja,
päivitä myös nämä kolme kohtaa: `index.html`, `Layout.tsx` (`THEME_COLOR`) ja
`vite.config.ts` (`theme_color`).

## Tiheys ja mitat

| Asia | Arvo |
|------|------|
| Kortin pyöristys | `rounded-xl` (12px) |
| Napit, kentät, navilinkit | `rounded-lg` (8px) |
| Chipit | `rounded-md` (6px) |
| Modaali mobiilissa | `rounded-t-2xl`, työpöydällä `rounded-xl` |
| Kosketusala | `min-h-touch` / `h-touch` (44px) — myös ikoninapeille |
| Palkkien korkeus | `h-14` (56px) ylä- ja sivupalkin otsikko |
| Sisältöalue | `px-3 py-4` mobiilissa, `md:px-8 md:py-6` |
| Osioväli | `space-y-4`; kortin sisällä `px-3 py-2.5` |
| Ruudukon väli | `gap-2` (laatat), `gap-3` (kortit) |

Alapalkissa on `pb-safe` (iOS:n kotipainikkeen alue) ja sisältöalueella `pb-24`, jotta
alapalkki ei peitä viimeistä riviä.

**Peukalon ulottuvuus.** Puhelimessa sivun ylälaita on hankalin kohta yhdellä kädellä
käytettäessä, joten toistuvat toiminnot kuuluvat alalaitaan. Etusivun pikatoiminnot
**kelluvat mobiilissa heti alanavigaation päällä** (`fixed above-bottom-nav`), koska
kirjaaminen on sovelluksen ydintoiminto eikä sitä pidä tarvita selata esiin. Työpöydällä
palkki palaa normaaliin virtaan (`md:static`) väljempänä ruudukkona.

Kelluvan palkin mitoitus:

- Palkki on **yksi rivi** (`grid-cols-6`) ja laatat pienenevät mobiilissa
  (`py-1.5 text-2xs`), jotta se peittää vain ~60px. Kahden rivin ruudukko veisi ~130px,
  mikä on liikaa pienellä näytöllä.
- `.above-bottom-nav` laskee sijainnin `--nav-h`:sta + `env(safe-area-inset-bottom)`.
  `--nav-h` vastaa alapalkin ruudukon korkeutta ([Layout.tsx](frontend/src/components/Layout.tsx):
  `h-16`) — **jos alapalkin korkeus muuttuu, muuta `--nav-h` samalla**, muuten palkki
  jää alapalkin alle tai leijuu irti siitä.
- Kelluva elementti on poissa normaalista asettelusta, joten sivun juuri lisää sen
  korkeuden verran alapaddingia (`pb-20 md:pb-0`). Layoutin `main` hoitaa jo alapalkin
  oman tilan (`pb-24`), joten sitä ei lasketa kahdesti.

Jos joskus siirrät osion järjestystä `order`-luokilla kelluttamisen sijaan, säiliön pitää
käyttää `flex flex-col gap-*` eikä `space-y-*`: `space-y` ripustaa marginaalit
DOM-järjestykseen, joten `order` sekoittaa välit.

## Typografia

| Koko | Käyttö |
|------|--------|
| `text-2xs` (11px) | Chipit, `section-title`, alapalkin labelit |
| `text-xs` (12px) | Toissijainen teksti, tiiviit ilmoitukset |
| `text-sm` (14px) | **Peruskoko**: listat, napit, lomakkeet, navigaatio |
| `text-base` (16px) | Modaalin otsikko |
| `text-xl` (20px) | Sivun otsikko |

Kaksi sääntöä joita ei rikota:

- **Kentät ovat mobiilissa 16px** (`text-base sm:text-sm`). iOS Safari zoomaa kenttään,
  jonka fonttikoko on alle 16px. `.input` hoitaa tämän — älä ohita sitä omalla `text-sm`:llä.
- **Numerot listoissa saavat `nums`-luokan** (`tabular-nums`). Määrät ja päivämäärät
  pysyvät sarakkeissa suorassa, mikä on tämän sovelluksen ydinsisältöä.

## Komponenttiluokat

Määritelty [index.css](frontend/src/index.css):n `@layer components`-lohkossa. Käytä näitä
äläkä kokoa samaa uudelleen utility-luokista.

| Luokka | Käyttö |
|--------|--------|
| `btn-primary` | Näkymän ensisijainen toiminto — yksi per näkymä |
| `btn-secondary` | Rinnakkaiset toiminnot, peruutus |
| `btn-danger` | Poisto, void |
| `btn-sm` | Lisäluokka tiheisiin riveihin (36px — **ei** ensisijaisiin mobiilitoimintoihin) |
| `input` | Kaikki kentät: `input`, `select`, `textarea` |
| `label` | Kentän label |
| `card` | Pintalaatikko: `bg-surface` + reuna + `rounded-xl` |
| `chip` | Pieni tilamerkki (kategoria, tyyppi) |
| `section-title` | Osion pikkuotsikko listojen ja korttiryhmien yllä |
| `nums` | Numerosarake |
| `pb-safe` | iOS:n turva-alue kiinteissä alapalkeissa |

## Värin merkitys

Kirjaustyypin väri on sovittu (määritelty [Home.tsx](frontend/src/pages/Home.tsx):n
`quickActions`-taulukossa) ja sen pitää olla sama kaikkialla:

| Tyyppi | Väri | Miksi |
|--------|------|-------|
| `lisays` | emerald | Saldo kasvaa |
| `vienti` | sky | Lähtee sijaintiin |
| `palautus` | indigo | Tulee sijainnista takaisin |
| `kulutus` | rose | Poistuu pysyvästi |
| `inventointi` | amber | Korjaa saldon, vaatii huomiota |

Muut merkitykset: **punainen** = virhe tai negatiivinen saldo, **keltainen** = huomio joka
ei estä työtä (esim. "ei aktiivista tapahtumaa"), **emerald** = onnistuminen ("tallennettu").
Neutraali `bg-surface-2` on navigointiin, ei tilaan — siksi etusivun Varasto-laatta on
harmaa, vaikka kirjauslaatat ovat värillisiä.

Yksi väri = yksi merkitys, myös käsittelytavan tasolla. Jos sama asia (esim. "palautuva")
näkyy kahdessa näkymässä, sen pitää käyttää **samaa luokkaparia** molemmissa — ei kertaa
`bg-accent-soft` ja kertaa `bg-teal-500/10`.

### Valittu tila listoissa ja välilehdissä

Valinta merkitään **täytetyllä pillerillä** (`bg-brand text-brand-fg`), ei sävypinnalla.
Kategoriavälilehdet istuvat `bg-surface-2`-kiskossa, ja sävytetty valinta hukkuu siihen
kiskoon molemmissa teemoissa. `bg-brand-soft` on sävypinnaksi kunnossa vain neutraalia
pintaa vasten, kuten sivupalkin navilinkeissä.

## Ikonit

[lucide-react](https://lucide.dev), koko **18px** (`w-[18px] h-[18px]`) navigaatiossa ja
listoissa, **20px** (`w-5 h-5`) laatoissa. Ikoni ei koskaan ole ainoa merkitsijä: jos napissa
ei ole tekstiä, sillä on `aria-label` ja `title` i18n-tekstillä.

## Kiellot

- Ei heksavärejä eikä `slate-*`-luokkia uudessa koodissa.
- Ei `dark:`-variantteja pinnoille ja teksteille — tokenit hoitavat sen.
- Ei `!important`-sääntöjä. `index.css`:n lopussa on siirtymäkauden lohko, joka on
  poistettava, ei laajennettava.
- Ei varjoja (`shadow-*`) korteissa.
- Ei kiinteitä vaaleita sävyjä (`-50`, `-100`) värillisissä pinnoissa — `/10` tilalle.
- Ei kovakoodattuja tekstejä; kaikki `i18n.ts`:ään.

## Migraation tila

**Valmis.** Kaikki sivut ja komponentit käyttävät semanttisia tokeneita, eikä lähdekoodissa
ole enää `slate-*`-luokkia, kiinteitä vaaleita sävyjä (`-50`/`-100`), varjoja eikä
`text-brand`ia tekstivärinä. `index.css`:n väliaikainen `!important`-yhteensopivuuslohko on
poistettu — koko tiedostossa ei ole yhtään `!important`-sääntöä, ja jos joudut lisäämään
yhden, jokin on pielessä tokeneissa.

Tarkista regressiot näillä (kaikkien pitää palauttaa tyhjä):

```bash
cd frontend
grep -rn "slate-" src/                                  # vanhat neutraalit
grep -rnE "text-brand($|[^-])" src/                     # täyttöväri tekstinä
grep -rnE "bg-[a-z]+-(50|100|200)\b" src/               # kiinteät vaaleat sävyt
grep -rn "shadow-" src/                                 # varjot
grep -rn "important" src/index.css                      # yhteensopivuuslohko
```

Tiedossa olevat jäljellä olevat nipotukset (eivät regressioita, vanhaa perua): osa
tekstinäköisistä pikkunapeista (Forecastin "valitse kaikki", Log-ilmoituksen ×, historian
void-napit) on alle 44px korkeita. Niiden kasvattaminen muuttaa rivien korkeutta, eli se on
layout-muutos eikä väriswappi — tehdään omana passina.

## Muutosten jälkeen

- `cd frontend && npm run build` läpäistävä (tsc + vite).
- Tarkista **molemmat teemat** — tokenit tekevät siitä nopeaa, mutta värilliset sävypinnat
  pitää katsoa silmällä.
- Tarkista puhelimen levyisellä ikkunalla: kosketusalat, ettei alapalkki peitä sisältöä,
  eikä kenttään tulla zoomaten.
