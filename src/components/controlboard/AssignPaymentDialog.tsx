import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, User, Building2, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface AssignPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    betrag: number;
    buchungsdatum: string;
    empfaengername?: string;
    iban?: string;
    verwendungszweck?: string;
  } | null;
}

export function AssignPaymentDialog({ open, onOpenChange, payment }: AssignPaymentDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active contracts with related data
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['active-contracts-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          start_datum,
          ende_datum,
          kaltmiete,
          betriebskosten,
          einheiten (
            id,
            etage,
            qm,
            immobilien (
              id,
              name,
              adresse
            )
          ),
          mietvertrag_mieter (
            mieter (
              id,
              vorname,
              nachname
            )
          )
        `)
        .eq('status', 'aktiv')
        .order('start_datum', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Filter contracts based on search
  const filteredContracts = contracts?.filter(contract => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const mieterNames = contract.mietvertrag_mieter
      ?.map(mm => `${mm.mieter?.vorname} ${mm.mieter?.nachname}`.toLowerCase())
      .join(' ') || '';
    const immobilieName = contract.einheiten?.immobilien?.name?.toLowerCase() || '';
    const adresse = contract.einheiten?.immobilien?.adresse?.toLowerCase() || '';
    
    return mieterNames.includes(search) || 
           immobilieName.includes(search) || 
           adresse.includes(search);
  });

  const handleAssign = async (contractId: string) => {
    if (!payment) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ mietvertrag_id: contractId })
        .eq('id', payment.id);

      if (error) throw error;

      toast({
        title: "Zahlung zugeordnet",
        description: "Die Zahlung wurde erfolgreich dem Mietvertrag zugeordnet.",
      });

      // Refresh queries
      await queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zahlung konnte nicht zugeordnet werden.",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCategorizeAsNonRent = async () => {
    if (!payment) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ kategorie: 'Nichtmiete' })
        .eq('id', payment.id);

      if (error) throw error;

      toast({
        title: "Als Nichtmiete kategorisiert",
        description: "Die Zahlung wurde als sonstige Zahlung markiert.",
      });

      // Refresh queries
      await queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error categorizing payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Kategorisierung konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Zahlung zuordnen</DialogTitle>
          {payment && (
            <div className="text-sm text-muted-foreground space-y-1 mt-2">
              <p><strong>Betrag:</strong> {payment.betrag.toFixed(2)} €</p>
              <p><strong>Datum:</strong> {format(new Date(payment.buchungsdatum), 'dd.MM.yyyy')}</p>
              {payment.empfaengername && <p><strong>Empfänger:</strong> {payment.empfaengername}</p>}
              {payment.verwendungszweck && <p><strong>Verwendungszweck:</strong> {payment.verwendungszweck}</p>}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mieter, Immobilie oder Adresse suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Contracts List */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Lade Mietverträge...
              </div>
            ) : filteredContracts?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Keine aktiven Mietverträge gefunden
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredContracts?.map((contract) => {
                  const mieter = contract.mietvertrag_mieter?.[0]?.mieter;
                  const immobilie = contract.einheiten?.immobilien;
                  const warmmiete = (contract.kaltmiete || 0) + (contract.betriebskosten || 0);

                  return (
                    <div
                      key={contract.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                      onClick={() => handleAssign(contract.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          {/* Mieter */}
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">
                              {mieter?.vorname} {mieter?.nachname}
                            </span>
                          </div>

                          {/* Immobilie */}
                          {immobilie && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                              <span>{immobilie.name}</span>
                            </div>
                          )}

                          {/* Adresse */}
                          {immobilie?.adresse && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{immobilie.adresse}</span>
                            </div>
                          )}

                          {/* Vertragsdaten */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {format(new Date(contract.start_datum), 'dd.MM.yyyy')}
                                {contract.ende_datum && ` - ${format(new Date(contract.ende_datum), 'dd.MM.yyyy')}`}
                              </span>
                            </div>
                            <div>
                              <strong>{warmmiete.toFixed(2)} €</strong> / Monat
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isAssigning}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Zuordnen
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleCategorizeAsNonRent}
            disabled={isAssigning}
          >
            Als Nichtmiete kategorisieren
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
