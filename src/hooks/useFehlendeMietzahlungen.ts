
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
      // Hole alle Mietforderungen mit vollständigen Mietvertrag-Informationen
      const { data: forderungen, error: forderungenError } = await supabase
        .from('mietforderungen')
        .select(`
          id,
          sollbetrag,
          sollmonat,
          mietvertrag_id,
          mietvertrag!mietforderungen_mietvertrag_id_fkey(
            id,
            einheit_id,
            kaltmiete,
            betriebskosten,
            kaution_betrag,
            status,
            start_datum,
            ende_datum,
            kuendigungsdatum,
            bankkonto_mieter,
            weitere_bankkonten,
            verwendungszweck,
            erstellt_am,
            aktualisiert_am,
            einheiten!inner(
              id,
              einheitentyp,
              etage,
              qm,
              zaehler,
              immobilie_id,
              immobilien!inner(
                id,
                name,
                adresse,
                objekttyp,
                baujahr,
                einheiten_anzahl,
                beschreibung,
                "Kontonr.",
                Annuität
              )
            )
          )
        `);
      
      if (forderungenError) {
        console.error('Fehler beim Laden der Forderungen:', forderungenError);
        throw forderungenError;
      }

      // Hole alle Zahlungen
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
          mieter!inner(
            id,
            Vorname,
            Nachname,
            hauptmail,
            weitere_mails,
            erstellt_am,
            aktualisiert_am
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
          dateityp,
          groesse_bytes,
          pfad,
          erstellt_von,
          hochgeladen_am
        `);
      
      if (dokumenteError) {
        console.error('Fehler beim Laden der Dokumente:', dokumenteError);
        throw dokumenteError;
      }

      // Berechne fehlende Zahlungen pro Mietvertrag
      const fehlendMap = new Map();
      
      forderungen?.forEach(forderung => {
        const mietvertragId = forderung.mietvertrag_id;
        if (!mietvertragId || !forderung.mietvertrag) return;

        // Summiere alle Zahlungen für diesen Mietvertrag
        const gesamtZahlungen = zahlungen
          ?.filter(zahlung => zahlung.mietvertrag_id === mietvertragId)
          .reduce((sum, zahlung) => sum + (zahlung.betrag || 0), 0) || 0;

        // Summiere alle Forderungen für diesen Mietvertrag
        const gesamtForderungen = forderungen
          ?.filter(f => f.mietvertrag_id === mietvertragId)
          .reduce((sum, f) => sum + (f.sollbetrag || 0), 0) || 0;

        const fehlendBetrag = gesamtForderungen - gesamtZahlungen;

        if (fehlendBetrag > 0) {
          // Hole alle Mieter für diesen Mietvertrag
          const alleMieter = mietvertragMieter?.filter(mm => mm.mietvertrag_id === mietvertragId) || [];
          const hauptmieter = alleMieter.find(mm => mm.rolle === 'Hauptmieter');
          
          // Hole alle Dokumente für diesen Mietvertrag
          const mietvertragDokumente = dokumente?.filter(dok => dok.mietvertrag_id === mietvertragId) || [];

          const immobilieName = forderung.mietvertrag.einheiten?.immobilien?.name || 'Unbekannt';
          const mieterName = hauptmieter?.mieter ? 
            `${hauptmieter.mieter.Vorname} ${hauptmieter.mieter.Nachname}` : 'Unbekannt';

          fehlendMap.set(mietvertragId, {
            mietvertrag_id: mietvertragId,
            fehlend_betrag: fehlendBetrag,
            gesamt_forderungen: gesamtForderungen,
            gesamt_zahlungen: gesamtZahlungen,
            immobilie_name: immobilieName,
            immobilie_adresse: forderung.mietvertrag.einheiten?.immobilien?.adresse || 'Unbekannt',
            einheit_typ: forderung.mietvertrag.einheiten?.einheitentyp || 'Unbekannt',
            einheit_etage: forderung.mietvertrag.einheiten?.etage || 'Unbekannt',
            einheit_qm: forderung.mietvertrag.einheiten?.qm || 0,
            mieter_name: mieterName,
            mieter_email: hauptmieter?.mieter?.hauptmail || 'Unbekannt',
            alle_mieter: alleMieter,
            mietvertrag: forderung.mietvertrag,
            dokumente: mietvertragDokumente,
            kaltmiete: forderung.mietvertrag.kaltmiete || 0,
            betriebskosten: forderung.mietvertrag.betriebskosten || 0,
            mietvertrag_status: forderung.mietvertrag.status || 'Unbekannt'
          });
        }
      });

      return Array.from(fehlendMap.values()) as FehlendeMietzahlung[];
    }
  });
};
