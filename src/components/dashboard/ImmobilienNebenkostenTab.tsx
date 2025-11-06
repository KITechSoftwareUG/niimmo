import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Euro, Calendar, Trash2, Link2Off, Loader2, Edit, Building, Check, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AssignPaymentDialog } from "@/components/controlboard/AssignPaymentDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ImmobilienNebenkostenTabProps {
  immobilieId: string;
}

// Helper function to get unit label from ID
const getEinheitLabel = (einheit: any): string => {
  if (einheit.zaehler) return `Einheit ${einheit.zaehler}`;
  const digitsFromId = (einheit.id as string).replace(/\D/g, "");
  const lastTwo = digitsFromId.slice(-2) || "00";
  return `Einheit ${lastTwo}`;
};

// Helper function to get numeric sort key
const getEinheitSortKey = (einheit: any): number => {
  const digitsFromZaehler = typeof einheit.zaehler === 'string' || typeof einheit.zaehler === 'number'
    ? String(einheit.zaehler).replace(/\D/g, '')
    : '';
  if (digitsFromZaehler) {
    // Use full numeric value for sorting (not only last two)
    return parseInt(digitsFromZaehler, 10);
  }
  const digitsFromId = (einheit.id as string).replace(/\D/g, '');
  const lastTwo = digitsFromId.slice(-2) || '0';
  return parseInt(lastTwo, 10) || 0;
};

