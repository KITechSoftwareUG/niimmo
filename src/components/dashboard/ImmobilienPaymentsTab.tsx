import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Euro, Calendar, Trash2, Link2Off, Loader2, Edit } from "lucide-react";
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

interface ImmobilienPaymentsTabProps {
  immobilieId: string;
}

export function ImmobilienPaymentsTab({ immobilieId }: ImmobilienPaymentsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  // Fetch payments for this property
  const { data: zahlungen, isLoading } = useQuery({
    queryKey: ['immobilien-zahlungen', immobilieId],
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

      await queryClient.invalidateQueries({ queryKey: ['immobilien-zahlungen', immobilieId] });
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

      await queryClient.invalidateQueries({ queryKey: ['immobilien-zahlungen', immobilieId] });
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

  const getCategoryColor = (kategorie: string | null) => {
    switch (kategorie) {
      case 'Miete': return 'bg-green-100 text-green-800 border-green-300';
      case 'Mietkaution': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Rücklastschrift': return 'bg-red-100 text-red-800 border-red-300';
      case 'Nichtmiete': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Zahlungen ({zahlungen?.length || 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!zahlungen || zahlungen.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Euro className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Zahlungen für diese Immobilie gefunden</p>
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
                          {/* Datum und Betrag */}
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(zahlung.buchungsdatum), 'dd. MMMM yyyy', { locale: de })}
                            </span>
                            <span className={`font-bold text-lg ${zahlung.betrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)} €
                            </span>
                          </div>

                          {/* Kategorie */}
                          {zahlung.kategorie && (
                            <Badge variant="outline" className={getCategoryColor(zahlung.kategorie)}>
                              {zahlung.kategorie}
                            </Badge>
                          )}

                          {/* Empfängername */}
                          {zahlung.empfaengername && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Empfänger:</strong> {zahlung.empfaengername}
                            </p>
                          )}

                          {/* Verwendungszweck */}
                          {zahlung.verwendungszweck && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Verwendungszweck:</strong> {zahlung.verwendungszweck}
                            </p>
                          )}

                          {/* Zugeordneter Monat */}
                          {zahlung.zugeordneter_monat && (
                            <p className="text-xs text-muted-foreground">
                              Monat: {zahlung.zugeordneter_monat}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
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
            queryClient.invalidateQueries({ queryKey: ['immobilien-zahlungen', immobilieId] });
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
