
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
      // Hole alle Mietforderungen mit Mietvertrag- und Mieter-Informationen
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
            einheiten!inner(
              id,
              immobilie_id,
              immobilien!inner(
                id,
                name
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
          mieter_id,
          mieter!inner(
            id,
            Vorname,
            Nachname
          )
        `)
        .eq('rolle', 'Hauptmieter');
      
      if (mmError) {
        console.error('Fehler beim Laden der Mieter:', mmError);
        throw mmError;
      }

      // Berechne fehlende Zahlungen pro Mietvertrag
      const fehlendMap = new Map();
      
      forderungen?.forEach(forderung => {
        const mietvertragId = forderung.mietvertrag_id;
        if (!mietvertragId) return;

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
          const mieter = mietvertragMieter?.find(mm => mm.mietvertrag_id === mietvertragId);
          const immobilieName = forderung.mietvertrag?.einheiten?.immobilien?.name || 'Unbekannt';
          const mieterName = mieter?.mieter ? 
            `${mieter.mieter.Vorname} ${mieter.mieter.Nachname}` : 'Unbekannt';

          fehlendMap.set(mietvertragId, {
            mietvertrag_id: mietvertragId,
            fehlend_betrag: fehlendBetrag,
            immobilie_name: immobilieName,
            mieter_name: mieterName
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
              <div className="space-y-3 mb-4">
                {fehlendeMietzahlungen.map((item) => (
                  <div key={item.mietvertrag_id} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-red-100">
                    <div>
                      <p className="font-medium text-gray-800">{item.mieter_name}</p>
                      <p className="text-sm text-gray-600">{item.immobilie_name}</p>
                    </div>
                    <div className="flex items-center gap-1 text-red-600 font-semibold">
                      <Euro className="h-4 w-4" />
                      {item.fehlend_betrag.toLocaleString()}
                    </div>
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
