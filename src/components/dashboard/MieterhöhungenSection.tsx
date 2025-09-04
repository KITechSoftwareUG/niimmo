import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useState } from "react";

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
  const [isOpen, setIsOpen] = useState(false);

  const { data: eligibilityData, isLoading } = useQuery({
    queryKey: ['rent-increase-eligibility'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-rent-increase-eligibility');
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
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
            einheitentyp,
            immobilien!inner(
              name
            )
          ),
          mietvertrag_mieter!inner(
            mieter!inner(
              vorname,
              nachname
            )
          )
        `)
        .eq('status', 'aktiv');

      if (error) throw error;
      return data;
    },
    enabled: eligibilityData?.eligible_contracts?.length > 0,
  });

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

  if (eligibleContracts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mögliche Mieterhöhungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aktuell sind keine Mieterhöhungen möglich.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Mögliche Mieterhöhungen
                <Badge variant="secondary" className="ml-2">
                  {eligibleContracts.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {eligibleContracts.map((contract) => {
                const contractDetails = contractsData?.find(c => c.id === contract.mietvertrag_id);
                const propertyName = contractDetails?.einheiten?.immobilien?.name || 'Unbekannt';
                const unitId = contractDetails?.einheiten?.id || 'N/A';
                const tenantName = contractDetails?.mietvertrag_mieter?.[0]?.mieter 
                  ? `${contractDetails.mietvertrag_mieter[0].mieter.vorname} ${contractDetails.mietvertrag_mieter[0].mieter.nachname}`
                  : 'Unbekannt';

                return (
                  <div
                    key={contract.mietvertrag_id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{propertyName}</span>
                        <Badge variant="outline">Einheit {unitId.slice(-8)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Mieter: {tenantName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aktuelle Kaltmiete: {contract.current_kaltmiete.toFixed(2)}€
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contract.reason}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Möglich
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onContractClick?.(contract.mietvertrag_id)}
                      >
                        Öffnen
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}