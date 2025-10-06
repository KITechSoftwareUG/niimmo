import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RentIncreaseSimpleTable, RentIncreaseEligibility } from "./RentIncreaseSimpleTable";

interface RentIncreasePanelProps {
  onContractClick?: (contractId: string) => void;
}

export function RentIncreasePanel({ onContractClick }: RentIncreasePanelProps) {
  const { toast } = useToast();
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{ eligible_contracts?: RentIncreaseEligibility[] | null}>({
    queryKey: ["rent-increase-eligibility"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-rent-increase-eligibility");
      if (error) throw error;
      return data ?? { eligible_contracts: [] };
    },
    enabled: open, // Nur laden, wenn geöffnet
    staleTime: 5 * 60 * 1000,
  });

  const eligible = useMemo(() => data?.eligible_contracts ?? [], [data]);

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

  return (
    <Card>
      <CardHeader className="p-0">
        <Accordion type="single" collapsible onValueChange={(v) => setOpen(!!v)}>
          <AccordionItem value="item-1" className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:bg-muted/50">
              <CardTitle className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Mögliche Mieterhöhungen
                  {open && <Badge variant="secondary" className="ml-2">{eligible.length}</Badge>}
                </div>
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                {!open ? null : isLoading ? (
                  <p className="text-sm text-muted-foreground">Wird geprüft…</p>
                ) : error ? (
                  <p className="text-sm text-destructive">Fehler: {(error as Error).message}</p>
                ) : eligible.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aktuell sind keine Mieterhöhungen möglich.</p>
                ) : (
                  <RentIncreaseSimpleTable
                    rows={eligible}
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
