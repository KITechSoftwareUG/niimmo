import { format } from "date-fns";
import { de } from "date-fns/locale";
import { GripVertical, Calendar, Euro, Tag, Building, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Zahlung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  empfaengername: string | null;
  verwendungszweck: string | null;
  kategorie: string | null;
}

interface NebenkostenPaymentCardProps {
  zahlung: Zahlung;
  isAssigned: boolean;
  assignedTo?: string;
  onDragStart: (zahlungId: string) => void;
  onDragEnd: () => void;
  onAutoDistribute: (zahlungId: string) => void;
  isDragging: boolean;
}

export function NebenkostenPaymentCard({
  zahlung,
  isAssigned,
  assignedTo,
  onDragStart,
  onDragEnd,
  onAutoDistribute,
  isDragging,
}: NebenkostenPaymentCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('zahlungId', zahlung.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(zahlung.id);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all",
        isDragging 
          ? "opacity-50 scale-95 border-primary bg-primary/10" 
          : "bg-white hover:shadow-md hover:border-primary/50",
        isAssigned
          ? "border-green-300 bg-green-50"
          : "border-slate-200"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <div className="mt-1 text-slate-400 hover:text-slate-600">
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
            </div>
            <span className={cn(
              "font-bold text-sm",
              zahlung.betrag < 0 ? "text-red-600" : "text-green-600"
            )}>
              {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)} €
            </span>
          </div>

          {/* Empfänger */}
          {zahlung.empfaengername && (
            <p className="text-sm font-medium text-slate-800 truncate mb-1">
              {zahlung.empfaengername}
            </p>
          )}

          {/* Verwendungszweck */}
          {zahlung.verwendungszweck && (
            <p className="text-xs text-slate-500 truncate mb-2">
              {zahlung.verwendungszweck}
            </p>
          )}

          {/* Badges und Aktionen */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {zahlung.kategorie && (
                <Badge variant="outline" className="text-xs">
                  <Tag className="h-2.5 w-2.5 mr-1" />
                  {zahlung.kategorie}
                </Badge>
              )}
              {isAssigned && assignedTo && (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <Building className="h-2.5 w-2.5 mr-1" />
                  {assignedTo}
                </Badge>
              )}
            </div>

            {!isAssigned && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2 text-primary hover:text-primary-foreground hover:bg-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoDistribute(zahlung.id);
                }}
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                Auto
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
