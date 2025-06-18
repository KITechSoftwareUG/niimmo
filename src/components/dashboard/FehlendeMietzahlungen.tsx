
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Euro } from "lucide-react";

export const FehlendeMietzahlungen = () => {
  const { data: fehlendeMietzahlungen } = useQuery({
    queryKey: ['fehlende-mietzahlungen'],
    queryFn: async () => {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      
      // Hole alle aktiven Mietverträge
      const { data: aktiveMietvertraege, error: mietvertraegeError } = await supabase
        .from('aktive_mietvertraege')
        .select('id, kaltmiete, mieter_name, immobilie_id')
        .eq('status', 'aktiv');
      
      if (mietvertraegeError) throw mietvertraegeError;

      // Hole Immobilien-Namen
      const { data: immobilien, error: immobilienError } = await supabase
        .from('immobilien')
        .select('id, name');
      
      if (immobilienError) throw immobilienError;

      // Hole bereits bezahlte Mietzahlungen für diesen Monat
      const { data: mietzahlungen, error: zahlungenError } = await supabase
        .from('mietzahlungen')
        .select('mietvertrag_id')
        .eq('monat', currentMonth)
        .not('bezahlt_am', 'is', null);
      
      if (zahlungenError) throw zahlungenError;

      const bezahlteMietvertraege = new Set(mietzahlungen?.map(z => z.mietvertrag_id));
      
      return aktiveMietvertraege
        ?.filter(mv => !bezahlteMietvertraege.has(mv.id))
        .map(mv => ({
          ...mv,
          immobilie_name: immobilien?.find(i => i.id === mv.immobilie_id)?.name || 'Unbekannt'
        })) || [];
    }
  });

  const gesamtFehlend = fehlendeMietzahlungen?.reduce((sum, mv) => sum + (mv.kaltmiete || 0), 0) || 0;

  return (
    <div className="glass-card p-6 rounded-2xl border border-red-100 bg-red-50/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Fehlende Mietzahlungen</h3>
          <p className="text-sm text-gray-600">Aktuelle Monat: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {fehlendeMietzahlungen && fehlendeMietzahlungen.length > 0 ? (
        <>
          <div className="space-y-3 mb-4">
            {fehlendeMietzahlungen.slice(0, 5).map((mv) => (
              <div key={mv.id} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-red-100">
                <div>
                  <p className="font-medium text-gray-800">{mv.mieter_name}</p>
                  <p className="text-sm text-gray-600">{mv.immobilie_name}</p>
                </div>
                <div className="flex items-center gap-1 text-red-600 font-semibold">
                  <Euro className="h-4 w-4" />
                  {mv.kaltmiete?.toLocaleString()}
                </div>
              </div>
            ))}
            {fehlendeMietzahlungen.length > 5 && (
              <p className="text-sm text-gray-500 text-center">
                und {fehlendeMietzahlungen.length - 5} weitere...
              </p>
            )}
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
          <p className="text-green-600 font-medium">✓ Alle Mietzahlungen für diesen Monat erhalten</p>
        </div>
      )}
    </div>
  );
};
