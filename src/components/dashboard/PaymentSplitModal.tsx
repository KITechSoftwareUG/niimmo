import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PaymentSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  onSplitComplete: () => void;
}

interface SplitPart {
  id: string;
  betrag: number;
  zugeordneter_monat: string;
  verwendungszweck: string;
}

export const PaymentSplitModal = ({ isOpen, onClose, payment, onSplitComplete }: PaymentSplitModalProps) => {
  const { toast } = useToast();
  const [splitParts, setSplitParts] = useState<SplitPart[]>([
    {
      id: '1',
      betrag: payment?.betrag || 0,
      zugeordneter_monat: payment?.zugeordneter_monat || '',
      verwendungszweck: payment?.verwendungszweck || ''
    }
  ]);

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  // Generate month options for current and previous years
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Add months from current year and previous year
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('de-DE', { 
          year: 'numeric', 
          month: 'long' 
        });
        options.push({ value: monthStr, label: monthName });
      }
    }
    
    return options.reverse(); // Most recent first
  };

  const addSplitPart = () => {
    const newId = (splitParts.length + 1).toString();
    setSplitParts([
      ...splitParts,
      {
        id: newId,
        betrag: 0,
        zugeordneter_monat: '',
        verwendungszweck: payment?.verwendungszweck || ''
      }
    ]);
  };

  const removeSplitPart = (id: string) => {
    if (splitParts.length > 1) {
      setSplitParts(splitParts.filter(part => part.id !== id));
    }
  };

  const updateSplitPart = (id: string, field: keyof SplitPart, value: any) => {
    setSplitParts(splitParts.map(part => 
      part.id === id ? { ...part, [field]: value } : part
    ));
  };

  const getTotalSplitAmount = () => {
    return splitParts.reduce((sum, part) => sum + (part.betrag || 0), 0);
  };

  const getRemainingAmount = () => {
    return (payment?.betrag || 0) - getTotalSplitAmount();
  };

  const canSplit = () => {
    const totalAmount = getTotalSplitAmount();
    const originalAmount = payment?.betrag || 0;
    
    return (
      Math.abs(totalAmount - originalAmount) < 0.01 && // Allow for small rounding differences
      splitParts.every(part => part.betrag > 0 && part.zugeordneter_monat) &&
      splitParts.length > 1
    );
  };

  const handleSplit = async () => {
    if (!canSplit()) return;

    try {
      // Delete original payment
      const { error: deleteError } = await supabase
        .from('zahlungen')
        .delete()
        .eq('id', payment.id);

      if (deleteError) throw deleteError;

      // Insert new split payments
      const newPayments = splitParts.map(part => ({
        mietvertrag_id: payment.mietvertrag_id,
        betrag: part.betrag,
        buchungsdatum: payment.buchungsdatum,
        kategorie: payment.kategorie,
        iban: payment.iban,
        empfaengername: payment.empfaengername,
        zugeordneter_monat: part.zugeordneter_monat,
        verwendungszweck: part.verwendungszweck || `Split von ${payment.verwendungszweck || 'Zahlung'}`,
      }));

      const { error: insertError } = await supabase
        .from('zahlungen')
        .insert(newPayments);

      if (insertError) throw insertError;

      toast({
        title: "Zahlung erfolgreich geteilt",
        description: `Zahlung von ${formatBetrag(payment.betrag)} wurde in ${splitParts.length} Teile aufgeteilt.`,
      });

      onSplitComplete();
      onClose();

    } catch (error) {
      console.error('Fehler beim Teilen der Zahlung:', error);
      toast({
        title: "Fehler",
        description: "Die Zahlung konnte nicht geteilt werden.",
        variant: "destructive",
      });
    }
  };

  if (!payment) return null;

  const monthOptions = generateMonthOptions();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zahlung aufteilen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ursprüngliche Zahlung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Betrag:</span>
                  <p className="text-lg font-bold text-green-600">{formatBetrag(payment.betrag)}</p>
                </div>
                <div>
                  <span className="font-medium">Datum:</span>
                  <p>{payment.buchungsdatum}</p>
                </div>
                <div>
                  <span className="font-medium">Kategorie:</span>
                  <p>{payment.kategorie}</p>
                </div>
                <div>
                  <span className="font-medium">Zugeordneter Monat:</span>
                  <p>{payment.zugeordneter_monat}</p>
                </div>
              </div>
              {payment.verwendungszweck && (
                <div className="mt-2">
                  <span className="font-medium">Verwendungszweck:</span>
                  <p className="text-sm text-gray-600">{payment.verwendungszweck}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Split Parts */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Aufteilung ({splitParts.length} Teile)</CardTitle>
                <Button onClick={addSplitPart} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Teil hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {splitParts.map((part, index) => (
                <div key={part.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium">Teil {index + 1}</h4>
                    {splitParts.length > 1 && (
                      <Button
                        onClick={() => removeSplitPart(part.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`betrag-${part.id}`}>Betrag</Label>
                      <Input
                        id={`betrag-${part.id}`}
                        type="number"
                        step="0.01"
                        value={part.betrag || ''}
                        onChange={(e) => updateSplitPart(part.id, 'betrag', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`monat-${part.id}`}>Zugeordneter Monat</Label>
                      <Select
                        value={part.zugeordneter_monat}
                        onValueChange={(value) => updateSplitPart(part.id, 'zugeordneter_monat', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Monat wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor={`zweck-${part.id}`}>Verwendungszweck</Label>
                      <Input
                        id={`zweck-${part.id}`}
                        value={part.verwendungszweck}
                        onChange={(e) => updateSplitPart(part.id, 'verwendungszweck', e.target.value)}
                        placeholder="Verwendungszweck"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center text-sm">
                  <span>Gesamt aufgeteilt:</span>
                  <span className="font-bold">{formatBetrag(getTotalSplitAmount())}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Ursprünglicher Betrag:</span>
                  <span className="font-bold">{formatBetrag(payment.betrag)}</span>
                </div>
                <div className={`flex justify-between items-center text-sm font-bold ${
                  Math.abs(getRemainingAmount()) < 0.01 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span>Differenz:</span>
                  <span>{formatBetrag(getRemainingAmount())}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSplit} 
              disabled={!canSplit()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Zahlung aufteilen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};