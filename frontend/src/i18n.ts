// Keskitetty lokalisaatio — kaikki käyttöliittymän tekstit ovat täällä.
// Muokataksesi UI:ssa näkyviä tekstejä, muuta arvoja tässä tiedostossa.
// Dynaamiset tekstit (joissa on muuttuva osa) ovat funktioita.
//
// Sovellus on yksikielinen (suomi). Jos joskus tarvitaan useampi kieli, tämän
// objektin voi monistaa kielikohtaiseksi ja valita aktiivisen kielen ajossa.

export const t = {
  app: {
    name: 'Soppa',
    tagline: 'Catering-varastonhallinta',
    unknownError: 'Tuntematon virhe',
  },

  // Navigaatio (mobiilin alapalkki + työpöydän sivupalkki)
  nav: {
    home: 'Etusivu',
    inventory: 'Inventaario',
    log: 'Kirjaa',
    reports: 'Raportit',
    forecast: 'Ennuste',
    importData: 'Historiatuonti',
    groups: 'Tuoteryhmät',
    locations: 'Sijainnit',
    events: 'Tapahtumat',
    users: 'Käyttäjät',
  },

  // Yläpalkki
  header: {
    activeEvent: 'Aktiivinen tapahtuma',
    noActiveEvent: 'Ei aktiivista tapahtumaa',
    logout: 'Kirjaudu ulos',
    toggleTheme: 'Vaihda vaalea/tumma teema',
  },

  // Yleiset, monessa paikassa käytetyt
  common: {
    back: 'Takaisin',
    close: 'Sulje',
    backHome: 'Etusivu',
    edit: 'Muokkaa',
    save: 'Tallenna',
    saving: 'Tallennetaan…',
    create: 'Luo',
    add: 'Lisää',
    optionalShort: '(valinn.)',
    note: 'Muistiinpano',
    name: 'Nimi',
    unit: 'Yksikkö',
    packSize: 'Pakkauskoko',
    packUnit: 'Pakkausyksikkö',
    returnable: 'Palautuva',
    consumable: 'Kuluva',
    stock: 'Varastosaldo',
  },

  // Kategoriat — täysi muoto (välilehdet, valinta, raportit)
  categories: {
    ruoka: 'Ruoka',
    tavara: 'Tavara',
    kaluste: 'Kalusteet',
  } as Record<string, string>,

  // Kategoriat — lyhyt muoto (pienet merkit / chipit)
  categoriesShort: {
    ruoka: 'Ruoka',
    tavara: 'Tavara',
    kaluste: 'Kaluste',
  } as Record<string, string>,

  // Kirjaustyypit
  movementTypes: {
    lisays: 'Lisäys',
    vienti: 'Vienti',
    palautus: 'Palautus',
    kulutus: 'Kulutus',
    inventointi: 'Inventointi',
  } as Record<string, string>,

  // Kirjautuminen
  login: {
    subtitle: 'Kirjaudu sisään',
    username: 'Käyttäjätunnus',
    password: 'Salasana',
    submit: 'Kirjaudu',
    submitting: 'Kirjaudutaan…',
    failed: 'Kirjautuminen epäonnistui',
  },

  // Etusivu
  home: {
    welcome: (name: string) => `Tervetuloa, ${name}`,
    activeEventTag: 'Aktiivinen tapahtuma',
    noEventNotice: 'Ei aktiivista tapahtumaa. Kirjaukset tallentuvat ilman tapahtumaleimaa.',
    setEvent: 'Aseta tapahtuma',
    quickActions: 'Pikatoiminnot',
    warehouse: 'Varasto',
    outOfStock: 'Loppu varastosta',
    locations: 'Sijainnit',
    events: 'Tapahtumat',
    forecast: 'Ennuste',
    importData: 'Historiatuonti',
    groups: 'Tuoteryhmät',
    users: 'Käyttäjät',
    actions: {
      lisays: 'Lisää',
      vienti: 'Vie',
      palautus: 'Palauta',
      kulutus: 'Kuluta',
      inventointi: 'Inventoi',
    } as Record<string, string>,
  },

  // Inventaario-listaus
  inventory: {
    title: 'Inventaario',
    newItem: '+ Uusi tuote',
    search: 'Hae tuotetta…',
    empty: 'Ei tuotteita tässä kategoriassa.',
  },

  // Uuden/muokattavan tuotteen lomake
  itemForm: {
    createTitle: 'Uusi tuote',
    editTitle: 'Muokkaa tuotetta',
    category: 'Kategoria',
    unitPlaceholder: 'kpl, pkt, l, kg',
    packSizeLabel: 'Pakkauskoko (valinn.)',
    packSizePlaceholder: 'esim. 0,167',
    packUnitPlaceholder: 'kg, l',
    noteLabel: 'Muistiinpano (valinn.)',
    create: 'Luo tuote',
    group: 'Tuoteryhmä (valinn.)',
    noGroup: '— ei ryhmää —',
    groupHint: 'Ryhmä yhdistää saman tarpeen eri brändit ennusteessa (esim. "Juusto").',
    groupIncompatible: (base: string) =>
      `Huom: tuotteen määrää ei voi muuntaa ryhmän perusyksikköön (${base}). Lisää pakkauskoko, tai tuote jää ryhmäsumman ulkopuolelle.`,
  },

  // Tuotenäkymä
  item: {
    archived: 'Arkistoitu',
    logAction: 'Kirjaa',
    unarchive: 'Palauta käyttöön',
    archive: 'Arkistoi',
    outAtLocations: 'Ulkona sijainneissa',
    history: 'Historia',
    noHistory: 'Ei kirjauksia.',
    voided: '(peruttu)',
    counted: (val: string) => `Laskettu: ${val}`,
    voidButton: 'Peru',
    voidConfirm: 'Perutaanko tämä kirjaus?',
  },

  // Tuotekuva
  photo: {
    title: 'Kuva',
    none: 'Ei kuvaa',
    hint: 'Ota kuva tuotteesta — helpottaa samankaltaisten tunnistamista.',
    take: 'Ota kuva',
    gallery: 'Valitse kuva',
    replace: 'Vaihda kuva',
    remove: 'Poista kuva',
    removeConfirm: 'Poistetaanko tuotteen kuva?',
    processing: 'Käsitellään kuvaa…',
    uploading: 'Lähetetään…',
    saved: (size: string) => `Kuva tallennettu (${size})`,
    open: 'Avaa kuva',
    close: 'Sulje',
    alt: (name: string) => `Kuva tuotteesta ${name}`,
  },

  // Viivakoodi (skannaus kameralla + käsin syöttö)
  barcode: {
    title: 'Viivakoodit',
    scan: 'Skannaa',
    scanTitle: 'Skannaa viivakoodi',
    aim: 'Kohdista viivakoodi kameraan.',
    manualLabel: 'Tai kirjoita koodi',
    manualPlaceholder: 'esim. 6408430000012',
    manualSubmit: 'Hae',
    starting: 'Käynnistetään kameraa…',
    // Selaimissa joissa ei ole omaa viivakoodilukijaa (iPhone, Firefox) ladataan lukija
    // erikseen — kerrotaan miksi ensimmäinen avaus kestää hetken.
    loadingDecoder: 'Ladataan viivakoodilukijaa…',
    decoderFailed: 'Viivakoodilukijan lataus epäonnistui. Kirjoita koodi käsin.',
    // Kameran esto on tavallisin virhe — kerrotaan mitä tehdä, ei vain että meni pieleen.
    denied: 'Kameraa ei saatu käyttöön. Salli kamera selaimen asetuksista, tai kirjoita koodi käsin.',
    noCamera: 'Kameraa ei löytynyt. Kirjoita koodi käsin.',
    noCameraApi: 'Tämä selain ei anna pääsyä kameraan. Kirjoita koodi käsin.',
    insecure: 'Kamera vaatii HTTPS-yhteyden. Kirjoita koodi käsin.',
    notFound: (code: string) => `Viivakoodia ${code} ei ole liitetty mihinkään tuotteeseen.`,
    notFoundHint: 'Avaa oikea tuote ja liitä koodi sille — sen jälkeen skannaus löytää sen.',
    archivedItem: (name: string) => `Tuote ${name} on arkistoitu — palauta se käyttöön tuotesivulta.`,
    lookupFailed: 'Koodin haku epäonnistui.',
    // Tuotenäkymän kortti
    none: 'Ei viivakoodeja.',
    hint: 'Liitä tuotteen pakkauksen viivakoodi, niin sen löytää kirjatessa skannaamalla.',
    add: 'Lisää koodi',
    added: (code: string) => `Viivakoodi ${code} liitetty.`,
    removeConfirm: (code: string) => `Poistetaanko viivakoodi ${code}?`,
    remove: 'Poista viivakoodi',
  },

  // Kirjaa-näkymä
  log: {
    title: 'Kirjaa',
    done: (type: string, item: string) => `${type} kirjattu: ${item}`,
    step1Item: '1. Tuote',
    balance: (val: string) => `Saldo: ${val}`,
    change: 'Vaihda',
    noMatches: 'Ei osumia.',
    noReturnable: 'Ei palautuvia (vietäviä) tuotteita.',
    step2Action: '2. Toiminto',
    step3Counted: (unit: string) => `3. Laskettu määrä (${unit})`,
    currentBalance: (val: string) => `Nykysaldo: ${val}`,
    step3Quantity: (unit: string) => `3. Määrä (${unit})`,
    location: 'Sijainti',
    locationOptional: ' (valinnainen)',
    noLocationOption: '— ei sijaintia —',
    chooseLocation: 'Valitse sijainti',
    confirm: (type: string) => `Vahvista: ${type}`,
    chooseItemError: 'Valitse tuote',
    sponsored: 'Sponsorilahjoitus',
    sponsoredHint:
      'Tästä erästä ei maksettu. Saldo kasvaa ja kulutus lasketaan ennusteeseen aivan kuten ostetusta tavarasta — merkintä kertoo vain, että tarve katettiin lahjoituksella.',
  },

  // Sijainnit
  locations: {
    title: 'Sijainnit',
    newPlaceholder: 'Uuden sijainnin nimi',
    warehouseTag: 'Varasto',
    hiddenTag: 'Piilotettu',
    hide: 'Piilota',
    show: 'Näytä',
    itemsOut: (n: number) => (n === 1 ? '1 tuote ulkona' : `${n} tuotetta ulkona`),
    nothingOut: 'Ei mitään ulkona',
    listHint: 'Avaa sijainti nähdäksesi mitä siellä on ja palauttaaksesi tavarat.',
  },

  // Sijaintinäkymä (mitä täällä on + palautus)
  locationDetail: {
    outNow: 'Ulkona nyt',
    outEmpty: 'Täällä ei ole mitään ulkona.',
    returnHint: 'Rastita mitä sait haettua. Määrää voi muuttaa, jos osa jää.',
    selectAll: 'Valitse kaikki',
    clearSelection: 'Tyhjennä',
    returnSelected: (n: number) => `Palauta varastoon (${n})`,
    returning: 'Palautetaan…',
    returned: (n: number) => (n === 1 ? '1 tuote palautettu varastoon' : `${n} tuotetta palautettu varastoon`),
    partialFailed: (n: number, reason: string) => `${n} epäonnistui: ${reason}`,
    consumedHere: 'Kulutettu täällä',
    consumedInEvent: (name: string) => `Tapahtumassa ${name}`,
    consumedAllTime: 'Kaikki kirjaukset (ei aktiivista tapahtumaa)',
    consumedEmpty: 'Ei kulutuskirjauksia tähän sijaintiin.',
  },

  // Tapahtumat
  events: {
    title: 'Tapahtumat',
    newPlaceholder: 'Uuden tapahtuman nimi',
    activeTag: 'Aktiivinen',
    startedAt: (when: string) => `Alkoi ${when}`,
    notStarted: 'Ei aloitettu',
    endedAt: (when: string) => `Päättyi ${when}`,
    report: 'Raportti',
    activate: 'Aseta aktiiviseksi',
    close: 'Sulje tapahtuma',
    // Ennustelaskennan mitat
    orgCount: 'Orgeja',
    orgCountShort: (n: number) => `${n} orgia`,
    orgCountMissing: 'Orgien määrä puuttuu',
    days: 'Kestoa (pv)',
    daysShort: (n: number) => `${n} pv`,
    daysAuto: ' (arvio)',
    metricsHint: 'Orgien määrä ja kesto tarkentavat kulutusennustetta.',
    metricsSaved: 'Tallennettu',
    editMetrics: 'Muokkaa mittoja',
    newOrgPlaceholder: 'Orgeja',
    newDaysPlaceholder: 'Kesto (pv)',
  },

  // Tuoteryhmät
  groups: {
    title: 'Tuoteryhmät',
    intro:
      'Ryhmä kokoaa saman tarpeen eri brändit ja pakkauskoot yhteen: "Juusto" voi sisältää Arki juustoviipaleen ja Oltermannin. Ennuste ja raportit voivat laskea ryhmän yhtenä lukuna.',
    newPlaceholder: 'Uuden ryhmän nimi',
    baseUnit: 'Perusyksikkö',
    baseUnitHint:
      'Yksikkö johon ryhmän tuotteet muunnetaan. Tuotteella pitää olla pakkauskoko tässä yksikössä (esim. 500 g pkt → 0,5 kg), tai sen oma yksikkö on jo sama.',
    itemCount: (n: number) => (n === 1 ? '1 tuote' : `${n} tuotetta`),
    incompatibleCount: (n: number) => `${n} ei yhteismitallinen`,
    hiddenTag: 'Piilotettu',
    hide: 'Piilota',
    show: 'Näytä',
    rename: 'Nimeä uudelleen',
    members: 'Ryhmän tuotteet',
    noMembers: 'Ei tuotteita tässä ryhmässä.',
    factor: (itemUnit: string, factor: string, baseUnit: string) =>
      `1 ${itemUnit} = ${factor} ${baseUnit}`,
    factorMissing: 'Yksikköä ei voi muuntaa',
    empty: 'Ei tuoteryhmiä.',
  },

  // Käyttäjät
  users: {
    title: 'Käyttäjät',
    newButton: '+ Uusi',
    adminTag: 'Admin',
    inactiveTag: 'Poissa',
    createTitle: 'Uusi käyttäjä',
    displayName: 'Näyttönimi',
    passwordHint: 'Salasana (vähint. 6 merkkiä)',
    admin: 'Ylläpitäjä',
    create: 'Luo käyttäjä',
    editTitle: (username: string) => `Muokkaa: ${username}`,
    activeCheckbox: 'Aktiivinen (voi kirjautua)',
    newPasswordHint: 'Uusi salasana (jätä tyhjäksi ellei vaihdeta)',
  },

  // Raportit
  reports: {
    title: 'Raportit',
    event: 'Tapahtuma',
    chooseEvent: 'Valitse tapahtuma',
    activeSuffix: ' (aktiivinen)',
    choosePrompt: 'Valitse tapahtuma nähdäksesi raportin.',
    exportCsv: 'Vie CSV',
    perItem: 'Yhteenveto per tuote',
    noMovements: 'Ei kirjauksia tässä tapahtumassa.',
    added: 'Lisätty',
    addedSponsored: 'Tästä sponsorilta',
    consumed: 'Kulutettu',
    outNow: 'Ulkona nyt',
    stockNow: 'Varastosaldo',
    perDay: 'Päiväkohtainen kulutus',
    fileName: 'raportti',
    csv: {
      item: 'Tuote',
      category: 'Kategoria',
      added: 'Lisätty',
      consumed: 'Kulutettu',
      outNow: 'Ulkona nyt',
      stock: 'Varastosaldo',
      unit: 'Yksikkö',
      weight: 'Paino/sek.',
      day: 'Päivä',
      consumption: 'Kulutus',
      weightPlain: 'Paino',
    },
  },

  // Historiatuonti
  importPage: {
    title: 'Historiatuonti',
    intro:
      'Tuo menneen tapahtuman kulutus lokiin päivätasolla. Rivit leimataan valittuun tapahtumaan, joten päiväkohtainen erittely ja ennuste saavat oikean historian.',
    eventTitle: '1. Tapahtuma',
    chooseEvent: 'Valitse tapahtuma',
    eventHint: 'Rivit kirjataan tähän tapahtumaan — ei aktiiviseen.',
    dataTitle: '2. Rivit',
    formatHint:
      'Yksi rivi per tuote ja päivä: tuote, päivä, määrä — erottimena sarkain tai puolipiste. Voit liittää suoraan taulukkolaskennasta. Neljäs sarake (kulutus / lisäys) on valinnainen, oletus kulutus. Viides sarake "sponsori" merkitsee lisäyksen lahjoitukseksi.',
    example: 'Esimerkki:\nJuusto\t4.8.2026\t12\nKertismuki\t4.8.2026\t450\nJuusto\t5.8.2026\t9,5',
    placeholder: 'Liitä rivit tähän…',
    balanceLabel: 'Luo jokaiselle kulutukselle vastaava lisäys',
    balanceHint:
      'Pitää nykyisen varastosaldon ennallaan: historian kulutus ei syö tämänhetkistä saldoa. Ota pois päältä jos tuot myös ostomäärät itse lisäys-riveinä.',
    previewTitle: '3. Esikatselu',
    okRows: (n: number) => `${n} riviä valmiina tuotavaksi`,
    errorRows: (n: number) => `${n} riviä ei kelpaa`,
    missingItemsHint:
      'Tuntemattomat tuotenimet pitää ensin luoda Inventaariossa — nimen on täsmättävä täsmälleen.',
    lineLabel: (n: number) => `rivi ${n}`,
    doImport: (n: number) => `Tuo ${n} riviä`,
    importing: 'Tuodaan…',
    nothingToImport: 'Ei kelvollisia rivejä.',
    doneTitle: 'Tuonti valmis',
    doneBody: (rows: number, event: string) => `${rows} riviä tapahtumaan ${event}.`,
    doneBalancing: (n: number) => `Lisäksi ${n} tasaavaa lisäystä, jotta varastosaldo säilyi ennallaan.`,
    toReport: 'Avaa raportti',
    undo: 'Peru tuonti',
    undoConfirm: 'Perutaanko koko tuontierä? Rivit jäävät lokiin peruttuina.',
    undone: (n: number) => `${n} kirjausta peruttu.`,
    batchesTitle: 'Aiemmat tuonnit',
    batchRow: (rows: number, from: string, to: string) => `${rows} kirjausta · ${from}–${to}`,
    batchVoided: 'peruttu',
    noBatches: 'Ei tuonteja.',
  },

  // Kulutusennuste
  forecast: {
    title: 'Kulutusennuste',
    intro:
      'Arvioi tulevan tapahtuman tarve aiempien tapahtumien menekistä. Kulutus suhteutetaan orgien määrään, joten eri kokoiset tapahtumat ovat vertailukelpoisia.',

    planTitle: '1. Suunniteltu tapahtuma',
    orgCount: 'Orgien määrä',
    days: 'Kesto (päivää)',

    basisTitle: '2. Laskentatapa',
    basisPerOrg: 'Per orgi',
    basisPerOrgDay: 'Per orgi / päivä',
    basisPerOrgHint: 'Kulutus / orgi × suunnitellut orgit. Kesto vaikuttaa vain välillisesti.',
    basisPerOrgDayHint:
      'Kulutus / orgi / päivä × orgit × päivät. Tarkempi, jos vertailutapahtumat ovat eri mittaisia.',

    eventsTitle: '3. Vertailutapahtumat',
    eventsHint: 'Jätä poikkeukselliset tapahtumat pois, niin keskiarvo ei vääristy.',
    selectAll: 'Valitse kaikki',
    selectNone: 'Tyhjennä',
    noOrgCount: 'ei orgimäärää',
    skippedNotice: (names: string) =>
      `Ei mukana laskennassa (orgien määrä puuttuu): ${names}. Lisää luku Tapahtumat-sivulla.`,
    category: 'Kategoria',
    allCategories: 'Kaikki',
    calculate: 'Laske ennuste',
    calculating: 'Lasketaan…',
    needEvents: 'Valitse vähintään yksi vertailutapahtuma, jossa on orgien määrä.',
    needOrgCount: 'Syötä suunnitellun tapahtuman orgien määrä.',

    resultTitle: 'Arvio ja ostettava määrä',
    estimate: 'Arvioitu tarve',
    stockNow: 'Varastossa',
    toBuy: 'Ostettava',
    enough: 'Riittää varastosta',
    noData: 'Valituista tapahtumista ei löydy kulutuskirjauksia.',
    archivedTag: 'Arkistoitu',

    // Yhden tapahtuman kohdalla "viime kerralla" on luettavampi kuin "1/1 tapahtumaa".
    confidence: (used: number, total: number) =>
      used === 1 && total === 1 ? 'Viime kerran perusteella' : `${used}/${total} tapahtumaa pohjana`,

    // Sponsoriosuus. Sanamuoto riippuu siitä montako tapahtumaa on pohjana:
    // yksi -> "viime kerralla", useampi -> "aikaisemmin keskimäärin".
    sponsoredLine: (amount: string, events: number) =>
      events === 1
        ? `viime kerralla sponsorilta ${amount}`
        : `aikaisemmin keskimäärin sponsorilta ${amount} (${events} tapahtumaa)`,
    sponsoredTag: 'Sponsori',
    sponsoredHint:
      'Sponsorien tuoma tavara on mukana tarpeessa täysimääräisesti — jos sponsoria ei ensi kerralla ole, tarve on silti sama ja ostettava määrä kasvaa vastaavasti.',
    spread: (min: string, max: string, unit: string, per: string) =>
      `Vaihteluväli ${min}–${max} ${unit} ${per}`,
    lowConfidence: 'Vain yksi tapahtuma pohjana — arvio epävarma.',
    highSpread: 'Suuri hajonta tapahtumien välillä — arvio epävarma.',
    showHistory: 'Näytä pohjadata',
    hideHistory: 'Piilota pohjadata',
    historyRow: (orgs: number, days: number) => `${orgs} orgia · ${days} pv`,
    perOrgLabel: '/ orgi',
    perOrgDayLabel: '/ orgi / pv',

    // Ryhmätaso
    levelGroup: 'Ryhmittäin',
    levelItem: 'Tuotteittain',
    levelHint:
      'Ryhmittäin-näkymä yhdistää brändit ja pakkauskoot (esim. kaikki juustot kiloina). Ostopäätös tehdään yleensä tällä tasolla.',
    ungrouped: 'Ei ryhmää',
    ungroupedHint: 'Näille tuotteille ei ole valittu tuoteryhmää — ennuste lasketaan tuotekohtaisesti.',
    groupMembers: (n: number) => (n === 1 ? '1 tuote' : `${n} tuotetta`),
    incompatible: (names: string) =>
      `Ei mukana ryhmäsummassa (yksikköä ei voi muuntaa): ${names}. Lisää tuotteelle pakkauskoko ryhmän perusyksikössä.`,
    noGroups: 'Yhtään tuoteryhmää ei ole vielä luotu.',
    manageGroups: 'Hallitse tuoteryhmiä',

    statsTitle: 'Kulutus yhteensä',
    statsHint: 'Valittujen tapahtumien yhteenlaskettu menekki — ja kertymä tapahtuma kerrallaan.',
    statsAllTime: 'Koko historia',
    statsSelected: 'Valitut tapahtumat',
    statsEmpty: 'Ei kulutuskirjauksia.',
    cumulative: 'Kertymä',
    noEvent: 'Ei tapahtumaa',
  },
};
