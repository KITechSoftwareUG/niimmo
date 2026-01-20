import { useState } from "react";
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
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
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
}

interface Stats {
  total: number;
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
  stats: Stats;
  onApply: () => Promise<void>;
}

export function PaymentAssignmentResultsModal({
  open,
  onOpenChange,
  results,
  stats,
  onApply,
}: PaymentAssignmentResultsModalProps) {
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply();
      toast({
        title: "Zuordnungen übernommen",
        description: `${stats.zugeordnet} Zahlungen wurden erfolgreich zugeordnet.`,
      });
      onOpenChange(false);
      // Refresh data
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
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI-Zuordnungsergebnisse
          </DialogTitle>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-4 border-b">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Gesamt</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.zugeordnet}</div>
            <div className="text-xs text-green-600">Zugeordnet</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{stats.nicht_zugeordnet}</div>
            <div className="text-xs text-amber-600">Nicht zugeordnet</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.durchschnittliche_konfidenz}%</div>
            <div className="text-xs text-blue-600">Ø Konfidenz</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{stats.nach_kategorie.miete}</div>
            <div className="text-xs text-purple-600">Mietzahlungen</div>
          </div>
        </div>

        {/* Results Table */}
        <ScrollArea className="flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Verwendungszweck</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Zuordnung</TableHead>
                <TableHead>Konfidenz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, idx) => (
                <TableRow key={idx} className={result.mietvertrag_id ? "" : "bg-amber-50/50"}>
                  <TableCell>
                    {result.mietvertrag_id ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(result.buchungsdatum), "dd.MM.yyyy")}
                  </TableCell>
                  <TableCell className={`text-right font-semibold whitespace-nowrap ${
                    result.betrag < 0 ? "text-destructive" : "text-green-600"
                  }`}>
                    {result.betrag.toFixed(2)} €
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate text-sm" title={result.verwendungszweck}>
                      {result.verwendungszweck || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{getKategorieBadge(result.kategorie)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {result.mieter_name && (
                        <div className="font-medium">{result.mieter_name}</div>
                      )}
                      {result.immobilie_name && (
                        <div className="text-muted-foreground text-xs">{result.immobilie_name}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.zuordnungsgrund}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getConfidenceBadge(result.confidence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleApply} disabled={isApplying || stats.zugeordnet === 0}>
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird übernommen...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                {stats.zugeordnet} Zuordnungen übernehmen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
