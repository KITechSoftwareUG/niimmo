import { useState, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Ruler,
  Users,
  Equal,
  Calculator,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface BetrKVKategorieCardProps {
  kategorie: {
    id: string;
    name: string;
    icon: any;
    beschreibung: string;
    umlagefaehig: boolean;
  };
  positionen: any[];
  total: number;
  isExpanded: boolean;
  einheiten: any[];
  onToggle: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  immobilieId: string;
  selectedYear: number;
}

type VerteilerschluesselArt = "qm" | "personen" | "gleich";

const VERTEILERSCHLUESSEL_OPTIONS = [
  { value: "qm", label: "Nach Quadratmeter (m²)", icon: Ruler },
  { value: "personen", label: "Nach Personenzahl", icon: Users },
  { value: "gleich", label: "Gleichmäßig", icon: Equal },
];

export function BetrKVKategorieCard({
  kategorie,
  positionen,
  total,
  isExpanded,
  einheiten,
  onToggle,
  onDrop,
  onDragOver,
  immobilieId,
  selectedYear,
}: BetrKVKategorieCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verteilerschluessel, setVerteilerschluessel] = useState<VerteilerschluesselArt>("qm");
  const Icon = kategorie.icon;

  // Berechne Bezugsgrößen
  const bezugsgroessen = useMemo(() => {
    return {
      qm: einheiten.reduce((sum, e) => sum + (e.qm || 0), 0),
      personen: einheiten.reduce((sum, e) => sum + (e.anzahl_personen || 1), 0),
      einheiten: einheiten.length,
    };
  }, [einheiten]);

  // Berechne Verteilung auf Einheiten
  const verteilung = useMemo(() => {
    if (total === 0 || einheiten.length === 0) return [];

    return einheiten.map((einheit) => {
      let anteil = 0;
      let bezugsgroesseText = "";

      switch (verteilerschluessel) {
        case "qm":
          anteil = bezugsgroessen.qm > 0 ? (einheit.qm || 0) / bezugsgroessen.qm : 0;
          bezugsgroesseText = `${einheit.qm || 0} m² von ${bezugsgroessen.qm} m²`;
          break;
        case "personen":
          anteil = bezugsgroessen.personen > 0 ? (einheit.anzahl_personen || 1) / bezugsgroessen.personen : 0;
          bezugsgroesseText = `${einheit.anzahl_personen || 1} Pers. von ${bezugsgroessen.personen} Pers.`;
          break;
        case "gleich":
          anteil = bezugsgroessen.einheiten > 0 ? 1 / bezugsgroessen.einheiten : 0;
          bezugsgroesseText = `1 von ${bezugsgroessen.einheiten} Einheiten`;
          break;
      }

      const betrag = total * anteil;
      const einheitLabel = einheit.zaehler
        ? `Einheit ${einheit.zaehler}`
        : `Einheit ${(einheit.id as string).slice(-2)}`;

      return {
        einheitId: einheit.id,
        einheitLabel,
        qm: einheit.qm,
        personen: einheit.anzahl_personen || 1,
        anteilProzent: anteil * 100,
        anteilBetrag: betrag,
        bezugsgroesseText,
      };
    });
  }, [einheiten, total, verteilerschluessel, bezugsgroessen]);

  // Mutation zum Löschen einer Kostenposition
  const deletePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const { error } = await supabase
        .from("kostenpositionen")
        .delete()
        .eq("id", positionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Gelöscht",
        description: "Die Kostenposition wurde entfernt.",
      });
      queryClient.invalidateQueries({ queryKey: ["kostenpositionen-betrkv", immobilieId, selectedYear] });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Löschen fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={`border-2 border-dashed rounded-lg transition-colors ${
          isExpanded ? "border-green-400 bg-green-50" : "border-green-200 bg-green-50/50 hover:border-green-400 hover:bg-green-50"
        }`}
      >
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-green-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-green-600" />
                )}
                <Icon className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{kategorie.name}</span>
                {positionen.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {positionen.length}
                  </Badge>
                )}
              </div>
              <span className="text-sm font-bold text-green-700">{total.toFixed(2)} €</span>
            </div>
            <p className="text-xs text-muted-foreground ml-10 mt-1">{kategorie.beschreibung}</p>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-4">
            {/* Zugeordnete Positionen */}
            {positionen.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Zugeordnete Zahlungen:</p>
                {positionen.map((position) => (
                  <div
                    key={position.id}
                    className="flex items-center justify-between p-2 bg-white rounded border text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{position.bezeichnung || "Ohne Bezeichnung"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(position.zeitraum_von), "dd.MM.yyyy", { locale: de })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.gesamtbetrag.toFixed(2)} €</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePositionMutation.mutate(position.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Verteilung auf Einheiten */}
            {total > 0 && einheiten.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium">Verteilung auf Einheiten</p>
                  </div>
                  <Select
                    value={verteilerschluessel}
                    onValueChange={(v) => setVerteilerschluessel(v as VerteilerschluesselArt)}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {VERTEILERSCHLUESSEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-3 w-3" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  {verteilung.map((v) => (
                    <div
                      key={v.einheitId}
                      className="flex items-center justify-between p-2 bg-white/80 rounded text-xs"
                    >
                      <div>
                        <span className="font-medium">{v.einheitLabel}</span>
                        <span className="text-muted-foreground ml-2">({v.bezugsgroesseText})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">{v.anteilProzent.toFixed(1)}% = </span>
                        <span className="font-bold text-primary">{v.anteilBetrag.toFixed(2)} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {positionen.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Ziehen Sie Zahlungen hierher, um sie dieser Kategorie zuzuordnen
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
