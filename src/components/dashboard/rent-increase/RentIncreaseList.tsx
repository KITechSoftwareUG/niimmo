import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp, ChevronRight } from "lucide-react";

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

  const eligible = data?.eligible_contracts ?? [];

  return (
    <div className="relative border rounded-lg shadow-sm bg-card">
      {/* HEADER ALS BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((o) => !o);
          }
        }}
        aria-expanded={isOpen}
        aria-controls="rent-increase-content"
        className="w-full cursor-pointer pointer-events-auto relative z-10 select-none flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 bg-muted/50 hover:bg-muted transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-medium text-base">Mögliche Mieterhöhungen</span>
          {isOpen && eligible.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-full">
              {eligible.length}
            </span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* INHALT mit einfacher Auf/Zu-Animation */}
      <div
        id="rent-increase-content"
        className="relative z-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '1000px' : '0', opacity: isOpen ? 1 : 0 }}
      >
        <div className="p-4 sm:p-6 space-y-3 border-t">
          <div className="flex items-center justify-end">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                refetch();
              }} 
              disabled={isFetching}
            >
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
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onContractClick(row.mietvertrag_id);
                        }}
                      >
                        Öffnen
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RentIncreaseList;