export function ImmobilienNebenkostenTab({ immobilieId }: ImmobilienNebenkostenTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [editingEinheitId, setEditingEinheitId] = useState<string | null>(null);
  const [editingPercentage, setEditingPercentage] = useState<string>("");

  // Fetch einheiten for this property
  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ['einheiten-nebenkosten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', immobilieId);

      if (error) throw error;
      
      // Sort using derived numeric key (zaehler digits if present, else last two digits from ID)
      const sorted = (data || []).sort((a, b) => getEinheitSortKey(a) - getEinheitSortKey(b));
      
      // Initialize percentages based on qm if not set
      const totalQm = sorted.reduce((sum, e) => sum + (e.qm || 0), 0);
      const needsInitialization = sorted.some(e => 
        !e.verteilerschluessel_wert || e.verteilerschluessel_wert === 0
      );

      if (needsInitialization && totalQm > 0) {
        // Update all units with qm-based percentages
        for (const einheit of sorted) {
          const percentage = totalQm > 0 ? ((einheit.qm || 0) / totalQm) * 100 : 0;
          await supabase
            .from('einheiten')
            .update({ 
              verteilerschluessel_wert: percentage,
              verteilerschluessel_art: 'individuell'
            })
            .eq('id', einheit.id);
        }
        
        // Refetch to get updated data
        const { data: updatedData, error: refetchError } = await supabase
          .from('einheiten')
          .select('*')
          .eq('immobilie_id', immobilieId);
        
        if (refetchError) throw refetchError;
        return (updatedData || []).sort((a, b) => getEinheitSortKey(a) - getEinheitSortKey(b));
      }
      
      return sorted;
    },
  });

  // Fetch payments for this property (Betriebskosten)
  const { data: zahlungen, isLoading: zahlungenLoading } = useQuery({
    queryKey: ['immobilien-nebenkosten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('buchungsdatum', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const handleUnassign = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: null })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Zuordnung aufgehoben",
        description: "Die Zahlung wurde von der Immobilie getrennt.",
      });

      await queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten', immobilieId] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });
    } catch (error: any) {
      console.error('Error unassigning payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zuordnung konnte nicht aufgehoben werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedPaymentId) return;

    try {
      const { error } = await supabase
        .from('zahlungen')
        .delete()
        .eq('id', selectedPaymentId);

      if (error) throw error;

      toast({
        title: "Zahlung gelöscht",
        description: "Die Zahlung wurde erfolgreich gelöscht.",
      });

      await queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten', immobilieId] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });
      
      setDeleteDialogOpen(false);
      setSelectedPaymentId(null);
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zahlung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePercentage = async (einheitId: string, newPercentage: number) => {
    try {
      if (newPercentage < 0 || newPercentage > 100) {
        toast({
          title: "Ungültiger Wert",
          description: "Der Prozentsatz muss zwischen 0 und 100 liegen.",
          variant: "destructive",
        });
        return;
      }

      // Wenn auf 0% gesetzt, verteile den Anteil auf die anderen
      if (newPercentage === 0 && einheiten && einheiten.length > 1) {
        const currentEinheit = einheiten.find(e => e.id === einheitId);
        if (!currentEinheit) return;

        const currentValue = currentEinheit.verteilerschluessel_wert || 0;
        const otherEinheiten = einheiten.filter(e => e.id !== einheitId);
        const totalOthers = otherEinheiten.reduce((sum, e) => sum + (e.verteilerschluessel_wert || 0), 0);

        // Verteile den aktuellen Anteil proportional auf die anderen
        if (totalOthers > 0) {
          const updates = otherEinheiten.map(e => {
            const currentOtherValue = e.verteilerschluessel_wert || 0;
            const proportion = currentOtherValue / totalOthers;
            const additionalValue = currentValue * proportion;
            const newValue = currentOtherValue + additionalValue;
            return { id: e.id, value: newValue };
          });

          // Update alle anderen Einheiten
          for (const update of updates) {
            await supabase
              .from('einheiten')
              .update({ 
                verteilerschluessel_wert: update.value,
                verteilerschluessel_art: 'individuell'
              })
              .eq('id', update.id);
          }
        }
      }

      // Update die aktuelle Einheit
      const { error } = await supabase
        .from('einheiten')
        .update({ 
          verteilerschluessel_wert: newPercentage,
          verteilerschluessel_art: 'individuell'
        })
        .eq('id', einheitId);

      if (error) throw error;

      toast({
        title: "Prozentsatz aktualisiert",
        description: newPercentage === 0 
          ? "Der Anteil wurde auf 0% gesetzt und auf andere Einheiten verteilt."
          : "Der Prozentsatz wurde erfolgreich aktualisiert.",
      });

      setEditingEinheitId(null);
      setEditingPercentage("");
      await queryClient.invalidateQueries({ queryKey: ['einheiten-nebenkosten', immobilieId] });
    } catch (error: any) {
      console.error('Error updating percentage:', error);
      toast({
        title: "Fehler",
        description: error.message || "Der Prozentsatz konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const calculateDistribution = () => {
    if (!einheiten || einheiten.length === 0) return [];

    return einheiten.map(einheit => {
      // Alle Einheiten verwenden jetzt nur noch individuell (%)
      const anteil = einheit.verteilerschluessel_wert || 0;

      return {
        ...einheit,
        anteil: anteil,
      };
    });
  };

  const distributedEinheiten = calculateDistribution();
  const totalAnteil = distributedEinheiten.reduce((sum, e) => sum + e.anteil, 0);
  const totalNebenkosten = zahlungen?.reduce((sum, z) => sum + (z.betrag || 0), 0) || 0;

  const getCategoryColor = (kategorie: string | null) => {
    switch (kategorie) {
      case 'Miete': return 'bg-green-100 text-green-800 border-green-300';
      case 'Mietkaution': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Rücklastschrift': return 'bg-red-100 text-red-800 border-red-300';
      case 'Nichtmiete': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (einheitenLoading || zahlungenLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Kostenverteilung Übersicht */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Nebenkosten-Verteilung auf Einheiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-700 mb-2">Gesamte Nebenkosten der Immobilie:</p>
                <p className="text-3xl font-bold text-purple-900">
                  {totalNebenkosten.toFixed(2)} €
                </p>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {distributedEinheiten.map((einheit) => {
                    const anteilBetrag = (totalNebenkosten * einheit.anteil) / 100;
                    const isEditing = editingEinheitId === einheit.id;
                    
                    return (
                      <div
                        key={einheit.id}
                        className="p-4 border rounded-lg bg-white hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {getEinheitLabel(einheit)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {einheit.qm ? `${einheit.qm} m²` : 'Keine Fläche'}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingPercentage}
                                    onChange={(e) => setEditingPercentage(e.target.value)}
                                    className="w-24 h-8 text-sm"
                                    placeholder="0.00"
                                  />
                                  <span className="text-sm text-gray-600">%</span>
                                  <Button
                                    onClick={() => {
                                      const value = parseFloat(editingPercentage);
                                      if (!isNaN(value)) {
                                        handleUpdatePercentage(einheit.id, value);
                                      }
                                    }}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setEditingEinheitId(null);
                                      setEditingPercentage("");
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div>
                                    <p className="text-sm text-gray-600">{einheit.anteil.toFixed(2)}%</p>
                                    <p className="text-xl font-bold text-purple-600">
                                      {anteilBetrag.toFixed(2)} €
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => {
                                      setEditingEinheitId(einheit.id);
                                      setEditingPercentage(einheit.anteil.toFixed(2));
                                    }}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        {/* Alle Nebenkosten-Zahlungen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Alle Nebenkosten ({zahlungen?.length || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!zahlungen || zahlungen.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Euro className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Nebenkosten-Zahlungen für diese Immobilie gefunden</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {zahlungen.map((zahlung) => (
                    <div
                      key={zahlung.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(zahlung.buchungsdatum), 'dd. MMMM yyyy', { locale: de })}
                            </span>
                            <span className={`font-bold text-lg ${zahlung.betrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)} €
                            </span>
                          </div>

                          {zahlung.kategorie && (
                            <Badge variant="outline" className={getCategoryColor(zahlung.kategorie)}>
                              {zahlung.kategorie}
                            </Badge>
                          )}

                          {zahlung.empfaengername && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Empfänger:</strong> {zahlung.empfaengername}
                            </p>
                          )}

                          {zahlung.verwendungszweck && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Verwendungszweck:</strong> {zahlung.verwendungszweck}
                            </p>
                          )}

                          {zahlung.zugeordneter_monat && (
                            <p className="text-xs text-muted-foreground">
                              Monat: {zahlung.zugeordneter_monat}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(zahlung);
                              setAssignDialogOpen(true);
                            }}
                            title="Neu zuordnen"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnassign(zahlung.id)}
                            title="Zuordnung aufheben"
                          >
                            <Link2Off className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPaymentId(zahlung.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Zahlung löschen"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Payment Dialog */}
      <AssignPaymentDialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) {
            setSelectedPayment(null);
            queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten', immobilieId] });
          }
        }}
        payment={selectedPayment ? {
          id: selectedPayment.id,
          betrag: selectedPayment.betrag,
          buchungsdatum: selectedPayment.buchungsdatum,
          empfaengername: selectedPayment.empfaengername || undefined,
          iban: selectedPayment.iban || undefined,
          verwendungszweck: selectedPayment.verwendungszweck || undefined,
          kategorie: selectedPayment.kategorie || undefined,
        } : null}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zahlung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diese Zahlung löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPaymentId(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
