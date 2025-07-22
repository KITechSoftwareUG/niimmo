
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
        .select(`
          id,
          lastschrift,
          kaltmiete,
          betriebskosten,
          status,
          kuendigungsdatum,
          einheiten!mietvertrag_einheit_id_fkey(
            id,
            einheitentyp,
            etage,
            qm,
            immobilien!einheiten_immobilie_id_fkey(
              id,
              name,
              adresse
            )
          )
        `);
      
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

      // Hole alle Zahlungen (alle Kategorien)
      const { data: zahlungen, error: zahlungenError } = await supabase
        .from('zahlungen')
        .select('*');
      
      if (zahlungenError) {
        console.error('Fehler beim Laden der Zahlungen:', zahlungenError);
        throw zahlungenError;
      }

      // Hole Mieter-Informationen für jeden Mietvertrag
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

      // Hole Dokumente für jeden Mietvertrag
      const { data: dokumente, error: dokumenteError } = await supabase
        .from('dokumente')
        .select(`
          id,
          mietvertrag_id,
          titel,
          kategorie,
          dateityp
        `);
      
      if (dokumenteError) {
        console.error('Fehler beim Laden der Dokumente:', dokumenteError);
        throw dokumenteError;
      }

      console.log('Geladene Daten:', { 
        mietvertraege: mietvertraege?.length,
        forderungen: forderungen?.length, 
        zahlungen: zahlungen?.length,
        mietvertragMieter: mietvertragMieter?.length,
        dokumente: dokumente?.length
      });

      const heute = new Date();
      const fehlendMap = new Map();

      // Pro Mietvertrag die Zahlungsstatus berechnen
      for (const mietvertrag of mietvertraege || []) {
        const mietvertragId = mietvertrag.id;
        const istLastschrift = mietvertrag.lastschrift;

        // Forderungen für diesen Mietvertrag nach Monat gruppieren
        const mietvertragForderungen = forderungen?.filter(f => f.mietvertrag_id === mietvertragId) || [];
        const mietvertragZahlungen = zahlungen?.filter(z => z.mietvertrag_id === mietvertragId) || [];

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
            originalBetrag: zahlung.betrag || 0
          }))
          .sort((a, b) => a.buchungsdatum.getTime() - b.buchungsdatum.getTime());

        let gesamtFehlendBetrag = 0;
        let gesamtForderung = 0;
        let effektiveZahlungen = 0;

        // Für jeden Forderungsmonat prüfen
        const monate = Array.from(forderungenNachMonat.keys()).sort();
        let verfuegbareZahlungen = [...sortiertZahlungen];

        for (const monat of monate) {
          const sollbetrag = forderungenNachMonat.get(monat) || 0;
          gesamtForderung += sollbetrag;
          
          let bezahltBetrag = 0;
          
          // Zahlungen chronologisch den ältesten Forderungen zuordnen
          for (let i = 0; i < verfuegbareZahlungen.length && bezahltBetrag < sollbetrag; i++) {
            const zahlung = verfuegbareZahlungen[i];
            
            if (zahlung.betrag <= 0) continue;
            
            // Bei Lastschrift: 6 Tage Wartezeit prüfen
            let zahlungGueltig = true;
            if (istLastschrift) {
              const zahlungMitWartezeit = new Date(zahlung.buchungsdatum);
              zahlungMitWartezeit.setDate(zahlungMitWartezeit.getDate() + 6);
              
              if (heute < zahlungMitWartezeit) {
                zahlungGueltig = false; // Zahlung noch in Wartezeit
              }
            }
            
            if (zahlungGueltig) {
              const verfuegbarBetrag = Math.min(zahlung.betrag, sollbetrag - bezahltBetrag);
              bezahltBetrag += verfuegbarBetrag;
              zahlung.betrag -= verfuegbarBetrag; // Zahlung anteilig verbrauchen
            }
          }

          effektiveZahlungen += bezahltBetrag;
          const monatFehlend = Math.max(0, sollbetrag - bezahltBetrag);
          gesamtFehlendBetrag += monatFehlend;
        }

        // Nur Mietverträge mit fehlenden Beträgen hinzufügen
        if (gesamtFehlendBetrag > 0) {
          const alleMieter = mietvertragMieter?.filter(mm => mm.mietvertrag_id === mietvertragId) || [];
          const hauptmieter = alleMieter.find(mm => mm.rolle === 'Hauptmieter');
          
          const mietvertragDokumente = dokumente?.filter(dok => dok.mietvertrag_id === mietvertragId) || [];

          const immobilieName = mietvertrag.einheiten?.immobilien?.name || 'Unbekannt';
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
            immobilie_adresse: mietvertrag.einheiten?.immobilien?.adresse || 'Unbekannt',
            einheit_typ: mietvertrag.einheiten?.einheitentyp || 'Unbekannt',
            einheit_etage: mietvertrag.einheiten?.etage || 'Unbekannt',
            einheit_qm: mietvertrag.einheiten?.qm || 0,
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
      return result;
    }
  });
};
