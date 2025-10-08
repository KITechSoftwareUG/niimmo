import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { TrendingUp, ChevronDown } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(false);
  
  const { data, isLoading, error, refetch, isFetching } = useQuery<{ eligible_contracts?: RentIncreaseEligibility[] | null}>({
    queryKey: ["rent-increase-eligibility"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-rent-increase-eligibility");
      if (error) throw error;
      return data ?? { eligible_contracts: [] };
    },
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      const el = contentRef.current;
      const height = el.scrollHeight;
      setMaxHeight(height);
    } else {
      setMaxHeight(0);
    }
  }, [isOpen, data, isFetching]);

  const eligible = useMemo(() => data?.eligible_contracts ?? [], [data]);

  return (
    
      <Card>
          <CardHeader
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
              }
            }}
            className="flex p-4 sm:p-6 cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-base font-medium">Mögliche Mieterhöhungen</span>
                <Badge variant="secondary" className="ml-2">{eligible.length}</Badge>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>

        <div
          ref={contentRef}
          className="overflow-hidden transition-[max-height] duration-300"
          style={{ maxHeight: isOpen ? `${maxHeight}px` : 0 }}
          aria-hidden={!isOpen}
        >
          {isOpen && (
            <CardContent className="pt-0">
              <div className="flex items-center justify-end mb-3">
                <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching ? "Aktualisiere…" : "Aktualisieren"}
                </Button>
              </div>
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
          )}
        </div>
      </Card>
    
  );
}

export default RentIncreaseList;

