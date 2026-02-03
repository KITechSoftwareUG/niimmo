// Shared calculation logic from MietvertragDetailsModal
export interface RueckstandsBerechnung {
  gesamtForderungen: number;
  gesamtZahlungen: number;
  rueckstand: number;
  unbestaetigteLastschriften: number; // Betrag der Zahlungen ohne lastschrift_bestaetigt_am
}

// Helper function to check if a Lastschrift payment is confirmed
export const isLastschriftConfirmed = (zahlung: any, mietvertrag?: any): boolean => {
  // If lastschrift_bestaetigt_am is set, the payment is confirmed
  if (zahlung.lastschrift_bestaetigt_am) {
    return true;
  }
  
  // If the contract doesn't use Lastschrift, the payment is automatically confirmed
  if (!mietvertrag?.lastschrift) {
    return true;
  }
  
  // Payment is not confirmed (within waiting period)
  return false;
};

// Calculate remaining waiting days for unconfirmed Lastschrift payment
export const getRemainingWaitDays = (zahlung: any, mietvertrag?: any): number => {
  if (!mietvertrag?.lastschrift) return 0;
  if (zahlung.lastschrift_bestaetigt_am) return 0;
  
  const wartetage = mietvertrag.lastschrift_wartetage || 4;
  const buchungsdatum = new Date(zahlung.buchungsdatum);
  const heute = new Date();
  const daysSincePayment = Math.floor((heute.getTime() - buchungsdatum.getTime()) / (1000 * 60 * 60 * 24));
  
  return Math.max(0, wartetage - daysSincePayment);
};

export const calculateMietvertragRueckstand = (
  mietvertrag: any,
  forderungen: any[],
  zahlungen: any[]
): RueckstandsBerechnung => {
  if (!mietvertrag || !forderungen || !zahlungen) {
    return { gesamtForderungen: 0, gesamtZahlungen: 0, rueckstand: 0, unbestaetigteLastschriften: 0 };
  }
  
  const istLastschrift = mietvertrag.lastschrift || false;
  
  // Bestimme Startdatum: Mietvertragsbeginn (ohne künstliche Begrenzung auf 2025)
  // Alle Forderungen verwenden - ohne Filterung nach Startdatum
  const alleForderungenAbStart = forderungen.filter(f => {
    if (!f.sollmonat) return false;
    return true;
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

  // Filtere Zahlungen nach Kategorie (ohne Zeitraum-Filter)
  const relevanteZahlungen = zahlungen.filter(z => {
    if (!z.buchungsdatum) return false;
    
    // Nur Kategorie-Filter (exakt wie im Modal) - Mietkaution ausschließen
    return z.kategorie === 'Miete' || 
           z.kategorie === 'Rücklastschrift' ||
           z.kategorie === null || 
           (z.betrag > 0 && z.kategorie !== 'Nichtmiete' && 
            String(z.kategorie) !== 'Ignorieren' && 
            String(z.kategorie) !== 'Mietkaution');
  });

  // Wende Vorauszahlungs-Intelligenz an (jetzt basierend auf DB-Feld zugeordneter_monat)
  const verarbeiteteZahlungen = processVorauszahlungen(relevanteZahlungen, alleForderungenAbStart);
  
  // NUR FÄLLIGE Forderungen berücksichtigen für Rückstandsberechnung
  // Eine Forderung gilt als fällig wenn faelligkeitsdatum <= heute
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  
  const relevanteForderungen = alleForderungenAbStart.filter(f => {
    if (!f.faelligkeitsdatum) return true; // Ohne Datum = fällig
    const faellig = new Date(f.faelligkeitsdatum);
    faellig.setHours(0, 0, 0, 0);
    return faellig <= heute;
  });
  
  // Berechne Gesamtforderungen
  const gesamtForderungen = relevanteForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
  
  // Berechne Gesamtzahlungen - NUR bestätigte Zahlungen werden einberechnet
  // Unbestätigte Lastschriften werden separat getrackt
  let gesamtZahlungen = 0;
  let unbestaetigteLastschriften = 0;
  
  for (const zahlung of verarbeiteteZahlungen) {
    const zahlungsBetrag = Number(zahlung.betrag) || 0;
    
    // Prüfe ob die Zahlung bestätigt ist
    const istBestaetigt = isLastschriftConfirmed(zahlung, mietvertrag);
    
    if (istBestaetigt) {
      // Nur bestätigte Zahlungen werden in die Bilanz eingerechnet
      gesamtZahlungen += zahlungsBetrag;
    } else {
      // Unbestätigte Lastschriften werden separat getrackt
      unbestaetigteLastschriften += zahlungsBetrag;
    }
  }
  
  // Berechne Rücklastschrift-Gebühren (diese werden immer abgezogen)
  const ruecklastschriftGebuehren = zahlungen
    .filter(z => z.kategorie === 'Rücklastschrift')
    .reduce((sum, z) => sum + (Number(z.ruecklastschrift_gebuehr) || 0), 0);
  
  const rueckstand = gesamtForderungen - gesamtZahlungen - ruecklastschriftGebuehren;
  
  return { gesamtForderungen, gesamtZahlungen, rueckstand, unbestaetigteLastschriften };
};

// Einfache Berechnung für Miete-Zahlungen (alle mit Kategorie "Miete")
export const calculateMieteZahlungen = (zahlungen: any[]): number => {
  return zahlungen
    .filter(z => z.kategorie === 'Miete')
    .reduce((sum, z) => sum + (Number(z.betrag) || 0), 0);
};

// Berechnung der gesamten Rücklastschrift-Gebühren
export const calculateRuecklastschriftGebuehren = (zahlungen: any[]): number => {
  return zahlungen
    .filter(z => z.kategorie === 'Rücklastschrift')
    .reduce((sum, z) => sum + (Number(z.ruecklastschrift_gebuehr) || 0), 0);
};