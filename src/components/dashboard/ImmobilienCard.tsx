
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, MapPin, Home } from "lucide-react";
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

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Building className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{immobilie.name}</CardTitle>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {immobilie.einheiten_anzahl}
            </div>
            <div className="text-xs text-gray-500">Einheiten</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            <span className="text-sm">{immobilie.adresse}</span>
          </div>

          {immobilie.beschreibung && (
            <p className="text-sm text-gray-500 line-clamp-2">
              {immobilie.beschreibung}
            </p>
          )}

          {einheitenStatus && (
            <div className="flex space-x-2 pt-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">{einheitenStatus.aktive} Aktiv</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-xs text-gray-600">{einheitenStatus.gekuendigt} Gekündigt</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-xs text-gray-600">{einheitenStatus.leerstehend} Leer</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
