import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FehlendeMietzahlung {
  mietvertrag_id: string;
  fehlend_betrag: number;
  gesamt_forderungen: number;
  gesamt_zahlungen: number;
  immobilie_name: string;
  immobilie_adresse: string;
  einheit_typ: string;
  einheit_etage: string;
  einheit_qm: number;
  mieter_name: string;
  mieter_email: string;
  alle_mieter: any[];
  mietvertrag: any;
  dokumente: any[];
  kaltmiete: number;
  betriebskosten: number;
  mietvertrag_status: string;
}

export const useFehlendeMietzahlungen = () => {
  return useQuery({
    queryKey: ['fehlende-mietzahlungen'],
    queryFn: async () => {
      console.log('Lade fehlende Mietzahlungen...');
      
      // Hole alle Mietverträge mit Lastschrift-Information
      const { data: mietvertraege, error: mietvertrageError } = await supabase
        .from('mietvertrag')
        .select('*');
      
      if (mietvertrageError) {
        console.error('Fehler beim Laden der Mietverträge:', mietvertrageError);
        throw mietvertrageError;
      }

      // Hole alle Mietforderungen
      const { data: forderungen, error: forderungenError } = await supabase
        .from('mietforderungen')
        .select('*');
      
      if (forderungenError) {
        console.error('Fehler beim Laden der Forderungen:', forderungenError);
        throw forderungenError;
      }

        // Hole alle Zahlungen - nur Mietzahlungen für Hauptberechnung
        const { data: allZahlungen, error: zahlungenError } = await supabase
          .from('zahlungen')
          .select('*');
        
        if (zahlungenError) {
          console.error('Fehler beim Laden der Zahlungen:', zahlungenError);
          throw zahlungenError;
        }

        // Prüfe ob Zahlungen existieren, sonst leere Arrays
        const zahlungen = (allZahlungen && allZahlungen.length > 0) 
          ? allZahlungen.filter(z => z.kategorie === 'Miete (komplett)' || z.kategorie === 'Miete (unklar)')
          : [];
        
        // Sonstige Zahlungen für separate Anzeige (Nichtmiete)
        const sonstigeZahlungen = (allZahlungen && allZahlungen.length > 0)
          ? allZahlungen.filter(z => z.kategorie === 'Nichtmiete')
          : [];

      // Hole alle Einheiten
      const { data: einheiten, error: einheitenError } = await supabase
        .from('einheiten')
        .select('*');
      
      if (einheitenError) {
        console.error('Fehler beim Laden der Einheiten:', einheitenError);
        throw einheitenError;
      }

      // Hole alle Immobilien
      const { data: immobilien, error: immobilienError } = await supabase
        .from('immobilien')
        .select('*');
      
      if (immobilienError) {
        console.error('Fehler beim Laden der Immobilien:', immobilienError);
        throw immobilienError;
      }

      // Hole Mieter-Informationen
      const { data: mietvertragMieter, error: mmError } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mietvertrag_id,
          rolle,
          Hinweis,
          mieter_id,
          mieter!mietvertrag_mieter_mieter_id_fkey(
            id,
            vorname,
            nachname,
            hauptmail
          )
        `);
      
      if (mmError) {
        console.error('Fehler beim Laden der Mieter:', mmError);
        throw mmError;
      }

      // Hole Dokumente
      const { data: dokumente, error: dokumenteError } = await supabase
        .from('dokumente')
        .select('*');
      
      if (dokumenteError) {
        console.error('Fehler beim Laden der Dokumente:', dokumenteError);
        throw dokumenteError;
      }

      console.log('Geladene Daten:', { 
        mietvertraege: mietvertraege?.length,
        forderungen: forderungen?.length, 
        zahlungen: zahlungen?.length,
        einheiten: einheiten?.length,
        immobilien: immobilien?.length,
        mietvertragMieter: mietvertragMieter?.length,
        dokumente: dokumente?.length
      });

      const heute = new Date();
      const fehlendMap = new Map();

      // Pro Mietvertrag die Zahlungsstatus berechnen mit verbesserter Logik
      for (const mietvertrag of mietvertraege || []) {
        const mietvertragId = mietvertrag.id;
        const istLastschrift = mietvertrag.lastschrift || false;

        // Forderungen für diesen Mietvertrag nach Monat gruppieren
        const mietvertragForderungen = forderungen?.filter(f => f.mietvertrag_id === mietvertragId) || [];
        const mietvertragZahlungen = zahlungen?.filter(z => z.mietvertrag_id === mietvertragId) || [];

        if (mietvertragForderungen.length === 0) continue;

        // Forderungen nach Monat gruppieren
        const forderungenNachMonat = new Map<string, number>();
        mietvertragForderungen.forEach(forderung => {
          const monat = forderung.sollmonat;
          if (monat) {
            forderungenNachMonat.set(monat, (forderungenNachMonat.get(monat) || 0) + (forderung.sollbetrag || 0));
          }
        });

        // Zahlungen nach Buchungsdatum sortieren
        const sortiertZahlungen = mietvertragZahlungen
          .map(zahlung => ({
            ...zahlung,
            buchungsdatum: new Date(zahlung.buchungsdatum),
            restbetrag: zahlung.betrag || 0
          }))
          .sort((a, b) => a.buchungsdatum.getTime() - b.buchungsdatum.getTime());

        let gesamtFehlendBetrag = 0;
        let gesamtForderung = 0;
        let effektiveZahlungen = 0;

        // Für jeden Forderungsmonat prüfen (chronologisch)
        const monate = Array.from(forderungenNachMonat.keys()).sort();
        
        for (const monat of monate) {
          const sollbetrag = forderungenNachMonat.get(monat) || 0;
          gesamtForderung += sollbetrag;
          
          let bezahltBetrag = 0;
          
          // Zahlungen chronologisch den ältesten Forderungen zuordnen
          for (const zahlung of sortiertZahlungen) {
            if (zahlung.restbetrag <= 0 || bezahltBetrag >= sollbetrag) continue;
            
            // Bei Lastschrift: 6 Tage Wartezeit prüfen
            let zahlungGueltig = true;
            if (istLastschrift) {
              const zahlungMitWartezeit = new Date(zahlung.buchungsdatum);
              zahlungMitWartezeit.setDate(zahlungMitWartezeit.getDate() + 6);
              
              if (heute < zahlungMitWartezeit) {
                zahlungGueltig = false; // Zahlung noch in 6-Tage-Wartezeit bei Lastschrift
              }
            }
            
            if (zahlungGueltig) {
              const verfuegbarBetrag = Math.min(zahlung.restbetrag, sollbetrag - bezahltBetrag);
              bezahltBetrag += verfuegbarBetrag;
              zahlung.restbetrag -= verfuegbarBetrag; // Zahlung anteilig verbrauchen
            }
          }

          effektiveZahlungen += bezahltBetrag;
          const monatFehlend = Math.max(0, sollbetrag - bezahltBetrag);
          gesamtFehlendBetrag += monatFehlend;
        }

        // Nur Mietverträge mit fehlenden Beträgen hinzufügen
        if (gesamtFehlendBetrag > 0) {
          // Finde zugehörige Einheit und Immobilie
          const einheit = einheiten?.find(e => e.id === mietvertrag.einheit_id);
          const immobilie = immobilien?.find(i => i.id === einheit?.immobilie_id);

          const alleMieter = mietvertragMieter?.filter(mm => mm.mietvertrag_id === mietvertragId) || [];
          const hauptmieter = alleMieter.find(mm => mm.rolle === 'Hauptmieter');
          
          const mietvertragDokumente = dokumente?.filter(dok => dok.mietvertrag_id === mietvertragId) || [];

          const immobilieName = immobilie?.name || 'Unbekannt';
          const mieterName = hauptmieter?.mieter ? 
            `${hauptmieter.mieter.vorname} ${hauptmieter.mieter.nachname}` : 'Unbekannt';

          // Bestimme ob Mietvertrag gekündigt ist
          const istGekuendigt = mietvertrag.status === 'gekuendigt' && mietvertrag.kuendigungsdatum;
          const status = istGekuendigt ? 'Gekündigt' : mietvertrag.status || 'Unbekannt';

          fehlendMap.set(mietvertragId, {
            mietvertrag_id: mietvertragId,
            fehlend_betrag: gesamtFehlendBetrag,
            gesamt_forderungen: gesamtForderung,
            gesamt_zahlungen: effektiveZahlungen,
            immobilie_name: immobilieName,
            immobilie_adresse: immobilie?.adresse || 'Unbekannt',
            einheit_typ: einheit?.einheitentyp || 'Unbekannt',
            einheit_etage: einheit?.etage || 'Unbekannt',
            einheit_qm: einheit?.qm || 0,
            mieter_name: mieterName,
            mieter_email: hauptmieter?.mieter?.hauptmail || 'Unbekannt',
            alle_mieter: alleMieter,
            mietvertrag: mietvertrag,
            dokumente: mietvertragDokumente,
            kaltmiete: mietvertrag.kaltmiete || 0,
            betriebskosten: mietvertrag.betriebskosten || 0,
            mietvertrag_status: status
          });
        }
      }

      const result = Array.from(fehlendMap.values()) as FehlendeMietzahlung[];
      console.log('Berechnete fehlende Mietzahlungen mit Lastschrift-Logik:', result.length);
      console.log('Beispiel Rückstand:', result[0]);
      return result;
    }
  });
};