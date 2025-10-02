import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RentIncreaseTable } from "./RentIncreaseTable";

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

interface ContractsDataItem {
  id: string;
}

interface RentIncreaseSectionProps {
  onContractClick?: (contractId: string) => void;
}

export function RentIncreaseSection({ onContractClick }: RentIncreaseSectionProps) {
  const { toast } = useToast();
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data: eligibilityData, isLoading: isLoadingElig, error: eligError } = useQuery<{ eligible_contracts?: RentIncreaseEligibility[] | null}>({
    queryKey: ["rent-increase-eligibility"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-rent-increase-eligibility");
      if (error) throw error;
      return data ?? { eligible_contracts: [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const eligible = useMemo(() => eligibilityData?.eligible_contracts ?? [], [eligibilityData]);

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
    enabled: open && eligible.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const handleGeneratePdf = async (contractId: string) => {
    setGeneratingPdf(contractId);
    try {
      const { error } = await supabase.functions.invoke("generate-rent-increase-pdf", { body: { mietvertragId: contractId } });
      if (error) throw error;
      toast({ title: "PDF erstellt", description: "Die Mieterhöhungs-PDF wurde erfolgreich erstellt und gespeichert." });
    } catch (e) {
      console.error(e);
      toast({ title: "Fehler", description: "Die PDF konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setGeneratingPdf(null);
    }
  };

  if (eligError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Mögliche Mieterhöhungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Fehler beim Laden: {(eligError as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingElig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Mögliche Mieterhöhungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Wird geprüft...</p>
        </CardContent>
      </Card>
    );
  }

  const count = eligible.length;

  return (
    <Card>
      <CardHeader className="p-0">
        <Accordion type="single" collapsible value={open ? "item-1" : undefined} onValueChange={(v) => setOpen(!!v)}>
          <AccordionItem value="item-1" className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:bg-muted/50">
              <CardTitle className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Mögliche Mieterhöhungen
                  <Badge variant="secondary" className="ml-2">{count}</Badge>
                </div>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                {!open ? null : count === 0 ? (
                  <p className="text-sm text-muted-foreground">Aktuell sind keine Mieterhöhungen möglich.</p>
                ) : isLoadingContracts ? (
                  <p className="text-sm text-muted-foreground">Vertragsdaten werden geladen...</p>
                ) : contractsError ? (
                  <p className="text-sm text-destructive">Fehler beim Laden der Vertragsdaten: {(contractsError as Error).message}</p>
                ) : (
                  <RentIncreaseTable
                    rows={eligible}
                    contractsData={contractsData}
                    generatingPdf={generatingPdf}
                    onGeneratePdf={handleGeneratePdf}
                    onOpenContract={onContractClick}
                  />
                )}
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardHeader>
    </Card>
  );
}
