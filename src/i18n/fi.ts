/**
 * Finnish UI dictionary. Single locale, no library needed.
 * Add entries here, then import as `import { fi } from '@/i18n/fi'`.
 */
export const fi = {
  app: {
    title: 'Työvuorosuunnittelija',
  },
  nav: {
    calendar: 'Kalenteri',
  },
  weekdaysShort: ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'],
  weekdaysLong: [
    'maanantai',
    'tiistai',
    'keskiviikko',
    'torstai',
    'perjantai',
    'lauantai',
    'sunnuntai',
  ],
  months: [
    'Tammikuu',
    'Helmikuu',
    'Maaliskuu',
    'Huhtikuu',
    'Toukokuu',
    'Kesäkuu',
    'Heinäkuu',
    'Elokuu',
    'Syyskuu',
    'Lokakuu',
    'Marraskuu',
    'Joulukuu',
  ],
  monthsGenitive: [
    'tammikuu',
    'helmikuu',
    'maaliskuu',
    'huhtikuu',
    'toukokuu',
    'kesäkuu',
    'heinäkuu',
    'elokuu',
    'syyskuu',
    'lokakuu',
    'marraskuu',
    'joulukuu',
  ],
  buttons: {
    today: 'Tänään',
    previousMonth: 'Edellinen kuukausi',
    nextMonth: 'Seuraava kuukausi',
    autoplan: 'Luo ehdotus',
    exportPdfs: 'Vie PDF:t',
    exportPng: 'Vie kuvana',
    exportJson: 'Vie JSON',
    importJson: 'Tuo JSON',
    exportIcs: 'Vie Google Calendariin',
    clearAll: 'Tyhjennä kaikki',
    settings: 'Asetukset',
    close: 'Sulje',
    cancel: 'Peruuta',
    confirm: 'Vahvista',
    save: 'Tallenna',
    addShift: 'Lisää vuoro',
    remove: 'Poista',
  },
  calendar: {
    note: 'Muistiinpano',
    pdfComment: 'PDF-kommentti',
    travelDay: 'Matkapäivä',
    weekShort: 'vko',
    dayOff: {
      label: 'Vapaa',
      none: 'Ei merkintää',
      soft: 'Toivottu vapaa',
      hard: 'Pakollinen vapaa',
    },
    hoursOfTarget: (current: string, target: string) => `${current} / ${target} h`,
  },
  toast: {
    icsExported: 'Kalenteritiedosto viety',
    icsEmpty: 'Ei vuoroja vietäväksi tässä kuussa',
    icsSkipped: (count: number) =>
      `Kalenteritiedosto viety. ${count} virheellistä vuoroa jätettiin pois.`,
  },
  shift: {
    start: 'Alkaa',
    end: 'Päättyy',
    duration: 'Kesto',
    comment: 'Kommentti',
    date: 'Pvm',
    weekday: 'Viikonpäivä',
  },
  violations: {
    title: 'Huomiot',
    none: 'Ei huomioita — kuukausi näyttää siistiltä.',
    badge: (count: number) =>
      count === 1 ? '1 huomio' : `${count} huomiota`,
    summaryPerMonth: 'Koko kuukausi',
    jumpTo: 'Avaa päivä',
  },
  autoplan: {
    confirmTitle: 'Luodaanko uusi ehdotus?',
    confirmMessage:
      'Tämä korvaa nykyiset ei-lukitut vuorot. Muistiinpanot ja lukitut vuorot säilyvät.',
    confirmButton: 'Luo ehdotus',
  },
  clear: {
    button: 'Tyhjennä kuukausi',
    title: 'Tyhjennä kuukausi',
    message:
      'Mitä haluat tyhjentää tämän kuukauden osalta? Toiminto ei ole peruutettavissa.',
    shiftsOnly: 'Vain vuorot',
    everything: 'Kaikki (vuorot, muistiinpanot, matkapäivät)',
  },
  travel: {
    badge: 'Reissu',
    toggleLabel: 'Reissupäivä',
    description: (nameB: string, nameA: string) =>
      `${nameB}: 06:30–09:00 (lukittu) | ${nameA}: 15:00–20:30 (lukittu).`,
  },
  dayOff: {
    sectionLabel: 'Vapaatoiveet',
    badge: {
      soft: 'Toivottu vapaa',
      hard: 'Pakollinen vapaa',
    },
  },
  settings: {
    title: 'Asetukset',
    employeeNames: 'Työntekijöiden nimet',
    nameLabel: 'Nimi',
    nameRequired: 'Nimi ei voi olla tyhjä',
    monthlyHoursLabel: 'Kuukauden tunnit',
    hoursInvalid: 'Tuntimäärä pitää olla 0–250',
    saved: 'Asetukset tallennettu',
  },
} as const

export type Dictionary = typeof fi
