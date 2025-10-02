import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RentIncreaseTable } from "./rent-increase/RentIncreaseTable";

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
  const [isOpen, setIsOpen] = useState(false);

  // 1) Eligibility - lightweight and cached
  const { data: eligibilityData, isLoading: isLoadingEligibility, error: eligibilityError } = useQuery<{ eligible_contracts?: RentIncreaseEligibility[] | null}>({
    queryKey: ["rent-increase-eligibility"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-rent-increase-eligibility");
      if (error) throw error;
      return data ?? { eligible_contracts: [] };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const eligibleContracts = useMemo(() => eligibilityData?.eligible_contracts ?? [], [eligibilityData]);

  // 2) Contracts - only when open AND we have something to show
  const { data: contractsData, isLoading: isLoadingContracts, error: contractsError } = useQuery({
    queryKey: ["mietvertraege-with-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mietvertrag")
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
        .eq("status", "aktiv");
      if (error) throw error;
      return data;
    },
    enabled: isOpen && eligibleContracts.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const handleGeneratePdf = async (contractId: string) => {
    setGeneratingPdf(contractId);
    try {
      const { error } = await supabase.functions.invoke("generate-rent-increase-pdf", {
        body: { mietvertragId: contractId },
      });
      if (error) throw error;
      toast({
        title: "PDF erstellt",
        description: "Die Mieterhöhungs-PDF wurde erfolgreich erstellt und gespeichert.",
      });
    } catch (error) {
      console.error("Fehler beim Erstellen der PDF:", error);
      toast({
        title: "Fehler",
        description: "Die PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Error/Loading wrappers kept minimal and robust
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
          <p className="text-destructive">Fehler beim Laden: {(eligibilityError as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingEligibility) {
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

  const count = eligibleContracts.length;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-0">
          <CollapsibleTrigger asChild>
            <button className="w-full cursor-pointer hover:bg-muted/50 transition-colors select-none px-6 py-4 text-left">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Mögliche Mieterhöhungen
                  <Badge variant="secondary" className="ml-2">{count}</Badge>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {!isOpen ? null : count === 0 ? (
              <p className="text-sm text-muted-foreground">Aktuell sind keine Mieterhöhungen möglich.</p>
            ) : isLoadingContracts ? (
              <p className="text-sm text-muted-foreground">Vertragsdaten werden geladen...</p>
            ) : contractsError ? (
              <p className="text-sm text-destructive">Fehler beim Laden der Vertragsdaten: {(contractsError as Error).message}</p>
            ) : (
              <RentIncreaseTable
                rows={eligibleContracts}
                contractsData={contractsData}
                generatingPdf={generatingPdf}
                onGeneratePdf={handleGeneratePdf}
                onOpenContract={onContractClick}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
