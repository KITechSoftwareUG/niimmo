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
  
  // Bestimme Startdatum: Mietvertragsbeginn (ohne künstliche Begrenzung auf 2025)
  const startDatum = mietvertrag.start_datum ? new Date(mietvertrag.start_datum) : new Date('2024-01-01');
  
  // Filtere Forderungen ab Startdatum - alle Forderungen im Zeitraum
  const alleForderungenAbStart = forderungen.filter(f => {
    if (!f.sollmonat) return false;
    const forderungsDatum = new Date(f.sollmonat + '-01');
    return forderungsDatum >= startDatum;
  });
  
  // Vereinfachte Vorauszahlungs-Logik basierend auf zugeordneter_monat aus DB
  const processVorauszahlungen = (zahlungen: any[], forderungen: any[]) => {
    // Sammle alle Forderungsmonate
    const forderungsmonate = new Set(forderungen.map(f => f.sollmonat).filter(Boolean));
    
    // Gruppiere Zahlungen nach zugeordnetem Monat (kommt jetzt aus der DB)
    const zahlungenByMonth = new Map<string, any[]>();
    zahlungen.forEach(z => {
      if (!z.zugeordneter_monat) return;
      const zugeordneterMonat = z.zugeordneter_monat; // YYYY-MM aus DB
      if (!zahlungenByMonth.has(zugeordneterMonat)) {
        zahlungenByMonth.set(zugeordneterMonat, []);
      }
      zahlungenByMonth.get(zugeordneterMonat)!.push(z);
    });
    
    // Verarbeite Vorauszahlungen - verschiebe zu nächstem Forderungsmonat wenn kein passender existiert
    const verarbeiteteZahlungen = [...zahlungen];
    
    zahlungenByMonth.forEach((monthZahlungen, zahlungsmonat) => {
      // Wenn es für diesen Monat keine Forderung gibt
      if (!forderungsmonate.has(zahlungsmonat)) {
        // Finde den nächsten Monat mit Forderung
        const naechsterForderungsmonat = Array.from(forderungsmonate)
          .filter(fm => fm > zahlungsmonat)
          .sort()[0];
        
        if (naechsterForderungsmonat) {
          // Verschiebe alle Zahlungen dieses Monats zum nächsten Forderungsmonat
          monthZahlungen.forEach(zahlung => {
            const zahlungsIndex = verarbeiteteZahlungen.findIndex(z => z.id === zahlung.id);
            if (zahlungsIndex !== -1) {
              // Verwende zugeordneter_monat für die Verschiebung
              verarbeiteteZahlungen[zahlungsIndex] = {
                ...zahlung,
                zugeordneter_monat: naechsterForderungsmonat,
                _verschoben_von: zahlungsmonat // Für Debugging
              };
            }
          });
        }
      }
    });
    
    return verarbeiteteZahlungen;
  };

  // Filtere Zahlungen ab Startdatum und nach Kategorie
  const relevanteZahlungen = zahlungen.filter(z => {
    if (!z.buchungsdatum) return false;
    
    // Zeitraum-Filter
    const zahlungsDatum = new Date(z.buchungsdatum);
    if (zahlungsDatum < startDatum) return false;
    
    // Kategorie-Filter (exakt wie im Modal) - Mietkaution ausschließen
    return z.kategorie === 'Miete' || 
           z.kategorie === 'Rücklastschrift' ||
           z.kategorie === null || 
           (z.betrag > 0 && z.kategorie !== 'Nichtmiete' && 
            String(z.kategorie) !== 'Ignorieren' && 
            String(z.kategorie) !== 'Mietkaution');
  });

  // Wende Vorauszahlungs-Intelligenz an (jetzt basierend auf DB-Feld zugeordneter_monat)
  const verarbeiteteZahlungen = processVorauszahlungen(relevanteZahlungen, alleForderungenAbStart);
  
  // ALLE Forderungen berücksichtigen (nicht nur fällige)
  const relevanteForderungen = alleForderungenAbStart;
  
  // Berechne Gesamtforderungen
  const gesamtForderungen = relevanteForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
  
  // Berechne Gesamtzahlungen mit 6-Tage-Wartezeit bei Lastschrift
  let gesamtZahlungen = 0;
  for (const zahlung of verarbeiteteZahlungen) {
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
  
  return { gesamtForderungen, gesamtZahlungen, rueckstand };
};

// Einfache Berechnung für Miete-Zahlungen (alle mit Kategorie "Miete")
export const calculateMieteZahlungen = (zahlungen: any[]): number => {
  return zahlungen
    .filter(z => z.kategorie === 'Miete')
    .reduce((sum, z) => sum + (Number(z.betrag) || 0), 0);
};