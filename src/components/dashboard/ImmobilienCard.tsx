
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, MapPin, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ImmobilienCardProps {
  immobilie: {
    id: string;
    name: string;
    adresse: string;
    einheiten_anzahl: number;
    beschreibung?: string;
  };
  onClick: () => void;
}

export const ImmobilienCard = ({ immobilie, onClick }: ImmobilienCardProps) => {
  const { data: einheitenStatus } = useQuery({
    queryKey: ['einheiten-status', immobilie.id],
    queryFn: async () => {
      // Get all units for this property
      const { data: einheiten, error: einheitenError } = await supabase
        .from('einheiten')
        .select('id')
        .eq('immobilie_id', immobilie.id);
      
      if (einheitenError) throw einheitenError;

      if (!einheiten || einheiten.length === 0) {
        return { aktive: 0, gekuendigt: 0, leerstehend: immobilie.einheiten_anzahl, gesamt: immobilie.einheiten_anzahl };
      }

      // Get rental contracts for these units
      const einheitIds = einheiten.map(e => e.id);
      const { data: vertraege, error: vertraegeError } = await supabase
        .from('mietvertraege')
        .select('status')
        .in('einheit_id', einheitIds);
      
      if (vertraegeError) throw vertraegeError;
      
      const aktive = vertraege?.filter(v => v.status === 'aktiv').length || 0;
      const gekuendigt = vertraege?.filter(v => v.status === 'gekündigt').length || 0;
      const leerstehend = immobilie.einheiten_anzahl - (vertraege?.length || 0);
      
      return { aktive, gekuendigt, leerstehend, gesamt: immobilie.einheiten_anzahl };
    }
  });

  const auslastung = einheitenStatus ? 
    Math.round((einheitenStatus.aktive / einheitenStatus.gesamt) * 100) : 0;

  return (
    <div className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 accent-red rounded-xl modern-shadow">
              <Building className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-sans font-semibold text-gray-800 mb-1">
                {immobilie.name}
              </CardTitle>
              <div className="flex items-center text-gray-500">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="text-sm font-sans">{immobilie.adresse}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="metric-card px-4 py-3 rounded-xl border border-gray-100">
              <div className="text-2xl font-sans font-bold text-gray-800">
                {immobilie.einheiten_anzahl}
              </div>
              <div className="text-xs text-gray-500 font-sans font-medium">
                Einheiten
              </div>
            </div>
          </div>
        </div>

        {/* Auslastungsanzeige */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-sans font-medium text-gray-600">Auslastung</span>
            <span className="text-sm font-sans font-bold text-gray-800">{auslastung}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full progress-bar rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${auslastung}%` }}
            ></div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-6">
        {immobilie.beschreibung && (
          <p className="text-sm font-sans text-gray-600 leading-relaxed line-clamp-2 bg-gray-50 p-3 rounded-lg">
            {immobilie.beschreibung}
          </p>
        )}

        {einheitenStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100 metric-card">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full modern-shadow"></div>
                </div>
                <div className="text-lg font-sans font-bold text-green-700">{einheitenStatus.aktive}</div>
                <div className="text-xs text-green-600 font-sans font-medium">Aktiv</div>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-100 metric-card">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full modern-shadow"></div>
                </div>
                <div className="text-lg font-sans font-bold text-yellow-700">{einheitenStatus.gekuendigt}</div>
                <div className="text-xs text-yellow-600 font-sans font-medium">Gekündigt</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100 metric-card">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full modern-shadow"></div>
                </div>
                <div className="text-lg font-sans font-bold text-red-700">{einheitenStatus.leerstehend}</div>
                <div className="text-xs text-red-600 font-sans font-medium">Leer</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-sans font-medium">Performance</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-sans font-medium">{einheitenStatus.aktive} von {einheitenStatus.gesamt}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </div>
  );
};
