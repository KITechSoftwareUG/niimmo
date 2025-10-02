import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RentIncreaseEligibility {
  mietvertrag_id: string;
  current_kaltmiete: number;
  letzte_mieterhoehung_am: string | null;
  start_datum: string;
  is_eligible: boolean;
  months_since_last_increase: number;
  months_since_start: number;
  reason: string;
}

interface MieterhöhungenSectionProps {
  onContractClick?: (contractId: string) => void;
}

export function MieterhöhungenSection({ onContractClick }: MieterhöhungenSectionProps) {
  const { toast } = useToast();
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const { data: eligibilityData, isLoading, error: eligibilityError } = useQuery({
    queryKey: ['rent-increase-eligibility'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-rent-increase-eligibility');
      if (error) throw error;
      return data;
    },
    refetchInterval: 300000,
  });

  const { data: contractsData } = useQuery({
    queryKey: ['mietvertraege-with-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          kaltmiete,
          betriebskosten,
          start_datum,
          letzte_mieterhoehung_am,
          einheiten!inner(
            id,
            immobilien!inner(
              name,
              adresse
            )
          ),
          mietvertrag_mieter!inner(
            mieter!inner(
              vorname,
              nachname,
              hauptmail
            )
          )
        `)
        .eq('status', 'aktiv');

      if (error) throw error;
      return data;
    },
    enabled: !!eligibilityData?.eligible_contracts?.length,
  });

  const handleGeneratePdf = async (contractId: string) => {
    setGeneratingPdf(contractId);
    try {
      const contractDetails = contractsData?.find(c => c.id === contractId);
      
      if (!contractDetails) {
        throw new Error('Vertragsdaten nicht gefunden');
      }

      const { data, error } = await supabase.functions.invoke('generate-rent-increase-pdf', {
        body: {
          mietvertragId: contractId,
        }
      });

      if (error) throw error;

      toast({
        title: "PDF erstellt",
        description: "Die Mieterhöhungs-PDF wurde erfolgreich erstellt und gespeichert.",
      });
    } catch (error) {
      console.error('Fehler beim Erstellen der PDF:', error);
      toast({
        title: "Fehler",
        description: "Die PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(null);
    }
  };

  if (eligibilityError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mögliche Mieterhöhungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            Fehler beim Laden: {eligibilityError.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mögliche Mieterhöhungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Wird geprüft...</p>
        </CardContent>
      </Card>
    );
  }

  const eligibleContracts = eligibilityData?.eligible_contracts || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Mögliche Mieterhöhungen
          <Badge variant="secondary" className="ml-2">
            {eligibleContracts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {eligibleContracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aktuell sind keine Mieterhöhungen möglich.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Immobilie</TableHead>
                <TableHead>Mieter</TableHead>
                <TableHead>Aktuelle Miete</TableHead>
                <TableHead>Letzte Erhöhung</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibleContracts.map((contract) => {
                const contractDetails = contractsData?.find(c => c.id === contract.mietvertrag_id);
                const propertyName = contractDetails?.einheiten?.immobilien?.name || 'Unbekannt';
                const tenantName = contractDetails?.mietvertrag_mieter?.[0]?.mieter 
                  ? `${contractDetails.mietvertrag_mieter[0].mieter.vorname} ${contractDetails.mietvertrag_mieter[0].mieter.nachname}`
                  : 'Unbekannt';
                const lastIncrease = contract.letzte_mieterhoehung_am 
                  ? new Date(contract.letzte_mieterhoehung_am).toLocaleDateString('de-DE')
                  : 'Nie';

                return (
                  <TableRow key={contract.mietvertrag_id}>
                    <TableCell className="font-medium">{propertyName}</TableCell>
                    <TableCell>{tenantName}</TableCell>
                    <TableCell>{contract.current_kaltmiete.toFixed(2)}€</TableCell>
                    <TableCell>{lastIncrease}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleGeneratePdf(contract.mietvertrag_id)}
                          disabled={generatingPdf === contract.mietvertrag_id}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {generatingPdf === contract.mietvertrag_id ? 'Erstellt...' : 'PDF erstellen'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onContractClick?.(contract.mietvertrag_id)}
                        >
                          Öffnen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
