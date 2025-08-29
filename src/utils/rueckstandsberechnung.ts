// Shared calculation logic from MietvertragDetailsModal
export interface RueckstandsBerechnung {
  gesamtForderungen: number;
  gesamtZahlungen: number;
  rueckstand: number;
}

export const calculateMietvertragRueckstand = (
  mietvertrag: any,
  forderungen: any[],
  zahlungen: any[]
): RueckstandsBerechnung => {
  if (!mietvertrag || !forderungen || !zahlungen) {
    return { gesamtForderungen: 0, gesamtZahlungen: 0, rueckstand: 0 };
  }
  
  const heute = new Date();
  const istLastschrift = mietvertrag.lastschrift || false;
  
  // Bestimme Startdatum: später von Jan 2025 oder Mietvertragsbeginn
  const mietvertragStart = mietvertrag.start_datum ? new Date(mietvertrag.start_datum) : new Date('2025-01-01');
  const startDatum = mietvertragStart > new Date('2025-01-01') ? mietvertragStart : new Date('2025-01-01');
  
  // Filtere Forderungen ab Startdatum
  const relevanteForderungen = forderungen.filter(f => {
    if (!f.sollmonat) return false;
    const forderungsDatum = new Date(f.sollmonat + '-01');
    return forderungsDatum >= startDatum;
  });
  
  // Filtere Zahlungen ab Startdatum und nach Kategorie
  const relevanteZahlungen = zahlungen.filter(z => {
    if (!z.buchungsdatum) return false;
    
    // Zeitraum-Filter
    const zahlungsDatum = new Date(z.buchungsdatum);
    if (zahlungsDatum < startDatum) return false;
    
    // Kategorie-Filter (exakt wie im Modal)
    return z.kategorie === 'Miete' || 
           z.kategorie === null || 
           (z.betrag > 0 && z.kategorie !== 'Nichtmiete');
  });

  console.log(`Utility Debug für ${mietvertrag.id}:`, {
    alleZahlungenFuerVertrag: zahlungen.length, // Bereits nach mietvertrag_id gefiltert
    relevanteZahlungen: relevanteZahlungen.length,
    startDatum: startDatum.toISOString(),
    zahlungenDetails: relevanteZahlungen.map(z => ({
      betrag: z.betrag,
      kategorie: z.kategorie,
      buchungsdatum: z.buchungsdatum
    }))
  });
  
  // Berechne Gesamtforderungen
  const gesamtForderungen = relevanteForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
  
  // Berechne Gesamtzahlungen mit 6-Tage-Wartezeit bei Lastschrift
  let gesamtZahlungen = 0;
  for (const zahlung of relevanteZahlungen) {
    let zahlungGueltig = true;
    
    if (istLastschrift) {
      const zahlungMitWartezeit = new Date(zahlung.buchungsdatum);
      zahlungMitWartezeit.setDate(zahlungMitWartezeit.getDate() + 6);
      
      if (heute < zahlungMitWartezeit) {
        zahlungGueltig = false; // Zahlung noch in 6-Tage-Wartezeit
      }
    }
    
    if (zahlungGueltig) {
      gesamtZahlungen += (Number(zahlung.betrag) || 0);
    }
  }
  
  const rueckstand = gesamtForderungen - gesamtZahlungen;
  
  console.log(`Utility Final für ${mietvertrag.id}: Forderungen=${gesamtForderungen}, Zahlungen=${gesamtZahlungen}, Rückstand=${rueckstand}`);
  
  return { gesamtForderungen, gesamtZahlungen, rueckstand };
};

// Einfache Berechnung für Miete-Zahlungen (alle mit Kategorie "Miete")
export const calculateMieteZahlungen = (zahlungen: any[]): number => {
  return zahlungen
    .filter(z => z.kategorie === 'Miete')
    .reduce((sum, z) => sum + (Number(z.betrag) || 0), 0);
};