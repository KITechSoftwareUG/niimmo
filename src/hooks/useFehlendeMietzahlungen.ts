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
  mahnstufe: number;
}

export const useFehlendeMietzahlungen = () => {
  return useQuery({
    queryKey: ['fehlende-mietzahlungen'],
    staleTime: 0, // Immer neu laden
    refetchOnMount: true,
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

        // Hole alle Zahlungen - einschließlich Mietzahlungen und unzugeordneter Zahlungen
        const { data: allZahlungen, error: zahlungenError } = await supabase
          .from('zahlungen')
          .select('*');
        
        if (zahlungenError) {
          console.error('Fehler beim Laden der Zahlungen:', zahlungenError);
          throw zahlungenError;
        }

        // Prüfe ob Zahlungen existieren, sonst leere Arrays
        // Berücksichtige Mietzahlungen (kategorie='Miete') und unzugeordnete Zahlungen (kategorie=null)
        // sowie positive Beträge (Eingänge) die potentiell Mietzahlungen sein könnten
        const zahlungen = (allZahlungen && allZahlungen.length > 0) 
          ? allZahlungen.filter(z => 
              z.kategorie === 'Miete' || 
              z.kategorie === null || 
              (z.betrag > 0 && z.kategorie !== 'Nichtmiete')
            )
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
          mieter_id,
          mieter!mietvertrag_mieter_mieter_id_fkey(
            id,
            vorname,
            nachname,
            hauptmail,
            telnr
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

      // Pro Mietvertrag die Zahlungsstatus berechnen - NUR AKTIVE MIETVERTRÄGE
      for (const mietvertrag of mietvertraege || []) {
        const mietvertragId = mietvertrag.id;
        const istLastschrift = mietvertrag.lastschrift || false;
        const kaltmiete = mietvertrag.kaltmiete || 0;
        const betriebskosten = mietvertrag.betriebskosten || 0;

        // Nur aktive Mietverträge berücksichtigen
        if (mietvertrag.status !== 'aktiv') {
          console.log(`Mietvertrag ${mietvertragId}: Übersprungen (Status: ${mietvertrag.status})`);
          continue;
        }

        // Wenn sowohl Kaltmiete als auch Betriebskosten 0 sind, überspringen
        // Diese Mietverträge gelten als "Bezahlt" und benötigen manuelle Prüfung
        if (kaltmiete === 0 && betriebskosten === 0) {
          console.log(`Mietvertrag ${mietvertragId}: Übersprungen (Kaltmiete=0€, Betriebskosten=0€) - manuelle Prüfung erforderlich`);
          continue;
        }

        // IDENTISCHE LOGIK WIE IM MIETVERTRAG-DETAIL:
        // Alle Forderungen für diesen Mietvertrag (gesamter Zeitraum ab Januar 2025 UND ab Mietvertragsbeginn)
        const mietvertragStart = mietvertrag.start_datum ? new Date(mietvertrag.start_datum) : new Date('2025-01-01');
        const startDatum = mietvertragStart > new Date('2025-01-01') ? mietvertragStart : new Date('2025-01-01');
        
        const mietvertragForderungen = forderungen?.filter(f => {
          if (f.mietvertrag_id !== mietvertragId || !f.sollmonat) return false;
          
          const forderungsDatum = new Date(f.sollmonat + '-01');
          return forderungsDatum >= startDatum;
        }) || [];
        
        // Alle Zahlungen für diesen Mietvertrag (ab dem gleichen Zeitraum)
        const mietvertragZahlungen = zahlungen?.filter(z => {
          if (z.mietvertrag_id !== mietvertragId || !z.buchungsdatum) return false;
          
          const zahlungsDatum = new Date(z.buchungsdatum);
          return zahlungsDatum >= startDatum;
        }) || [];

        // Wenn keine Forderungen existieren, überspringen
        if (mietvertragForderungen.length === 0) continue;

        // BERECHNUNG WIE IM DETAIL-MODAL: Gesamtforderungen vs Gesamtzahlungen
        const gesamtForderungen = mietvertragForderungen.reduce((sum, f) => sum + (f.sollbetrag || 0), 0);
        let gesamtZahlungen = 0;

        // Nur gültige Zahlungen berücksichtigen (bei Lastschrift: 6 Tage Wartezeit)
        for (const zahlung of mietvertragZahlungen) {
          let zahlungGueltig = true;
          
          if (istLastschrift) {
            const zahlungMitWartezeit = new Date(zahlung.buchungsdatum);
            zahlungMitWartezeit.setDate(zahlungMitWartezeit.getDate() + 6);
            
            if (heute < zahlungMitWartezeit) {
              zahlungGueltig = false; // Zahlung noch in 6-Tage-Wartezeit
            }
          }
          
          if (zahlungGueltig) {
            gesamtZahlungen += (zahlung.betrag || 0);
          }
        }

        // Rückstand berechnen (identisch zum Detail-Modal)
        const rueckstand = gesamtForderungen - gesamtZahlungen;

        // Debug für alle Mietverträge
        console.log(`Mietvertrag ${mietvertragId}: Forderungen=${gesamtForderungen}, Zahlungen=${gesamtZahlungen}, Rückstand=${rueckstand}`);

        // Nur wenn ein positiver Rückstand existiert, in die Liste aufnehmen
        if (rueckstand > 0) {
          // Finde zugehörige Einheit und Immobilie
          const einheit = einheiten?.find(e => e.id === mietvertrag.einheit_id);
          const immobilie = immobilien?.find(i => i.id === einheit?.immobilie_id);

          const alleMieter = mietvertragMieter?.filter(mm => mm.mietvertrag_id === mietvertragId) || [];
          const ersteMieter = alleMieter[0]; // Nimm einfach den ersten Mieter
          
          const mietvertragDokumente = dokumente?.filter(dok => dok.mietvertrag_id === mietvertragId) || [];

          const immobilieName = immobilie?.name || 'Unbekannt';
          const mieterName = ersteMieter?.mieter ? 
            `${ersteMieter.mieter.vorname} ${ersteMieter.mieter.nachname}` : 'Unbekannt';

          const status = 'Aktiv';

          fehlendMap.set(mietvertragId, {
            mietvertrag_id: mietvertragId,
            fehlend_betrag: rueckstand,
            gesamt_forderungen: gesamtForderungen,
            gesamt_zahlungen: gesamtZahlungen,
            immobilie_name: immobilieName,
            immobilie_adresse: immobilie?.adresse || 'Unbekannt',
            einheit_typ: einheit?.einheitentyp || 'Unbekannt',
            einheit_etage: einheit?.etage || 'Unbekannt',
            einheit_qm: einheit?.qm || 0,
            mieter_name: mieterName,
            mieter_email: ersteMieter?.mieter?.hauptmail || 'Unbekannt',
            alle_mieter: alleMieter,
            mietvertrag: mietvertrag,
            dokumente: mietvertragDokumente,
            kaltmiete: mietvertrag.kaltmiete || 0,
            betriebskosten: mietvertrag.betriebskosten || 0,
            mietvertrag_status: status,
            mahnstufe: mietvertrag.mahnstufe || 0
          });
        }
      }

      const result = Array.from(fehlendMap.values()) as FehlendeMietzahlung[];
      console.log('=== ENDERGEBNIS (IDENTISCH ZUM DETAIL-MODAL) ===');
      console.log('Berechnete Rückstände:', result.length);
      console.log('Gesamtrückstand:', result.reduce((sum, item) => sum + item.fehlend_betrag, 0));
      console.log('Beispiele:', result.slice(0, 3).map(item => ({
        mietvertrag_id: item.mietvertrag_id,
        rueckstand: item.fehlend_betrag,
        gesamt_forderungen: item.gesamt_forderungen,
        gesamt_zahlungen: item.gesamt_zahlungen
      })));
      return result;
    }
  });
};