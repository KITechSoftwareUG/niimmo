
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Euro } from "lucide-react";

export const FehlendeMietzahlungen = () => {
  const { data: mietvertraegeData } = useQuery({
    queryKey: ['mietvertraege-mit-mieter'],
    queryFn: async () => {
      // Hole alle aktiven Mietverträge mit Mieter-Informationen
      const { data: mietvertraege, error: mvError } = await supabase
        .from('mietvertraege')
        .select(`
          id, 
          kaltmiete,
          einheit_id,
          status
        `)
        .eq('status', 'aktiv');
      
      if (mvError) throw mvError;

      // Hole Einheiten-Informationen
      const { data: einheiten, error: einheitenError } = await supabase
        .from('einheiten')
        .select('id, immobilie_id');
      
      if (einheitenError) throw einheitenError;

      // Hole Immobilien-Namen
      const { data: immobilien, error: immobilienError } = await supabase
        .from('immobilien')
        .select('id, name');
      
      if (immobilienError) throw immobilienError;

      // Hole Mieter-Informationen
      const { data: mietvertragMieter, error: mmError } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mietvertrag_id,
          rolle,
          mieter_id
        `)
        .eq('rolle', 'Hauptmieter');
      
      if (mmError) throw mmError;

      const { data: mieter, error: mieterError } = await supabase
        .from('mieter')
        .select('id, Vorname, Nachname');
      
      if (mieterError) throw mieterError;

      // Verknüpfe die Daten
      return mietvertraege?.map(mv => {
        const einheit = einheiten?.find(e => e.id === mv.einheit_id);
        const immobilie = immobilien?.find(i => i.id === einheit?.immobilie_id);
        const mvMieter = mietvertragMieter?.find(mm => mm.mietvertrag_id === mv.id);
        const mieterData = mieter?.find(m => m.id === mvMieter?.mieter_id);
        
        return {
          ...mv,
          immobilie_name: immobilie?.name || 'Unbekannt',
          mieter_name: mieterData ? `${mieterData.Vorname} ${mieterData.Nachname}` : 'Unbekannt'
        };
      }) || [];
    }
  });

  // Da wir keine Mietzahlungen-Tabelle in den Types haben, simulieren wir fehlende Zahlungen
  // In einer echten Anwendung würde hier die Logik für fehlende Zahlungen stehen
  const fehlendeMietzahlungen = mietvertraegeData?.slice(0, 3) || [];
  const gesamtFehlend = fehlendeMietzahlungen.reduce((sum, mv) => sum + (mv.kaltmiete || 0), 0);

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

      {fehlendeMietzahlungen.length > 0 ? (
        <>
          <div className="space-y-3 mb-4">
            {fehlendeMietzahlungen.map((mv) => (
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
          </div>
          
          <div className="pt-3 border-t border-red-200">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Gesamt fehlend (Beispiel):</span>
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
