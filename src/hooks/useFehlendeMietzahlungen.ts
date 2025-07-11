
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
      
      // Hole alle Mietforderungen mit vollständigen Mietvertrag-Informationen
      // Verwende die spezifische Foreign Key Beziehung
      const { data: forderungen, error: forderungenError } = await supabase
        .from('mietforderungen')
        .select(`
          id,
          sollbetrag,
          sollmonat,
          mietvertrag_id,
          mietvertrag!mietforderungen_mietvertrag_id_fkey(
            id,
            kaltmiete,
            betriebskosten,
            status,
            kuendigungsdatum,
            einheiten!mietvertraege_einheit_id_fkey(
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
          )
        `);
      
      if (forderungenError) {
        console.error('Fehler beim Laden der Forderungen:', forderungenError);
        throw forderungenError;
      }

      // Hole nur Zahlungen mit Kategorie "Miete (komplett)"
      const { data: zahlungen, error: zahlungenError } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('kategorie', 'Miete (komplett)');
      
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
        forderungen: forderungen?.length, 
        zahlungen: zahlungen?.length,
        mietvertragMieter: mietvertragMieter?.length,
        dokumente: dokumente?.length
      });

      // Berechne fehlende Zahlungen pro Mietvertrag
      const fehlendMap = new Map();
      
      forderungen?.forEach(forderung => {
        const mietvertragId = forderung.mietvertrag_id;
        if (!mietvertragId || !forderung.mietvertrag) return;

        // Summiere alle Zahlungen mit Kategorie "Miete (komplett)" für diesen Mietvertrag
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
            `${hauptmieter.mieter.vorname} ${hauptmieter.mieter.nachname}` : 'Unbekannt';

          // Bestimme ob Mietvertrag gekündigt ist (Status = 'gekuendigt' UND Kündigungsdatum vorhanden)
          const istGekuendigt = forderung.mietvertrag.status === 'gekuendigt' && 
                               forderung.mietvertrag.kuendigungsdatum;
          const status = istGekuendigt ? 'Gekündigt' : forderung.mietvertrag.status || 'Unbekannt';

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
            mietvertrag_status: status
          });
        }
      });

      const result = Array.from(fehlendMap.values()) as FehlendeMietzahlung[];
      console.log('Berechnete fehlende Mietzahlungen:', result.length);
      return result;
    }
  });
};
