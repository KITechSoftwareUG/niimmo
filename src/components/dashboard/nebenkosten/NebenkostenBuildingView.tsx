import { useMemo } from "react";
import { Home, CheckCircle2, AlertCircle, Users, Ruler, Car, Warehouse, Building2, Store, Box, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Einheit {
  id: string;
  zaehler: number | null;
  qm: number | null;
  anzahl_personen: number | null;
  einheitentyp: string | null;
  etage: string | null;
}

interface NebenkostenZahlung {
  id: string;
  zahlung_id: string;
  nebenkostenart_id: string | null;
  einheit_id: string | null;
  verteilung_typ: string;
}

interface NebenkostenBuildingViewProps {
  einheiten: Einheit[];
  nebenkostenZahlungen: NebenkostenZahlung[];
  nebenkostenarten: { id: string; name: string }[];
  onDrop: (einheitId: string, zahlungId: string) => void;
  draggedZahlung: string | null;
  setDraggedZahlung: (id: string | null) => void;
}

const getEinheitLabel = (einheit: Einheit): string => {
  if (einheit.zaehler) return `${einheit.zaehler}`;
  const digitsFromId = (einheit.id as string).replace(/\D/g, "");
  const lastTwo = digitsFromId.slice(-2) || "00";
  return lastTwo;
};

const getEinheitSortKey = (einheit: Einheit): number => {
  const digitsFromZaehler = typeof einheit.zaehler === 'string' || typeof einheit.zaehler === 'number'
    ? String(einheit.zaehler).replace(/\D/g, '')
    : '';
  if (digitsFromZaehler) {
    return parseInt(digitsFromZaehler, 10);
  }
  const digitsFromId = (einheit.id as string).replace(/\D/g, '');
  const lastTwo = digitsFromId.slice(-2) || '0';
  return parseInt(lastTwo, 10) || 0;
};

// Typ-spezifische Konfiguration für visuelle Darstellung
const getEinheitConfig = (einheitentyp: string | null) => {
  switch (einheitentyp) {
    case 'Garage':
      return {
        icon: Car,
        bgColor: 'from-slate-100 to-slate-200',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-slate-600',
        borderColor: 'border-slate-400',
        label: 'Garage'
      };
    case 'Stellplatz':
      return {
        icon: Car,
        bgColor: 'from-blue-50 to-blue-100',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-blue-600',
        borderColor: 'border-blue-300',
        label: 'Stellplatz'
      };
    case 'Gewerbe':
      return {
        icon: Store,
        bgColor: 'from-purple-50 to-purple-100',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-purple-600',
        borderColor: 'border-purple-300',
        label: 'Gewerbe'
      };
    case 'Lager':
      return {
        icon: Box,
        bgColor: 'from-amber-50 to-amber-100',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-amber-600',
        borderColor: 'border-amber-300',
        label: 'Lager'
      };
    case 'Wohnung':
      return {
        icon: Home,
        bgColor: 'from-sky-50 to-sky-100',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-sky-600',
        borderColor: 'border-sky-300',
        label: 'Wohnung'
      };
    case 'Haus (Doppelhaushälfte, Reihenhaus)':
      return {
        icon: Building2,
        bgColor: 'from-orange-50 to-orange-100',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-orange-600',
        borderColor: 'border-orange-300',
        label: 'Haus'
      };
    default:
      return {
        icon: HelpCircle,
        bgColor: 'from-gray-50 to-gray-100',
        bgColorComplete: 'from-emerald-100 to-emerald-200',
        iconColor: 'text-gray-500',
        borderColor: 'border-gray-300',
        label: einheitentyp || 'Einheit'
      };
  }
};

// Gruppiere Einheiten nach Typ
const groupEinheitenByType = (einheiten: Einheit[]) => {
  const wohnungen: Einheit[] = [];
  const other: Einheit[] = [];
  
  einheiten.forEach(einheit => {
    if (einheit.einheitentyp === 'Wohnung' || einheit.einheitentyp === 'Haus (Doppelhaushälfte, Reihenhaus)') {
      wohnungen.push(einheit);
    } else {
      other.push(einheit);
    }
  });
  
  // Sortiere Wohnungen absteigend (höchste Etage oben)
  wohnungen.sort((a, b) => getEinheitSortKey(b) - getEinheitSortKey(a));
  // Sortiere andere aufsteigend
  other.sort((a, b) => getEinheitSortKey(a) - getEinheitSortKey(b));
  
  return { wohnungen, other };
};

export function NebenkostenBuildingView({
  einheiten,
  nebenkostenZahlungen,
  nebenkostenarten,
  onDrop,
  draggedZahlung,
  setDraggedZahlung,
}: NebenkostenBuildingViewProps) {
  const { wohnungen, other } = useMemo(() => groupEinheitenByType(einheiten), [einheiten]);

  const einheitenStatus = useMemo(() => {
    const status: Record<string, { hasPayments: boolean; paymentCount: number }> = {};
    
    einheiten.forEach(einheit => {
      const payments = nebenkostenZahlungen.filter(z => z.einheit_id === einheit.id);
      status[einheit.id] = {
        hasPayments: payments.length > 0,
        paymentCount: payments.length,
      };
    });
    
    return status;
  }, [einheiten, nebenkostenZahlungen]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, einheitId: string) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId) {
      onDrop(einheitId, zahlungId);
    }
    setDraggedZahlung(null);
  };

  const renderEinheitCard = (einheit: Einheit, compact = false) => {
    const status = einheitenStatus[einheit.id];
    const isComplete = status?.hasPayments;
    const isDragOver = draggedZahlung !== null;
    const config = getEinheitConfig(einheit.einheitentyp);
    const IconComponent = config.icon;

    return (
      <TooltipProvider key={einheit.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "p-2 md:p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer",
                isComplete
                  ? `bg-gradient-to-br ${config.bgColorComplete} border-emerald-400`
                  : `bg-gradient-to-br ${config.bgColor} ${config.borderColor}`,
                isDragOver && "ring-2 ring-primary ring-dashed",
                "hover:shadow-md hover:scale-[1.02]"
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, einheit.id)}
            >
              <div className="flex items-center gap-2">
                {/* Icon */}
                <div className={cn(
                  "w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center shrink-0",
                  isComplete
                    ? "bg-emerald-200/60"
                    : "bg-white/60"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                  ) : (
                    <IconComponent className={cn("h-4 w-4 md:h-5 md:w-5", config.iconColor)} />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs md:text-sm text-slate-800 truncate">
                    {config.label} {getEinheitLabel(einheit)}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500">
                    {einheit.qm && (
                      <span className="flex items-center gap-0.5">
                        <Ruler className="h-2.5 w-2.5" />
                        {einheit.qm}m²
                      </span>
                    )}
                    {status?.paymentCount > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-emerald-100 text-emerald-700">
                        {status.paymentCount}×
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{config.label} {getEinheitLabel(einheit)}</p>
              {einheit.etage && <p className="text-xs">{einheit.etage}</p>}
              <p className="text-xs text-muted-foreground">
                Zahlung hierher ziehen zum Zuordnen
              </p>
              {status?.paymentCount > 0 && (
                <p className="text-xs text-emerald-600">
                  ✓ {status.paymentCount} Zuordnung(en)
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-4">
      {/* Wohnungen als Gebäude */}
      {wohnungen.length > 0 && (
        <div>
          {/* Kompaktes Dach */}
          <div className="flex justify-center mb-1">
            <div 
              className="w-0 h-0 border-l-[60px] md:border-l-[80px] border-r-[60px] md:border-r-[80px] border-b-[30px] md:border-b-[40px] border-l-transparent border-r-transparent border-b-amber-500"
            />
          </div>

          {/* Gebäude mit 2 Spalten */}
          <div className="bg-gradient-to-b from-slate-100 to-slate-200 rounded-lg border-2 border-slate-300 p-2 md:p-3">
            <div className="grid grid-cols-2 gap-2">
              {wohnungen.map((einheit) => renderEinheitCard(einheit))}
            </div>
            {/* Fundament */}
            <div className="h-2 bg-gradient-to-b from-slate-400 to-slate-500 rounded-b mt-2 -mx-2 md:-mx-3 -mb-2 md:-mb-3" />
          </div>
        </div>
      )}

      {/* Andere Einheiten (Garagen, Stellplätze, etc.) */}
      {other.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 px-1">Weitere Einheiten</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {other.map((einheit) => renderEinheitCard(einheit, true))}
          </div>
        </div>
      )}

      {/* Kompakte Legende */}
      <div className="flex items-center justify-center gap-4 text-[10px] md:text-xs text-slate-500 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" />
          <span>Zugeordnet</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-200 border border-slate-400" />
          <span>Offen</span>
        </div>
      </div>
    </div>
  );
}
