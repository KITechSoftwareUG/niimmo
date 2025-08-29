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
  
  // Intelligente Vorauszahlungs-Logik
  const processVorauszahlungen = (zahlungen: any[], forderungen: any[]) => {
    // Erst: Verschiebe Zahlungen die 2-3 Tage vor Monatsbeginn stattfinden zum nächsten Monat
    const zahlungenMitMonatsverschiebung = zahlungen.map(zahlung => {
      if (!zahlung.buchungsdatum) return zahlung;
      
      const zahlungsDatum = new Date(zahlung.buchungsdatum);
      const tag = zahlungsDatum.getDate();
      
      // Wenn Zahlung am 28., 29., 30., oder 31. des Monats -> verschiebe zum nächsten Monat
      if (tag >= 28) {
        const naechsterMonat = new Date(zahlungsDatum);
        naechsterMonat.setMonth(naechsterMonat.getMonth() + 1);
        naechsterMonat.setDate(1); // 1. des nächsten Monats
        
        return {
          ...zahlung,
          buchungsdatum: naechsterMonat.toISOString().slice(0, 10),
          _verschoben_monatsende: true // Für Debugging
        };
      }
      
      return zahlung;
    });

    // Gruppiere Zahlungen nach Monaten (mit bereits verschobenen Zahlungen)
    const zahlungenByMonth = new Map<string, any[]>();
    zahlungenMitMonatsverschiebung.forEach(z => {
      if (!z.buchungsdatum) return;
      const zahlungsmonat = z.buchungsdatum.slice(0, 7); // YYYY-MM
      if (!zahlungenByMonth.has(zahlungsmonat)) {
        zahlungenByMonth.set(zahlungsmonat, []);
      }
      zahlungenByMonth.get(zahlungsmonat)!.push(z);
    });

    // Sammle alle Forderungsmonate
    const forderungsmonate = new Set(forderungen.map(f => f.sollmonat).filter(Boolean));
    
    // Verarbeite Vorauszahlungen (verwende bereits monatsweise verschobene Zahlungen)
    const verarbeiteteZahlungen = [...zahlungenMitMonatsverschiebung];
    
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
              // Erstelle neue Buchungsdatum im Zielmonat (1. des Monats)
              const neuesDatum = naechsterForderungsmonat + '-01';
              verarbeiteteZahlungen[zahlungsIndex] = {
                ...zahlung,
                buchungsdatum: neuesDatum,
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
    
    // Kategorie-Filter (exakt wie im Modal)
    return z.kategorie === 'Miete' || 
           z.kategorie === null || 
           (z.betrag > 0 && z.kategorie !== 'Nichtmiete' && String(z.kategorie) !== 'Ignorieren');
  });

  // Wende Vorauszahlungs-Intelligenz an
  const verarbeiteteZahlungen = processVorauszahlungen(relevanteZahlungen, relevanteForderungen);
  
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