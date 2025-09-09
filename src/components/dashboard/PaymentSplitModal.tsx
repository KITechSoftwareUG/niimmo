import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface PaymentSplit {
  id: string;
  betrag: number;
  kategorie: "Miete" | "Mietkaution" | "Nichtmiete" | "Ignorieren" | "Rücklastschrift";
  verwendungszweck: string;
}

interface PaymentSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  vertragId: string;
  formatBetrag: (betrag: number) => string;
}

const PAYMENT_CATEGORIES = [
  "Miete",
  "Mietkaution", 
  "Nichtmiete",
  "Ignorieren",
  "Rücklastschrift"
] as const;

export function PaymentSplitModal({
  isOpen,
  onClose,
  payment,
  vertragId,
  formatBetrag
}: PaymentSplitModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [splits, setSplits] = useState<PaymentSplit[]>([
    {
      id: "1",
      betrag: Number(payment?.betrag || 0),
      kategorie: payment?.kategorie || "Miete",
      verwendungszweck: payment?.verwendungszweck || ""
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const originalAmount = Number(payment?.betrag || 0);
  const totalSplitAmount = splits.reduce((sum, split) => sum + split.betrag, 0);
  const remainingAmount = originalAmount - totalSplitAmount;

  const addSplit = () => {
    const newSplitAmount = Math.max(0, remainingAmount);
    setSplits([
      ...splits,
      {
        id: Date.now().toString(),
        betrag: parseFloat(newSplitAmount.toFixed(2)), // Round to 2 decimal places
        kategorie: "Miete",
        verwendungszweck: ""
      }
    ]);
  };

  const removeSplit = (id: string) => {
    if (splits.length <= 1) return;
    setSplits(splits.filter(split => split.id !== id));
  };

  const updateSplit = (id: string, field: keyof PaymentSplit, value: string | number) => {
    setSplits(splits.map(split => 
      split.id === id ? { 
        ...split, 
        [field]: field === 'betrag' ? parseFloat(value.toString()) || 0 : value 
      } : split
    ));
  };

  const handleSplitPayment = async () => {
    // Round values to avoid floating point precision issues
    const roundedOriginalAmount = parseFloat(originalAmount.toFixed(2));
    const roundedTotalSplitAmount = parseFloat(totalSplitAmount.toFixed(2));
    const difference = Math.abs(roundedOriginalAmount - roundedTotalSplitAmount);
    
    if (difference > 0.02) { // Slightly more tolerance for rounding
      toast({
        title: "Fehler",
        description: `Die Teilbeträge (${formatBetrag(roundedTotalSplitAmount)}) müssen dem Gesamtbetrag (${formatBetrag(roundedOriginalAmount)}) entsprechen.`,
        variant: "destructive",
      });
      return;
    }

    if (splits.length <= 1) {
      toast({
        title: "Fehler", 
        description: "Mindestens 2 Teilzahlungen erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Delete original payment
      const { error: deleteError } = await supabase
        .from('zahlungen')
        .delete()
        .eq('id', payment.id);

      if (deleteError) throw deleteError;

      const newPayments = splits.map(split => ({
        buchungsdatum: payment.buchungsdatum,
        mietvertrag_id: payment.mietvertrag_id,
        empfaengername: payment.empfaengername,
        kategorie: split.kategorie as "Miete" | "Mietkaution" | "Nichtmiete" | "Ignorieren" | "Rücklastschrift",
        betrag: split.betrag,
        verwendungszweck: split.verwendungszweck || payment.verwendungszweck,
        iban: payment.iban,
        zugeordneter_monat: payment.zugeordneter_monat,
        import_datum: payment.import_datum
      }));

      const { error: insertError } = await supabase
        .from('zahlungen')
        .insert(newPayments);

      if (insertError) throw insertError;

      toast({
        title: "Erfolgreich aufgeteilt",
        description: `Zahlung wurde in ${splits.length} Teilzahlungen aufgeteilt.`,
      });

      // Refresh queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-details', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);

      onClose();

    } catch (error) {
      console.error('Error splitting payment:', error);
      toast({
        title: "Fehler",
        description: "Zahlung konnte nicht aufgeteilt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetSplits = () => {
    setSplits([
      {
        id: "1",
        betrag: originalAmount,
        kategorie: payment?.kategorie || "Miete",
        verwendungszweck: payment?.verwendungszweck || ""
      }
    ]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ArrowRightLeft className="h-5 w-5" />
            <span>Zahlung aufteilen</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Payment Info */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Ursprüngliche Zahlung</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(payment?.buchungsdatum).toLocaleDateString('de-DE')} • {payment?.kategorie}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{formatBetrag(originalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Indicator */}
          <div className="flex items-center justify-center space-x-4 p-4 bg-muted/20 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Gesamt aufgeteilt</p>
              <p className="text-lg font-semibold">{formatBetrag(totalSplitAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Verbleibt</p>
                <p className={`text-lg font-semibold ${Math.abs(parseFloat(originalAmount.toFixed(2)) - parseFloat(totalSplitAmount.toFixed(2))) <= 0.02 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatBetrag(remainingAmount)}
              </p>
            </div>
          </div>

          {/* Split Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Teilzahlungen konfigurieren</h3>
              <div className="space-x-2">
                <Button onClick={resetSplits} variant="outline" size="sm">
                  Zurücksetzen
                </Button>
                <Button onClick={addSplit} size="sm" disabled={splits.length >= 5}>
                  <Plus className="h-4 w-4 mr-2" />
                  Weitere Teilung
                </Button>
              </div>
            </div>

            {splits.map((split, index) => (
              <Card key={split.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline">Teilzahlung {index + 1}</Badge>
                    {splits.length > 1 && (
                      <Button
                        onClick={() => removeSplit(split.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Betrag</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={split.betrag}
                        onChange={(e) => updateSplit(split.id, 'betrag', parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Kategorie</Label>
                      <Select 
                        value={split.kategorie} 
                        onValueChange={(value) => updateSplit(split.id, 'kategorie', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_CATEGORIES.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <Label>Verwendungszweck (optional)</Label>
                    <Input
                      value={split.verwendungszweck}
                      onChange={(e) => updateSplit(split.id, 'verwendungszweck', e.target.value)}
                      placeholder="Optionale Beschreibung"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button onClick={onClose} variant="outline">
              Abbrechen
            </Button>
            <Button 
              onClick={handleSplitPayment}
              disabled={(() => {
                const roundedOriginalAmount = parseFloat(originalAmount.toFixed(2));
                const roundedTotalSplitAmount = parseFloat(totalSplitAmount.toFixed(2));
                const difference = Math.abs(roundedOriginalAmount - roundedTotalSplitAmount);
                return difference > 0.02 || splits.length <= 1 || isLoading;
              })()}
              className="min-w-[120px]"
            >
              {isLoading ? 'Wird aufgeteilt...' : 'Zahlung aufteilen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}