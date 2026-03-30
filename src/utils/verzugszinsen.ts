/**
 * Verzugszinsen-Berechnung nach § 288 BGB
 *
 * Verzugszinssatz = Basiszinssatz der Bundesbank + 5 Prozentpunkte (fuer Verbraucher)
 * Formel: (Rueckstand x Verzugszinssatz x Verzugstage) / (365 x 100)
 *
 * Verzugsbeginn: 4. Werktag des Folgemonats (§ 556b Abs. 1 BGB)
 */

// Fallback-Perioden wenn DB nicht verfuegbar (Stand 2026)
export const BASISZINSSATZ_PERIODEN_FALLBACK: Array<{ ab: string; satz: number }> = [
  { ab: '2026-01-01', satz: 1.27 },
  { ab: '2025-07-01', satz: 1.77 },
  { ab: '2025-01-01', satz: 2.27 },
  { ab: '2024-07-01', satz: 3.37 },
  { ab: '2024-01-01', satz: 3.62 },
  { ab: '2023-07-01', satz: 3.12 },
  { ab: '2023-01-01', satz: 1.62 },
];

// Aufschlag fuer Verbraucher-Mietverhaeltnisse: 5 Prozentpunkte (§ 288 Abs. 1 BGB)
const AUFSCHLAG_VERBRAUCHER = 5;

// Deutsche gesetzliche Feiertage (feststehende Daten, bundesweit)
const FEIERTAGE_FEST = [
  '01-01', // Neujahr
  '05-01', // Tag der Arbeit
  '10-03', // Tag der Deutschen Einheit
  '12-25', // 1. Weihnachtstag
  '12-26', // 2. Weihnachtstag
];

/**
 * Lokales ISO-Datum als YYYY-MM-DD — verhindert UTC-Drift bei Mitternacht in CET/CEST.
 * toISOString() gibt immer UTC zurueck: local midnight Jan 1 CET = Dec 31 23:00 UTC.
 */
export function toLocalIso(datum: Date): string {
  const y = datum.getFullYear();
  const m = String(datum.getMonth() + 1).padStart(2, '0');
  const d = String(datum.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isFeiertag(datum: Date): boolean {
  const localIso = toLocalIso(datum);
  const mmdd = localIso.slice(5, 10);
  if (FEIERTAGE_FEST.includes(mmdd)) return true;

  // Bewegliche Feiertage (Ostern-basiert)
  const jahr = datum.getFullYear();
  const ostern = berechneOsternSonntag(jahr);
  const bewegliche = [
    addTage(ostern, -2),  // Karfreitag
    addTage(ostern, 1),   // Ostermontag
    addTage(ostern, 39),  // Christi Himmelfahrt
    addTage(ostern, 49),  // Pfingstsonntag
    addTage(ostern, 50),  // Pfingstmontag
  ];
  return bewegliche.some(f => toLocalIso(f) === localIso);
}

function addTage(datum: Date, tage: number): Date {
  const d = new Date(datum);
  d.setDate(d.getDate() + tage);
  return d;
}

/** Gauss-Algorithmus fuer Ostersonntag */
function berechneOsternSonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

function isWerktag(datum: Date): boolean {
  const wochentag = datum.getDay();
  return wochentag !== 0 && wochentag !== 6 && !isFeiertag(datum);
}

/**
 * Berechnet den 4. Werktag des auf das Faelligkeitsmonat folgenden Monats.
 * Z.B. Miete Dezember → Verzug ab 4. Werktag Januar
 */
export function berechneVerzugsbeginn(faelligkeitsMonat: Date): Date {
  // Erster Tag des Folgemonats
  const folgeMonat = new Date(faelligkeitsMonat.getFullYear(), faelligkeitsMonat.getMonth() + 1, 1);

  let werktage = 0;
  let aktuell = new Date(folgeMonat);

  while (werktage < 4) {
    if (isWerktag(aktuell)) werktage++;
    if (werktage < 4) aktuell = addTage(aktuell, 1);
  }

  return aktuell;
}

export interface VerzugszinsPosten {
  monat: string;
  rueckstandBetrag: number;
  verzugVon: string; // ISO date
  verzugBis: string; // ISO date
  tage: number;
  basiszinssatz: number;
  verzugszinssatz: number;
  zinsbetrag: number;
}

/**
 * Ermittelt den Basiszinssatz fuer ein gegebenes Datum.
 * Nutzt optionale DB-Perioden, faellt auf Fallback zurueck.
 */
export function getBasiszinssatz(
  datum: Date,
  perioden: Array<{ ab: string; satz: number }> = BASISZINSSATZ_PERIODEN_FALLBACK
): number {
  const isoDate = toLocalIso(datum);
  for (const periode of perioden) {
    if (isoDate >= periode.ab) return periode.satz;
  }
  return perioden[perioden.length - 1].satz;
}

/**
 * Gibt den aktuellen Verzugszinssatz zurueck (Basiszins + 5%)
 */
export function getVerzugszinssatz(
  datum: Date,
  perioden?: Array<{ ab: string; satz: number }>
): number {
  return getBasiszinssatz(datum, perioden) + AUFSCHLAG_VERBRAUCHER;
}

function diffTage(von: Date, bis: Date): number {
  const msProTag = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((bis.getTime() - von.getTime()) / msProTag));
}

/**
 * Berechnet Verzugszinsen tagesgenau fuer einen einzelnen Rueckstandsposten
 */
export function berechneVerzugszins(
  rueckstandBetrag: number,
  verzugVon: Date,
  verzugBis: Date,
  perioden?: Array<{ ab: string; satz: number }>
): VerzugszinsPosten {
  const tage = diffTage(verzugVon, verzugBis);
  const basiszinssatz = getBasiszinssatz(verzugVon, perioden);
  const verzugszinssatz = basiszinssatz + AUFSCHLAG_VERBRAUCHER;
  const zinsbetrag = (rueckstandBetrag * verzugszinssatz * tage) / (365 * 100);

  const monatLabel = verzugVon.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return {
    monat: monatLabel,
    rueckstandBetrag,
    verzugVon: toLocalIso(verzugVon),
    verzugBis: toLocalIso(verzugBis),
    tage,
    basiszinssatz,
    verzugszinssatz,
    zinsbetrag: Math.round(zinsbetrag * 100) / 100,
  };
}

/**
 * Berechnet Verzugszinsen fuer mehrere Rueckstandsposten.
 * @param posten Array von { betrag, faelligAb } - faelligAb = Datum ab dem Verzug gilt (4. Werktag Folgemonat)
 * @param stichtag Datum bis zu dem Zinsen berechnet werden (default: heute)
 * @param perioden Optionale DB-Basiszinssatz-Perioden
 */
export function berechneAlleVerzugszinsen(
  posten: Array<{ betrag: number; faelligAb: string }>,
  stichtag?: Date,
  perioden?: Array<{ ab: string; satz: number }>
): { details: VerzugszinsPosten[]; gesamt: number } {
  const bis = stichtag || new Date();
  const details: VerzugszinsPosten[] = [];
  let gesamt = 0;

  for (const p of posten) {
    const von = new Date(p.faelligAb);
    if (von >= bis) continue;

    const ergebnis = berechneVerzugszins(p.betrag, von, bis, perioden);
    details.push(ergebnis);
    gesamt += ergebnis.zinsbetrag;
  }

  return {
    details,
    gesamt: Math.round(gesamt * 100) / 100,
  };
}
