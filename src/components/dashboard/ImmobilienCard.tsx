
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      const { data, error } = await supabase
        .from('aktive_mietvertraege')
        .select('status')
        .eq('immobilie_id', immobilie.id);
      
      if (error) throw error;
      
      const aktive = data?.filter(v => v.status === 'aktiv').length || 0;
      const gekuendigt = data?.filter(v => v.status === 'gekündigt').length || 0;
      const leerstehend = immobilie.einheiten_anzahl - data?.length || 0;
      
      return { aktive, gekuendigt, leerstehend, gesamt: immobilie.einheiten_anzahl };
    }
  });

  const auslastung = einheitenStatus ? 
    Math.round((einheitenStatus.aktive / einheitenStatus.gesamt) * 100) : 0;

  return (
    <div className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
              <Building className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-display font-semibold text-gray-800">
                {immobilie.name}
              </CardTitle>
              <div className="flex items-center mt-1 text-gray-500">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="text-sm">{immobilie.adresse}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="glass-card px-4 py-2 rounded-xl">
              <div className="text-2xl font-bold text-gray-800">
                {immobilie.einheiten_anzahl}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                Einheiten
              </div>
            </div>
          </div>
        </div>

        {/* Auslastungsanzeige */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Auslastung</span>
            <span className="text-sm font-bold text-gray-800">{auslastung}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${auslastung}%` }}
            ></div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        {immobilie.beschreibung && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
            {immobilie.beschreibung}
          </p>
        )}

        {einheitenStatus && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full shadow-sm"></div>
                </div>
                <div className="text-lg font-bold text-green-700">{einheitenStatus.aktive}</div>
                <div className="text-xs text-green-600 font-medium">Aktiv</div>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full shadow-sm"></div>
                </div>
                <div className="text-lg font-bold text-yellow-700">{einheitenStatus.gekuendigt}</div>
                <div className="text-xs text-yellow-600 font-medium">Gekündigt</div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-3 h-3 bg-gradient-to-r from-red-400 to-red-500 rounded-full shadow-sm"></div>
                </div>
                <div className="text-lg font-bold text-red-700">{einheitenStatus.leerstehend}</div>
                <div className="text-xs text-red-600 font-medium">Leer</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Performance</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">{einheitenStatus.aktive} von {einheitenStatus.gesamt}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </div>
  );
};
