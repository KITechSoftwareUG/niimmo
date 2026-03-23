/**
 * Verzugszinsen-Berechnung nach § 288 BGB
 *
 * Verzugszinssatz = Basiszinssatz der Bundesbank + 5 Prozentpunkte (fuer Verbraucher)
 * Formel: (Rueckstand x Verzugszinssatz x Verzugstage) / (365 x 100)
 */

// Basiszinssatz der Deutschen Bundesbank (Stand 01.01.2025: 2,47%)
// Wird halbjaehrlich zum 01.01. und 01.07. angepasst.
// Quelle: https://www.bundesbank.de/de/bundesbank/organisation/agb-und-regelungen/basiszinssatz-702024
const BASISZINSSATZ_PERIODEN: Array<{ ab: string; satz: number }> = [
  { ab: '2025-01-01', satz: 2.27 },
  { ab: '2024-07-01', satz: 3.37 },
  { ab: '2024-01-01', satz: 3.62 },
  { ab: '2023-07-01', satz: 3.12 },
  { ab: '2023-01-01', satz: 1.62 },
];

// Aufschlag fuer Verbraucher-Mietverhaeltnisse: 5 Prozentpunkte
const AUFSCHLAG_VERBRAUCHER = 5;

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
 * Ermittelt den Basiszinssatz fuer ein gegebenes Datum
 */
export function getBasiszinssatz(datum: Date): number {
  const isoDate = datum.toISOString().split('T')[0];
  for (const periode of BASISZINSSATZ_PERIODEN) {
    if (isoDate >= periode.ab) return periode.satz;
  }
  return BASISZINSSATZ_PERIODEN[BASISZINSSATZ_PERIODEN.length - 1].satz;
}

/**
 * Berechnet die Anzahl Tage zwischen zwei Daten
 */
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
  verzugBis: Date
): VerzugszinsPosten {
  const tage = diffTage(verzugVon, verzugBis);
  const basiszinssatz = getBasiszinssatz(verzugVon);
  const verzugszinssatz = basiszinssatz + AUFSCHLAG_VERBRAUCHER;
  const zinsbetrag = (rueckstandBetrag * verzugszinssatz * tage) / (365 * 100);

  const monatLabel = verzugVon.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return {
    monat: monatLabel,
    rueckstandBetrag,
    verzugVon: verzugVon.toISOString().split('T')[0],
    verzugBis: verzugBis.toISOString().split('T')[0],
    tage,
    basiszinssatz,
    verzugszinssatz,
    zinsbetrag: Math.round(zinsbetrag * 100) / 100,
  };
}

/**
 * Berechnet Verzugszinsen fuer mehrere Rueckstandsposten
 * @param posten Array von { betrag, faelligAb } - Faelligkeitsdatum ist der Tag nach Faelligkeit
 * @param stichtag Datum bis zu dem Zinsen berechnet werden (default: heute)
 */
export function berechneAlleVerzugszinsen(
  posten: Array<{ betrag: number; faelligAb: string }>,
  stichtag?: Date
): { details: VerzugszinsPosten[]; gesamt: number } {
  const bis = stichtag || new Date();
  const details: VerzugszinsPosten[] = [];
  let gesamt = 0;

  for (const p of posten) {
    const von = new Date(p.faelligAb);
    if (von >= bis) continue;

    const ergebnis = berechneVerzugszins(p.betrag, von, bis);
    details.push(ergebnis);
    gesamt += ergebnis.zinsbetrag;
  }

  return {
    details,
    gesamt: Math.round(gesamt * 100) / 100,
  };
}
