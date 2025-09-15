import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  console.log('MieterhöhungenSection: Component rendering, isOpen:', isOpen);

  const { data: eligibilityData, isLoading, error: eligibilityError } = useQuery({
    queryKey: ['rent-increase-eligibility'],
    queryFn: async () => {
      console.log('MieterhöhungenSection: Fetching eligibility data...');
      const { data, error } = await supabase.functions.invoke('check-rent-increase-eligibility');
      
      if (error) {
        console.error('MieterhöhungenSection: Error fetching eligibility data:', error);
        throw error;
      }
      console.log('MieterhöhungenSection: Eligibility data received:', data);
      return data;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: contractsData, error: contractsError } = useQuery({
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
    enabled: !!eligibilityData?.eligible_contracts?.length,
  });

  console.log('MieterhöhungenSection: Current state - isLoading:', isLoading, 'eligibilityError:', eligibilityError, 'contractsError:', contractsError);

  if (eligibilityError) {
    console.error('MieterhöhungenSection: Eligibility error detected:', eligibilityError);
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
            Fehler beim Laden der Mieterhöhungen: {eligibilityError.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (contractsError) {
    console.error('MieterhöhungenSection: Contracts error detected:', contractsError);
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
            Fehler beim Laden der Verträge: {contractsError.message}
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

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Toggle clicked - before:', isOpen);
    setIsOpen(prev => {
      console.log('Toggle clicked - after:', !prev);
      return !prev;
    });
  };

  console.log('Rendering MieterhöhungenSection - isOpen:', isOpen, 'eligibleContracts:', eligibleContracts.length);

  const mieterhöhungsBedingungen = [
    "Mindestens 15 Monate seit der letzten Mieterhöhung vergangen",
    "Mietvertrag besteht seit mindestens 15 Monaten",
    "Maximal 20% Erhöhung innerhalb von 3 Jahren",
    "Ortsübliche Vergleichsmiete als Grundlage",
    "Schriftliche Ankündigung mit 3-monatiger Vorlaufzeit",
    "Begründung der Mieterhöhung erforderlich"
  ];

  const handleSendRentIncrease = async () => {
    try {
      // TODO: Implementierung für das Versenden von Mieterhöhungen
      console.log('Sende Mieterhöhungen für', eligibleContracts.length, 'Verträge');
    } catch (error) {
      console.error('Fehler beim Versenden der Mieterhöhungen:', error);
    }
  };

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle(e as any);
          }
        }}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mögliche Mieterhöhungen
            <Badge variant="secondary" className="ml-2">
              {eligibleContracts.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSendRentIncrease();
              }}
              disabled={eligibleContracts.length === 0}
            >
              Mieterhöhung versenden
            </Button>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bedingungen für Mieterhöhungen */}
            <div>
              <h4 className="font-medium mb-3 text-sm">Bedingungen für Mieterhöhungen:</h4>
              <ul className="space-y-2">
                {mieterhöhungsBedingungen.map((bedingung, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                    {bedingung}
                  </li>
                ))}
              </ul>
            </div>

            {/* Berechtigte Verträge */}
            <div>
              <h4 className="font-medium mb-3 text-sm">Berechtigte Verträge ({eligibleContracts.length}):</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
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
                            <span className="font-medium text-sm">{propertyName}</span>
                            <Badge variant="outline" className="text-xs">Einheit {unitId.slice(-8)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {tenantName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contract.current_kaltmiete.toFixed(2)}€/Monat
                          </p>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onContractClick?.(contract.mietvertrag_id)}
                        >
                          Öffnen
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}