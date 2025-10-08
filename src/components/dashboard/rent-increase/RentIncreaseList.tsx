import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, TrendingUp } from "lucide-react";

export interface RentIncreaseEligibility {
  mietvertrag_id: string;
  current_kaltmiete: number;
  letzte_mieterhoehung_am: string | null;
  start_datum: string;
  is_eligible: boolean;
  months_since_last_increase: number;
  months_since_start: number;
  reason: string;
}

interface RentIncreaseListProps {
  onContractClick?: (contractId: string) => void;
}

function formatCurrencyEUR(value: number) {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE").format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function RentIncreaseList({ onContractClick }: RentIncreaseListProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{ eligible_contracts?: RentIncreaseEligibility[] | null}>({
    queryKey: ["rent-increase-eligibility"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-rent-increase-eligibility");
      if (error) throw error;
      return data ?? { eligible_contracts: [] };
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const eligible = useMemo(() => data?.eligible_contracts ?? [], [data]);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="p-0">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50"
              aria-expanded={open}
              aria-controls="rent-increase-list"
            >
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Mögliche Mieterhöhungen
                {open && <Badge variant="secondary" className="ml-2">{eligible.length}</Badge>}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent id="rent-increase-list" className="pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Wird geprüft…</p>
            ) : error ? (
              <p className="text-sm text-destructive">Fehler: {(error as Error).message}</p>
            ) : eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktuell sind keine Mieterhöhungen möglich.</p>
            ) : (
              <div className="space-y-2">
                {eligible.map((row) => (
                  <div key={row.mietvertrag_id} className="flex items-center justify-between rounded-lg border p-3 bg-background">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-foreground">Vertrag {row.mietvertrag_id.slice(0, 8)}…</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">Kaltmiete {formatCurrencyEUR(row.current_kaltmiete)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Letzte Erhöhung: {formatDate(row.letzte_mieterhoehung_am)} • Vertragsstart: {formatDate(row.start_datum)}
                      </div>
                      {row.reason && (
                        <div className="text-xs text-muted-foreground mt-1" title={row.reason}>
                          {row.reason}
                        </div>
                      )}
                    </div>
                    {onContractClick && (
                      <div className="ml-3 shrink-0">
                        <Button size="sm" variant="secondary" onClick={() => onContractClick(row.mietvertrag_id)}>
                          Öffnen
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default RentIncreaseList;
