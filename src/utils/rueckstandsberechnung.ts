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
  
  // Gruppiere Zahlungen nach zugeordnetem Monat
  const zahlungenByMonth = new Map<string, any[]>();
  verarbeiteteZahlungen.forEach(z => {
    if (!z.zugeordneter_monat) return;
    const monat = z.zugeordneter_monat;
    if (!zahlungenByMonth.has(monat)) {
      zahlungenByMonth.set(monat, []);
    }
    zahlungenByMonth.get(monat)!.push(z);
  });
  
  // Bestimme fällige Forderungen: entweder ist_faellig = true ODER es gibt Zahlungen zu dem Monat
  const faelligeForderungen = alleForderungenAbStart.filter(forderung => {
    // Wenn bereits als fällig markiert, dann einbeziehen
    if (forderung.ist_faellig) return true;
    
    // Wenn nicht fällig, prüfe ob es Zahlungen zu diesem Monat gibt
    const monat = forderung.sollmonat;
    const zahlungenFuerMonat = zahlungenByMonth.get(monat) || [];
    
    // Wenn Zahlungen vorhanden, dann auch einbeziehen (auch wenn noch nicht fällig)
    return zahlungenFuerMonat.length > 0;
  });
  
  const relevanteForderungen = faelligeForderungen;
  
  // Berechne Gesamtforderungen
  const gesamtForderungen = relevanteForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
  
  // Debug: Log der Berechnungsschritte
  console.log('=== RÜCKSTANDSBERECHNUNG DEBUG ===');
  console.log('Alle eingegangenen Zahlungen:', zahlungen.length);
  console.log('Relevante Zahlungen (nach Filtern):', relevanteZahlungen.length);
  console.log('Verarbeitete Zahlungen:', verarbeiteteZahlungen.length);
  console.log('Fällige Forderungen:', relevanteForderungen.length);
  
  console.log('Detaillierte Zahlungen:');
  relevanteZahlungen.forEach(z => {
    console.log(`- ${z.buchungsdatum}: ${z.betrag}€ (${z.kategorie}) - Monat: ${z.zugeordneter_monat}`);
  });
  
  console.log('Verarbeitete Zahlungen:');
  verarbeiteteZahlungen.forEach(z => {
    console.log(`- ${z.buchungsdatum}: ${z.betrag}€ (${z.kategorie}) - Monat: ${z.zugeordneter_monat}${z._verschoben_von ? ` (verschoben von ${z._verschoben_von})` : ''}`);
  });

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
  
  console.log('Berechnete Gesamtzahlungen:', gesamtZahlungen);
  console.log('=== ENDE DEBUG ===');
  
  const rueckstand = gesamtForderungen - gesamtZahlungen;
  
  return { gesamtForderungen, gesamtZahlungen, rueckstand };
};

// Einfache Berechnung für Miete-Zahlungen (alle mit Kategorie "Miete")
export const calculateMieteZahlungen = (zahlungen: any[]): number => {
  return zahlungen
    .filter(z => z.kategorie === 'Miete')
    .reduce((sum, z) => sum + (Number(z.betrag) || 0), 0);
};