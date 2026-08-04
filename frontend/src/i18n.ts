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
  },

  // Sijainnit
  locations: {
    title: 'Sijainnit',
    newPlaceholder: 'Uuden sijainnin nimi',
    warehouseTag: 'Varasto',
    hiddenTag: 'Piilotettu',
    hide: 'Piilota',
    show: 'Näytä',
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

    confidence: (used: number, total: number) =>
      `${used}/${total} tapahtumaa pohjana`,
    spread: (min: string, max: string, unit: string, per: string) =>
      `Vaihteluväli ${min}–${max} ${unit} ${per}`,
    lowConfidence: 'Vain yksi tapahtuma pohjana — arvio epävarma.',
    highSpread: 'Suuri hajonta tapahtumien välillä — arvio epävarma.',
    showHistory: 'Näytä pohjadata',
    hideHistory: 'Piilota pohjadata',
    historyRow: (orgs: number, days: number) => `${orgs} orgia · ${days} pv`,
    perOrgLabel: '/ orgi',
    perOrgDayLabel: '/ orgi / pv',

    statsTitle: 'Kulutus yhteensä',
    statsHint: 'Valittujen tapahtumien yhteenlaskettu menekki — ja kertymä tapahtuma kerrallaan.',
    statsAllTime: 'Koko historia',
    statsSelected: 'Valitut tapahtumat',
    statsEmpty: 'Ei kulutuskirjauksia.',
    cumulative: 'Kertymä',
    noEvent: 'Ei tapahtumaa',
  },
};
