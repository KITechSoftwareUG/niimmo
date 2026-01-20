import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, MapPin, Home, Car, Warehouse, Store, Box, HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ImmobilienCardProps {
  immobilie: {
    id: string;
    name: string;
    adresse: string;
    einheiten_anzahl: number;
    beschreibung?: string;
    objekttyp?: string;
  };
  onClick: () => void;
}

// Get icon and color based on objekttyp
const getObjektTypeConfig = (objekttyp?: string) => {
  switch (objekttyp) {
    case 'Wohnhaus':
      return { icon: Home, color: 'bg-blue-500', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'Gewerbe':
      return { icon: Store, color: 'bg-purple-500', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'Mischnutzung':
      return { icon: Building, color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' };
    default:
      return { icon: Building, color: 'bg-slate-500', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
};

export const ImmobilienCard = ({ immobilie, onClick }: ImmobilienCardProps) => {
  const { data: einheitenStatus } = useQuery({
    queryKey: ['einheiten-status', immobilie.id],
    queryFn: async () => {
      // Get all units for this property with their types
      const { data: einheiten, error: einheitenError } = await supabase
        .from('einheiten')
        .select('id, einheitentyp')
        .eq('immobilie_id', immobilie.id);
      
      if (einheitenError) throw einheitenError;

      if (!einheiten || einheiten.length === 0) {
        return { 
          aktive: 0, 
          gekuendigt: 0, 
          beendet: 0, 
          leerstehend: immobilie.einheiten_anzahl, 
          gesamt: immobilie.einheiten_anzahl,
          einheitenTypen: {}
        };
      }

      // Count unit types
      const einheitenTypen: Record<string, number> = {};
      einheiten.forEach(e => {
        const typ = e.einheitentyp || 'Sonstiges';
        einheitenTypen[typ] = (einheitenTypen[typ] || 0) + 1;
      });

      // Get rental contracts for these units
      const einheitIds = einheiten.map(e => e.id);
      const { data: vertraege, error: vertraegeError } = await supabase
        .from('mietvertrag')
        .select('status')
        .in('einheit_id', einheitIds);
      
      if (vertraegeError) throw vertraegeError;
      
      const aktive = vertraege?.filter(v => v.status === 'aktiv').length || 0;
      const gekuendigt = vertraege?.filter(v => v.status === 'gekuendigt').length || 0;
      const beendet = vertraege?.filter(v => v.status === 'beendet').length || 0;
      const leerstehend = immobilie.einheiten_anzahl - aktive - gekuendigt - beendet;
      
      return { aktive, gekuendigt, beendet, leerstehend, gesamt: immobilie.einheiten_anzahl, einheitenTypen };
    }
  });

  const auslastung = einheitenStatus ? 
    Math.min(100, Math.round(((einheitenStatus.aktive + einheitenStatus.gekuendigt) / einheitenStatus.gesamt) * 100)) : 0;

  const typeConfig = getObjektTypeConfig(immobilie.objekttyp);
  const TypeIcon = typeConfig.icon;

  // Get unit type icon
  const getEinheitIcon = (typ: string) => {
    switch (typ) {
      case 'Wohnung': return Home;
      case 'Gewerbe': return Store;
      case 'Stellplatz': return Car;
      case 'Garage': return Car;
      case 'Lager': return Warehouse;
      case 'Haus (Doppelhaushälfte, Reihenhaus)': return Home;
      default: return Box;
    }
  };

  const getEinheitColor = (typ: string) => {
    switch (typ) {
      case 'Wohnung': return 'text-blue-600 bg-blue-50';
      case 'Gewerbe': return 'text-purple-600 bg-purple-50';
      case 'Stellplatz': return 'text-slate-600 bg-slate-50';
      case 'Garage': return 'text-slate-600 bg-slate-50';
      case 'Lager': return 'text-amber-600 bg-amber-50';
      case 'Haus (Doppelhaushälfte, Reihenhaus)': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getEinheitLabel = (typ: string) => {
    switch (typ) {
      case 'Haus (Doppelhaushälfte, Reihenhaus)': return 'Haus';
      default: return typ;
    }
  };

  return (
    <div className="h-full">
      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
        {/* Compact Header */}
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className={`p-2 sm:p-2.5 ${typeConfig.color} rounded-lg sm:rounded-xl shadow-sm flex-shrink-0`}>
            <TypeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm sm:text-base font-semibold text-foreground mb-0.5 truncate">
              {immobilie.name}
            </CardTitle>
            <div className="flex items-center text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="text-xs truncate">{immobilie.adresse}</span>
            </div>
          </div>
          {/* Compact unit count */}
          <div className="text-right flex-shrink-0">
            <div className="text-lg sm:text-xl font-bold text-foreground">{immobilie.einheiten_anzahl}</div>
            <div className="text-[10px] text-muted-foreground">Einh.</div>
          </div>
        </div>

        {/* Compact Auslastung */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Auslastung</span>
            <span className="text-xs font-semibold text-foreground">{auslastung}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${auslastung}%` }}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 px-3 pb-3 sm:px-4 sm:pb-4">
        {einheitenStatus && (
          <div className="space-y-2.5">
            {/* Compact Status Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="text-center p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mx-auto mb-0.5" />
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{einheitenStatus.aktive}</div>
                <div className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-500">Aktiv</div>
              </div>
              
              <div className="text-center p-1.5 sm:p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/30">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mx-auto mb-0.5" />
                <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{einheitenStatus.gekuendigt}</div>
                <div className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-500">Gekündigt</div>
              </div>
              
              <div className="text-center p-1.5 sm:p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800/30">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mx-auto mb-0.5" />
                <div className="text-sm font-bold text-rose-700 dark:text-rose-400">{Math.max(0, einheitenStatus.beendet + einheitenStatus.leerstehend)}</div>
                <div className="text-[9px] sm:text-[10px] text-rose-600 dark:text-rose-500">Leer</div>
              </div>
            </div>

            {/* Unit Types - Compact Pills */}
            {einheitenStatus.einheitenTypen && Object.keys(einheitenStatus.einheitenTypen).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/50">
                {Object.entries(einheitenStatus.einheitenTypen).map(([typ, count]) => {
                  const Icon = getEinheitIcon(typ);
                  const colorClass = getEinheitColor(typ);
                  return (
                    <div 
                      key={typ} 
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      <span>{count}x {getEinheitLabel(typ)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </div>
  );
};
