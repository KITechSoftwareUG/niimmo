import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "./UserMenu";
import { toast } from "sonner";
import { 
  Loader2, 
  Building2, 
  Droplets, 
  Flame, 
  Zap, 
  ThermometerSun,
  Save,
  Wrench,
  ChevronDown,
  ChevronRight,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MeterReading {
  einheitId: string;
  type: 'kaltwasser' | 'warmwasser' | 'strom' | 'gas';
  zaehlerNummer: string;
  stand: string;
}

export const HausmeisterDashboard = () => {
  const queryClient = useQueryClient();
  const [expandedImmobilien, setExpandedImmobilien] = useState<Set<string>>(new Set());
  const [editedReadings, setEditedReadings] = useState<Record<string, MeterReading>>({});
  const [savingUnits, setSavingUnits] = useState<Set<string>>(new Set());

  // Fetch all properties with their units
  const { data: immobilien, isLoading } = useQuery({
    queryKey: ['hausmeister-immobilien'],
    queryFn: async () => {
      const { data: props, error: propsError } = await supabase
        .from('immobilien')
        .select('id, name, adresse')
        .order('name');
      
      if (propsError) throw propsError;
      
      // For each property, get units with meter data
      const propsWithUnits = await Promise.all(
        props.map(async (prop) => {
          const { data: units, error: unitsError } = await supabase
            .from('einheiten')
            .select(`
              id, 
              zaehler,
              etage,
              qm,
              einheitentyp,
              kaltwasser_zaehler,
              warmwasser_zaehler,
              strom_zaehler,
              gas_zaehler,
              kaltwasser_stand_aktuell,
              kaltwasser_stand_datum,
              warmwasser_stand_aktuell,
              warmwasser_stand_datum,
              strom_stand_aktuell,
              strom_stand_datum,
              gas_stand_aktuell,
              gas_stand_datum
            `)
            .eq('immobilie_id', prop.id)
            .order('zaehler');
          
          if (unitsError) throw unitsError;

          // Get active contracts for tenant info
          const unitIds = units?.map(u => u.id) || [];
          const { data: contracts } = await supabase
            .from('mietvertrag')
            .select(`
              id,
              einheit_id,
              status,
              mietvertrag_mieter!inner(mieter:mieter_id(vorname, nachname))
            `)
            .in('einheit_id', unitIds)
            .eq('status', 'aktiv');

          const contractMap = new Map(
            contracts?.map(c => [c.einheit_id, c]) || []
          );

          return {
            ...prop,
            einheiten: units?.map(u => ({
              ...u,
              vertrag: contractMap.get(u.id)
            })) || []
          };
        })
      );
      
      return propsWithUnits;
    }
  });

  const updateMeterMutation = useMutation({
    mutationFn: async ({ einheitId, updates }: { einheitId: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('einheiten')
        .update(updates)
        .eq('id', einheitId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hausmeister-immobilien'] });
    }
  });

  const toggleImmobilie = (id: string) => {
    setExpandedImmobilien(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleInputChange = (einheitId: string, type: string, field: 'zaehler' | 'stand', value: string) => {
    const key = `${einheitId}-${type}`;
    setEditedReadings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        einheitId,
        type: type as MeterReading['type'],
        [field === 'zaehler' ? 'zaehlerNummer' : 'stand']: value
      }
    }));
  };

  const getEditedValue = (einheitId: string, type: string, field: 'zaehler' | 'stand') => {
    const key = `${einheitId}-${type}`;
    const edited = editedReadings[key];
    if (!edited) return undefined;
    return field === 'zaehler' ? edited.zaehlerNummer : edited.stand;
  };

  const hasUnsavedChanges = (einheitId: string) => {
    return Object.keys(editedReadings).some(key => key.startsWith(`${einheitId}-`));
  };

  const saveUnitChanges = async (einheitId: string) => {
    const unitChanges = Object.entries(editedReadings)
      .filter(([key]) => key.startsWith(`${einheitId}-`))
      .map(([, reading]) => reading);

    if (unitChanges.length === 0) return;

    setSavingUnits(prev => new Set(prev).add(einheitId));

    try {
      const updates: Record<string, unknown> = {};
      const today = format(new Date(), 'yyyy-MM-dd');

      for (const change of unitChanges) {
        if (change.zaehlerNummer !== undefined) {
          updates[`${change.type}_zaehler`] = change.zaehlerNummer || null;
        }
        if (change.stand !== undefined) {
          const standValue = change.stand ? parseFloat(change.stand) : null;
          updates[`${change.type}_stand_aktuell`] = standValue;
          if (standValue !== null) {
            updates[`${change.type}_stand_datum`] = today;
          }
        }
      }

      await updateMeterMutation.mutateAsync({ einheitId, updates });

      // Clear saved changes from state
      setEditedReadings(prev => {
        const next = { ...prev };
        Object.keys(next)
          .filter(key => key.startsWith(`${einheitId}-`))
          .forEach(key => delete next[key]);
        return next;
      });

      toast.success("Zählerstände gespeichert");
    } catch (error) {
      console.error('Error saving meter readings:', error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSavingUnits(prev => {
        const next = new Set(prev);
        next.delete(einheitId);
        return next;
      });
    }
  };

  const getMeterIcon = (type: string) => {
    switch (type) {
      case 'kaltwasser': return <Droplets className="h-4 w-4 text-blue-500" />;
      case 'warmwasser': return <ThermometerSun className="h-4 w-4 text-orange-500" />;
      case 'strom': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'gas': return <Flame className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getMeterLabel = (type: string) => {
    switch (type) {
      case 'kaltwasser': return 'Kaltwasser';
      case 'warmwasser': return 'Warmwasser';
      case 'strom': return 'Strom';
      case 'gas': return 'Gas';
      default: return type;
    }
  };

  const formatStandDatum = (datum: string | null) => {
    if (!datum) return null;
    return format(new Date(datum), 'dd.MM.yyyy', { locale: de });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen modern-dashboard-bg flex items-center justify-center">
        <div className="glass-card p-12 rounded-3xl">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-6" />
          <p className="text-gray-700 font-sans font-medium text-lg text-center">Zählerstände werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <img src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" alt="NiImmo Logo" className="h-8 sm:h-12 w-auto" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-sans font-bold text-gradient-red">
                    NiImmo
                  </h1>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    <Wrench className="h-3 w-3 mr-1" />
                    Hausmeister
                  </Badge>
                </div>
                <p className="text-gray-600 font-sans text-xs sm:text-sm">
                  Zähler & Einheiten
                </p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 text-sm">
            Tragen Sie hier die aktuellen Zählerstände für alle Einheiten ein. Die Änderungen werden pro Einheit gespeichert.
          </p>
        </div>

        {/* Properties List */}
        <div className="space-y-4">
          {immobilien?.map((immobilie) => (
            <Card key={immobilie.id} className="overflow-hidden">
              <Collapsible 
                open={expandedImmobilien.has(immobilie.id)}
                onOpenChange={() => toggleImmobilie(immobilie.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedImmobilien.has(immobilie.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{immobilie.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{immobilie.adresse}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {immobilie.einheiten?.length || 0} Einheiten
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {immobilie.einheiten?.map((einheit) => {
                        const meterTypes = ['kaltwasser', 'warmwasser', 'strom', 'gas'] as const;
                        const tenantName = einheit.vertrag?.mietvertrag_mieter?.[0]?.mieter
                          ? `${einheit.vertrag.mietvertrag_mieter[0].mieter.vorname} ${einheit.vertrag.mietvertrag_mieter[0].mieter.nachname || ''}`
                          : null;

                        return (
                          <div 
                            key={einheit.id} 
                            className="border rounded-lg p-4 bg-white/50"
                          >
                            {/* Unit Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">
                                    Einheit {einheit.zaehler}
                                  </span>
                                  {einheit.etage && (
                                    <Badge variant="outline" className="text-xs">
                                      {einheit.etage}
                                    </Badge>
                                  )}
                                  {einheit.einheitentyp && (
                                    <Badge variant="secondary" className="text-xs">
                                      {einheit.einheitentyp}
                                    </Badge>
                                  )}
                                </div>
                                {tenantName && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Mieter: {tenantName}
                                  </p>
                                )}
                                {einheit.qm && (
                                  <p className="text-xs text-muted-foreground">
                                    {einheit.qm} m²
                                  </p>
                                )}
                              </div>
                              
                              {hasUnsavedChanges(einheit.id) && (
                                <Button
                                  size="sm"
                                  onClick={() => saveUnitChanges(einheit.id)}
                                  disabled={savingUnits.has(einheit.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {savingUnits.has(einheit.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Save className="h-4 w-4 mr-1" />
                                  )}
                                  Speichern
                                </Button>
                              )}
                            </div>

                            {/* Meter Readings Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {meterTypes.map((type) => {
                                const zaehlerKey = `${type}_zaehler` as keyof typeof einheit;
                                const standKey = `${type}_stand_aktuell` as keyof typeof einheit;
                                const datumKey = `${type}_stand_datum` as keyof typeof einheit;
                                
                                const currentZaehler = einheit[zaehlerKey] as string | null;
                                const currentStand = einheit[standKey] as number | null;
                                const standDatum = einheit[datumKey] as string | null;

                                const editedZaehler = getEditedValue(einheit.id, type, 'zaehler');
                                const editedStand = getEditedValue(einheit.id, type, 'stand');

                                return (
                                  <div key={type} className="bg-muted/30 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      {getMeterIcon(type)}
                                      <span className="font-medium text-sm">{getMeterLabel(type)}</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div>
                                        <label className="text-xs text-muted-foreground block mb-1">
                                          Zählernummer
                                        </label>
                                        <Input
                                          placeholder="Zählernr."
                                          value={editedZaehler ?? currentZaehler ?? ''}
                                          onChange={(e) => handleInputChange(einheit.id, type, 'zaehler', e.target.value)}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="text-xs text-muted-foreground block mb-1">
                                          Aktueller Stand
                                        </label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="Stand"
                                          value={editedStand ?? currentStand ?? ''}
                                          onChange={(e) => handleInputChange(einheit.id, type, 'stand', e.target.value)}
                                          className="h-8 text-sm"
                                        />
                                        {standDatum && editedStand === undefined && (
                                          <div className="flex items-center gap-1 mt-1">
                                            <Check className="h-3 w-3 text-green-500" />
                                            <span className="text-xs text-muted-foreground">
                                              {formatStandDatum(standDatum)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {immobilie.einheiten?.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">
                          Keine Einheiten vorhanden
                        </p>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>

        {immobilien?.length === 0 && (
          <div className="text-center py-20">
            <div className="glass-card p-12 max-w-md mx-auto rounded-3xl">
              <Building2 className="h-20 w-20 text-amber-300 mx-auto mb-6" />
              <h3 className="text-2xl font-sans font-semibold text-gray-700 mb-4">
                Keine Immobilien gefunden
              </h3>
              <p className="text-gray-500 font-sans leading-relaxed">
                Es sind noch keine Immobilien verfügbar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
