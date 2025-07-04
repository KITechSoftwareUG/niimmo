
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Euro, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const FehlendeMietzahlungen = () => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: fehlendeMietzahlungen } = useQuery({
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

      return Array.from(fehlendMap.values());
    }
  });

  const gesamtFehlend = fehlendeMietzahlungen?.reduce((sum, item) => sum + item.fehlend_betrag, 0) || 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="glass-card p-6 rounded-2xl border border-red-100 bg-red-50/30">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-800">Fehlende Mietzahlungen</h3>
                <p className="text-sm text-gray-600">Basierend auf Forderungen vs. Zahlungen</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gesamtFehlend > 0 && (
                <span className="text-lg font-bold text-red-600">
                  €{gesamtFehlend.toLocaleString()}
                </span>
              )}
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {fehlendeMietzahlungen && fehlendeMietzahlungen.length > 0 ? (
            <>
              <div className="space-y-4 mb-4">
                {fehlendeMietzahlungen.map((item) => (
                  <div key={item.mietvertrag_id} className="p-4 bg-white/60 rounded-lg border border-red-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-lg">{item.mieter_name}</p>
                        <p className="text-sm text-gray-600 mb-1">{item.immobilie_name}</p>
                        <p className="text-xs text-gray-500">{item.immobilie_adresse}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-red-600 font-bold text-lg mb-1">
                          <Euro className="h-4 w-4" />
                          {item.fehlend_betrag.toLocaleString()}
                        </div>
                        <p className="text-xs text-gray-500">Status: {item.mietvertrag_status}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t pt-3">
                      <div>
                        <p className="text-gray-500">Einheit</p>
                        <p className="font-medium">{item.einheit_typ}</p>
                        <p className="text-xs text-gray-400">Etage {item.einheit_etage}, {item.einheit_qm}m²</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500">Kaltmiete</p>
                        <p className="font-medium">€{item.kaltmiete.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">+ €{item.betriebskosten.toLocaleString()} NK</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500">Forderungen</p>
                        <p className="font-medium text-orange-600">€{item.gesamt_forderungen.toLocaleString()}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500">Zahlungen</p>
                        <p className="font-medium text-green-600">€{item.gesamt_zahlungen.toLocaleString()}</p>
                      </div>
                    </div>

                    {item.alle_mieter && item.alle_mieter.length > 1 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1">Alle Mieter:</p>
                        <div className="text-sm">
                          {item.alle_mieter.map((mieter, index) => (
                            <span key={mieter.mieter_id} className="text-gray-600">
                              {mieter.mieter?.Vorname} {mieter.mieter?.Nachname} ({mieter.rolle})
                              {index < item.alle_mieter!.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.dokumente && item.dokumente.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1">Dokumente ({item.dokumente.length}):</p>
                        <div className="text-xs text-gray-600">
                          {item.dokumente.slice(0, 3).map((dok, index) => (
                            <span key={dok.id}>
                              {dok.titel || dok.dateityp}
                              {index < Math.min(item.dokumente!.length, 3) - 1 && ', '}
                            </span>
                          ))}
                          {item.dokumente.length > 3 && ` +${item.dokumente.length - 3} weitere`}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="pt-3 border-t border-red-200">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Gesamt fehlend:</span>
                  <span className="text-lg font-bold text-red-600">
                    €{gesamtFehlend.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">✓ Alle Mietzahlungen sind vollständig</p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
