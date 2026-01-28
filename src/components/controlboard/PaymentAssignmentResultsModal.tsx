import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, ArrowRight, Loader2, Copy, CheckCheck, Square } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ProcessedPayment {
  buchungsdatum: string;
  betrag: number;
  iban: string;
  verwendungszweck: string;
  empfaengername?: string;
  mietvertrag_id: string | null;
  kategorie: string;
  zuordnungsgrund: string;
  confidence: number;
  mieter_name?: string;
  immobilie_name?: string;
  selected?: boolean;
}

interface DuplicatePayment {
  buchungsdatum: string;
  betrag: number;
  iban: string;
  verwendungszweck: string;
  empfaengername?: string;
  existingId: string;
}

interface Stats {
  total: number;
  neue: number;
  duplikate: number;
  zugeordnet: number;
  nicht_zugeordnet: number;
  nach_kategorie: {
    miete: number;
    mietkaution: number;
    ruecklastschrift: number;
    nichtmiete: number;
  };
  durchschnittliche_konfidenz: number;
}

interface PaymentAssignmentResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ProcessedPayment[];
  duplicates: DuplicatePayment[];
  stats: Stats;
  onApply: (selectedResults: ProcessedPayment[]) => Promise<void>;
}

export function PaymentAssignmentResultsModal({
  open,
  onOpenChange,
  results,
  duplicates,
  stats,
  onApply,
}: PaymentAssignmentResultsModalProps) {
  const [isApplying, setIsApplying] = useState(false);
  
  // Filter to only show "Miete" payments
  const mietResults = useMemo(() => 
    results.filter(r => r.kategorie === "Miete"), 
    [results]
  );
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Default: select all Miete results with mietvertrag_id
    const defaultSelected = new Set<string>();
    mietResults.forEach((r, idx) => {
      if (r.mietvertrag_id) {
        defaultSelected.add(`${idx}`);
      }
    });
    return defaultSelected;
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Recalculate selected when mietResults change
  useMemo(() => {
    const newSelected = new Set<string>();
    mietResults.forEach((r, idx) => {
      if (r.selected !== false && r.mietvertrag_id) {
        newSelected.add(`${idx}`);
      }
    });
    setSelectedIds(newSelected);
  }, [mietResults]);

  const toggleSelection = (idx: number) => {
    const key = `${idx}`;
    const newSet = new Set(selectedIds);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    const newSet = new Set<string>();
    mietResults.forEach((_, idx) => newSet.add(`${idx}`));
    setSelectedIds(newSet);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedResults = mietResults.filter((_, idx) => selectedIds.has(`${idx}`));
  const selectedWithAssignment = selectedResults.filter(r => r.mietvertrag_id);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(selectedResults);
      toast({
        title: "Zuordnungen übernommen",
        description: `${selectedWithAssignment.length} Zahlungen wurden erfolgreich zugeordnet.`,
      });
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });
    } catch (error) {
      console.error("Apply error:", error);
      toast({
        title: "Fehler",
        description: "Die Zuordnungen konnten nicht übernommen werden.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">{confidence}%</Badge>;
    } else if (confidence >= 50) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{confidence}%</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 border-red-200">{confidence}%</Badge>;
  };

  const getKategorieBadge = (kategorie: string) => {
    const colors: Record<string, string> = {
      Miete: "bg-blue-100 text-blue-800 border-blue-200",
      Mietkaution: "bg-purple-100 text-purple-800 border-purple-200",
      Rücklastschrift: "bg-red-100 text-red-800 border-red-200",
      Nichtmiete: "bg-gray-100 text-gray-800 border-gray-200",
      Ignorieren: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return <Badge className={colors[kategorie] || "bg-gray-100"}>{kategorie}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI-Zuordnungsergebnisse
          </DialogTitle>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 py-3 border-b flex-shrink-0">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">CSV Gesamt</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-orange-700">{stats.duplikate}</div>
            <div className="text-xs text-orange-600">Duplikate</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-blue-700">{stats.neue}</div>
            <div className="text-xs text-blue-600">Neue</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-green-700">{stats.zugeordnet}</div>
            <div className="text-xs text-green-600">Zugeordnet</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-amber-700">{stats.nicht_zugeordnet}</div>
            <div className="text-xs text-amber-600">Offen</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-purple-700">{stats.durchschnittliche_konfidenz}%</div>
            <div className="text-xs text-purple-600">Ø Konfidenz</div>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} von {mietResults.length} ausgewählt
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                <CheckCheck className="h-3 w-3 mr-1" />
                Alle
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-xs">
                <Square className="h-3 w-3 mr-1" />
                Keine
              </Button>
            </div>
          </div>
          {selectedWithAssignment.length > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {selectedWithAssignment.length} mit Zuordnung
            </Badge>
          )}
        </div>

        {/* Duplicates Info */}
        {duplicates.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-sm flex-shrink-0">
            <div className="flex items-center gap-2 text-orange-800 font-medium">
              <Copy className="h-4 w-4" />
              {duplicates.length} Duplikate übersprungen
            </div>
          </div>
        )}

        {/* Results Table - Scrollable */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={selectedIds.size === mietResults.length && mietResults.length > 0}
                      onCheckedChange={(checked) => checked ? selectAll() : deselectAll()}
                    />
                  </TableHead>
                  <TableHead className="w-[40px]">Status</TableHead>
                  <TableHead className="w-[90px]">Datum</TableHead>
                  <TableHead className="text-right w-[100px]">Betrag</TableHead>
                  <TableHead>Verwendungszweck</TableHead>
                  <TableHead className="w-[100px]">Kategorie</TableHead>
                  <TableHead>Zuordnung</TableHead>
                  <TableHead className="w-[80px]">Konfidenz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mietResults.map((result, idx) => {
                  const isSelected = selectedIds.has(`${idx}`);
                  return (
                    <TableRow 
                      key={idx} 
                      className={`${result.mietvertrag_id ? "" : "bg-amber-50/50"} ${!isSelected ? "opacity-50" : ""}`}
                    >
                      <TableCell className="py-2">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(idx)}
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        {result.mietvertrag_id ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 text-sm">
                        {format(new Date(result.buchungsdatum), "dd.MM.yy")}
                      </TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap py-2 text-sm ${
                        result.betrag < 0 ? "text-destructive" : "text-green-600"
                      }`}>
                        {result.betrag.toFixed(2)} €
                      </TableCell>
                      <TableCell className="max-w-[250px] py-2">
                        <div className="text-xs whitespace-pre-wrap break-words leading-relaxed">
                          {result.verwendungszweck || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{getKategorieBadge(result.kategorie)}</TableCell>
                      <TableCell className="py-2">
                        <div className="text-xs">
                          {result.mieter_name && (
                            <div className="font-medium">{result.mieter_name}</div>
                          )}
                          {result.immobilie_name && (
                            <div className="text-muted-foreground">{result.immobilie_name}</div>
                          )}
                          <div className="text-muted-foreground mt-0.5">
                            {result.zuordnungsgrund}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{getConfidenceBadge(result.confidence)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter className="pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleApply} disabled={isApplying || selectedIds.size === 0}>
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird übernommen...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                {selectedIds.size} Zahlungen übernehmen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
