import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateMietvertragRueckstand, calculateMieteZahlungen } from "@/utils/rueckstandsberechnung";

export interface FehlendeMietzahlung {
  mietvertrag_id: string;
  fehlend_betrag: number;
  gesamt_forderungen: number;
  gesamt_zahlungen: number;
  miete_zahlungen: number;
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
  mahnstufe: number;
}

export const useRueckstaende = () => {
  return useQuery({
    queryKey: ['rueckstaende'],
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      console.log('=== NEUE RÜCKSTANDS-BERECHNUNG ===');
      
      // Lade alle notwendigen Daten parallel
      const [
        { data: mietvertraege, error: mietvertrageError },
        { data: einheiten, error: einheitenError },
        { data: immobilien, error: immobilienError },
        { data: mietvertragMieter, error: mmError },
        { data: dokumente, error: dokumenteError }
      ] = await Promise.all([
        supabase.from('mietvertrag').select('*'),
        supabase.from('einheiten').select('*'),
        supabase.from('immobilien').select('*'),
        supabase.from('mietvertrag_mieter').select(`
          mietvertrag_id,
          mieter_id,
          mieter!mietvertrag_mieter_mieter_id_fkey(
            id,
            vorname,
            nachname,
            hauptmail,
            telnr
          )
        `),
        supabase.from('dokumente').select('*')
      ]);
      
      // Error handling
      if (mietvertrageError) throw mietvertrageError;
      if (einheitenError) throw einheitenError;
      if (immobilienError) throw immobilienError;
      if (mmError) throw mmError;
      if (dokumenteError) throw dokumenteError;
      
      console.log('Geladene Daten:', {
        mietvertraege: mietvertraege?.length,
        einheiten: einheiten?.length,
        immobilien: immobilien?.length,
        mietvertragMieter: mietvertragMieter?.length,
        dokumente: dokumente?.length
      });
      
      const rueckstaende: FehlendeMietzahlung[] = [];
      
      // Berechne für jeden aktiven Mietvertrag
      for (const mietvertrag of mietvertraege || []) {
        // Nur aktive Mietverträge berücksichtigen
        if (mietvertrag.status !== 'aktiv') continue;
        
        // Skip wenn keine Miete definiert ist
        if ((mietvertrag.kaltmiete || 0) === 0 && (mietvertrag.betriebskosten || 0) === 0) continue;
        
        // IDENTISCH ZUM MODAL: Lade Daten für diesen spezifischen Mietvertrag
        const [
          { data: mietvertragForderungen, error: forderungenError },
          { data: mietvertragZahlungen, error: zahlungenError }
        ] = await Promise.all([
          supabase.from('mietforderungen').select('*').eq('mietvertrag_id', mietvertrag.id),
          supabase.from('zahlungen').select('*').eq('mietvertrag_id', mietvertrag.id)
        ]);
        
        if (forderungenError || zahlungenError) continue;
        
        // VERWENDE EXAKT DIE GLEICHE LOGIK WIE IM MODAL
        const { gesamtForderungen, gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
          mietvertrag,
          mietvertragForderungen || [],
          mietvertragZahlungen || []
        );
        
        console.log(`Mietvertrag ${mietvertrag.id}: Forderungen=${gesamtForderungen}, Zahlungen=${gesamtZahlungen}, Rückstand=${rueckstand}`);
        
        // Nur Rückstände > 0 anzeigen
        if (rueckstand > 0) {
          // Lade zusätzliche Informationen
          const einheit = einheiten?.find(e => e.id === mietvertrag.einheit_id);
          const immobilie = immobilien?.find(i => i.id === einheit?.immobilie_id);
          const alleMieter = mietvertragMieter?.filter(mm => mm.mietvertrag_id === mietvertrag.id) || [];
          const ersteMieter = alleMieter[0];
          const mietvertragDokumente = dokumente?.filter(dok => dok.mietvertrag_id === mietvertrag.id) || [];
          
          // Berechne Miete-Zahlungen separat
          const mieteZahlungenSumme = calculateMieteZahlungen(mietvertragZahlungen || []);
          
          rueckstaende.push({
            mietvertrag_id: mietvertrag.id,
            fehlend_betrag: rueckstand,
            gesamt_forderungen: gesamtForderungen,
            gesamt_zahlungen: gesamtZahlungen,
            miete_zahlungen: mieteZahlungenSumme,
            immobilie_name: immobilie?.name || 'Unbekannt',
            immobilie_adresse: immobilie?.adresse || 'Unbekannt',
            einheit_typ: einheit?.einheitentyp || 'Unbekannt',
            einheit_etage: einheit?.etage || 'Unbekannt',
            einheit_qm: einheit?.qm || 0,
            mieter_name: ersteMieter?.mieter ? 
              `${ersteMieter.mieter.vorname} ${ersteMieter.mieter.nachname}` : 'Unbekannt',
            mieter_email: ersteMieter?.mieter?.hauptmail || 'Unbekannt',
            alle_mieter: alleMieter,
            mietvertrag: mietvertrag,
            dokumente: mietvertragDokumente,
            kaltmiete: mietvertrag.kaltmiete || 0,
            betriebskosten: mietvertrag.betriebskosten || 0,
            mietvertrag_status: 'Aktiv',
            mahnstufe: mietvertrag.mahnstufe || 0
          });
        }
      }
      
      console.log('=== ENDERGEBNIS (IDENTISCH ZUM MODAL) ===');
      console.log('Berechnete Rückstände:', rueckstaende.length);
      console.log('Gesamtrückstand:', rueckstaende.reduce((sum, item) => sum + item.fehlend_betrag, 0));
      
      return rueckstaende;
    }
  });
};