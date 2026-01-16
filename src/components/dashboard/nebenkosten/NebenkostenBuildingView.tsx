import { useMemo } from "react";
import { Home, CheckCircle2, AlertCircle, Users, Ruler, Activity, Equal } from "lucide-react";
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
  if (einheit.zaehler) return `Einheit ${einheit.zaehler}`;
  const digitsFromId = (einheit.id as string).replace(/\D/g, "");
  const lastTwo = digitsFromId.slice(-2) || "00";
  return `Einheit ${lastTwo}`;
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

export function NebenkostenBuildingView({
  einheiten,
  nebenkostenZahlungen,
  nebenkostenarten,
  onDrop,
  draggedZahlung,
  setDraggedZahlung,
}: NebenkostenBuildingViewProps) {
  const sortedEinheiten = useMemo(() => {
    return [...einheiten].sort((a, b) => getEinheitSortKey(b) - getEinheitSortKey(a)); // Highest first (top floor)
  }, [einheiten]);

  const einheitenStatus = useMemo(() => {
    const status: Record<string, { hasPayments: boolean; paymentCount: number; totalAmount: number }> = {};
    
    einheiten.forEach(einheit => {
      const payments = nebenkostenZahlungen.filter(z => z.einheit_id === einheit.id);
      status[einheit.id] = {
        hasPayments: payments.length > 0,
        paymentCount: payments.length,
        totalAmount: 0, // Will be calculated with actual payment amounts
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

  return (
    <div className="relative">
      {/* Dach */}
      <div className="flex justify-center mb-2">
        <div className="relative">
          <div 
            className="w-0 h-0 border-l-[120px] border-r-[120px] border-b-[60px] border-l-transparent border-r-transparent border-b-amber-600"
            style={{ filter: 'drop-shadow(0 -2px 4px rgba(0,0,0,0.1))' }}
          />
          <div className="absolute top-[35px] left-1/2 transform -translate-x-1/2">
            <Home className="h-6 w-6 text-amber-100" />
          </div>
        </div>
      </div>

      {/* Gebäude */}
      <div className="bg-gradient-to-b from-slate-200 to-slate-300 rounded-lg border-4 border-slate-400 shadow-xl overflow-hidden">
        {/* Etagen */}
        <div className="divide-y-2 divide-slate-400">
          {sortedEinheiten.map((einheit, index) => {
            const status = einheitenStatus[einheit.id];
            const isComplete = status?.hasPayments;
            const isDragOver = draggedZahlung !== null;
            
            return (
              <TooltipProvider key={einheit.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "p-4 transition-all duration-300 cursor-pointer",
                        isComplete
                          ? "bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300"
                          : "bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300",
                        isDragOver && "ring-2 ring-inset ring-primary ring-dashed",
                        index === 0 && "rounded-t-md"
                      )}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, einheit.id)}
                    >
                      <div className="flex items-center justify-between">
                        {/* Fenster-ähnliche Darstellung */}
                        <div className="flex items-center gap-4">
                          {/* Fenster */}
                          <div className={cn(
                            "w-16 h-12 rounded border-2 flex items-center justify-center",
                            isComplete
                              ? "bg-green-50 border-green-400"
                              : "bg-blue-50 border-blue-300"
                          )}>
                            {isComplete ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            ) : (
                              <AlertCircle className="h-6 w-6 text-slate-400" />
                            )}
                          </div>

                          {/* Einheit Info */}
                          <div>
                            <p className="font-bold text-slate-800">
                              {getEinheitLabel(einheit)}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              {einheit.etage && (
                                <span>{einheit.etage}</span>
                              )}
                              {einheit.qm && (
                                <span className="flex items-center gap-1">
                                  <Ruler className="h-3 w-3" />
                                  {einheit.qm} m²
                                </span>
                              )}
                              {einheit.anzahl_personen && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {einheit.anzahl_personen}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {status?.paymentCount > 0 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {status.paymentCount} Zuordnung{status.paymentCount !== 1 ? 'en' : ''}
                            </Badge>
                          )}
                          {einheit.einheitentyp && (
                            <Badge variant="outline" className="text-xs">
                              {einheit.einheitentyp}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{getEinheitLabel(einheit)}</p>
                      <p className="text-xs text-muted-foreground">
                        Ziehen Sie eine Zahlung hierher, um sie dieser Einheit zuzuordnen.
                      </p>
                      {status?.paymentCount > 0 && (
                        <p className="text-xs text-green-600">
                          ✓ {status.paymentCount} Zahlung(en) zugeordnet
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Fundament */}
        <div className="h-4 bg-gradient-to-b from-slate-500 to-slate-600" />
      </div>

      {/* Legende */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-200 border border-green-400" />
          <span>Hat Zuordnungen</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-200 border border-slate-400" />
          <span>Keine Zuordnungen</span>
        </div>
      </div>
    </div>
  );
}
