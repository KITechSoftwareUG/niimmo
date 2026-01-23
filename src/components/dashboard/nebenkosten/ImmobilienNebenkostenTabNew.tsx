import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Euro, Loader2, Building, ArrowRight, Undo2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NebenkostenBuildingView } from "./NebenkostenBuildingView";
import { NebenkostenPaymentCard } from "./NebenkostenPaymentCard";
import { NebenkostenArtenManager } from "./NebenkostenArtenManager";
import { KostenpositionenManager } from "./KostenpositionenManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ImmobilienNebenkostenTabNewProps {
  immobilieId: string;
}

export function ImmobilienNebenkostenTabNew({ immobilieId }: ImmobilienNebenkostenTabNewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draggedZahlung, setDraggedZahlung] = useState<string | null>(null);
  const [autoDistributeDialog, setAutoDistributeDialog] = useState<{ open: boolean; zahlungId: string | null }>({
    open: false,
    zahlungId: null,
  });

  // Fetch einheiten
  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ['einheiten-nebenkosten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', immobilieId);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch nebenkostenarten
  const { data: nebenkostenarten, isLoading: nebenkostenArtenLoading } = useQuery({
    queryKey: ['nebenkostenarten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nebenkostenarten')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch zahlungen für diese Immobilie
  const { data: zahlungen, isLoading: zahlungenLoading } = useQuery({
    queryKey: ['immobilien-nebenkosten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('buchungsdatum', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch nebenkosten_zahlungen (Zuordnungen)
  const { data: nebenkostenZahlungen, isLoading: nebenkostenZahlungenLoading } = useQuery({
    queryKey: ['nebenkosten-zahlungen', immobilieId],
    queryFn: async () => {
      const zahlungIds = zahlungen?.map(z => z.id) || [];
      if (zahlungIds.length === 0) return [];

      const { data, error } = await supabase
        .from('nebenkosten_zahlungen')
        .select('*')
        .in('zahlung_id', zahlungIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!zahlungen && zahlungen.length > 0,
  });

  // Kategorisierte Zahlungen
  const { assignedZahlungen, unassignedZahlungen } = useMemo(() => {
    if (!zahlungen) return { assignedZahlungen: [], unassignedZahlungen: [] };
    
    const assigned: typeof zahlungen = [];
    const unassigned: typeof zahlungen = [];

    zahlungen.forEach(zahlung => {
      const hasAssignment = nebenkostenZahlungen?.some(nz => nz.zahlung_id === zahlung.id);
      if (hasAssignment) {
        assigned.push(zahlung);
      } else {
        unassigned.push(zahlung);
      }
    });

    return { assignedZahlungen: assigned, unassignedZahlungen: unassigned };
  }, [zahlungen, nebenkostenZahlungen]);

  const totalNebenkosten = zahlungen?.reduce((sum, z) => sum + Math.abs(z.betrag || 0), 0) || 0;

  const handleDropOnEinheit = async (einheitId: string, zahlungId: string) => {
    try {
      // Check if already assigned
      const existing = nebenkostenZahlungen?.find(nz => nz.zahlung_id === zahlungId);
      if (existing) {
        // Update existing assignment
        const { error } = await supabase
          .from('nebenkosten_zahlungen')
          .update({
            einheit_id: einheitId,
            verteilung_typ: 'direkt',
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('nebenkosten_zahlungen')
          .insert({
            zahlung_id: zahlungId,
            einheit_id: einheitId,
            verteilung_typ: 'direkt',
          });

        if (error) throw error;
      }

      toast({
        title: "Zahlung zugeordnet",
        description: "Die Zahlung wurde der Einheit zugeordnet.",
      });

      queryClient.invalidateQueries({ queryKey: ['nebenkosten-zahlungen', immobilieId] });
    } catch (error: any) {
      console.error('Error assigning payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zahlung konnte nicht zugeordnet werden.",
        variant: "destructive",
      });
    }
  };

  const handleAutoDistribute = async (zahlungId: string) => {
    try {
      // Check if already assigned
      const existing = nebenkostenZahlungen?.find(nz => nz.zahlung_id === zahlungId);
      if (existing) {
        const { error } = await supabase
          .from('nebenkosten_zahlungen')
          .update({
            einheit_id: null,
            verteilung_typ: 'automatisch',
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('nebenkosten_zahlungen')
          .insert({
            zahlung_id: zahlungId,
            verteilung_typ: 'automatisch',
          });

        if (error) throw error;
      }

      toast({
        title: "Automatische Verteilung",
        description: "Die Zahlung wird automatisch nach Verteilerschlüssel verteilt.",
      });

      setAutoDistributeDialog({ open: false, zahlungId: null });
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-zahlungen', immobilieId] });
    } catch (error: any) {
      console.error('Error auto-distributing payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die automatische Verteilung ist fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (zahlungId: string) => {
    try {
      const { error } = await supabase
        .from('nebenkosten_zahlungen')
        .delete()
        .eq('zahlung_id', zahlungId);

      if (error) throw error;

      toast({
        title: "Zuordnung entfernt",
        description: "Die Zahlungszuordnung wurde aufgehoben.",
      });

      queryClient.invalidateQueries({ queryKey: ['nebenkosten-zahlungen', immobilieId] });
    } catch (error: any) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zuordnung konnte nicht entfernt werden.",
        variant: "destructive",
      });
    }
  };

  const getAssignedEinheitName = (zahlungId: string): string | undefined => {
    const assignment = nebenkostenZahlungen?.find(nz => nz.zahlung_id === zahlungId);
    if (!assignment?.einheit_id) return assignment ? 'Automatisch verteilt' : undefined;
    
    const einheit = einheiten?.find(e => e.id === assignment.einheit_id);
    if (!einheit) return undefined;
    
    if (einheit.zaehler) return `Einheit ${einheit.zaehler}`;
    const digitsFromId = (einheit.id as string).replace(/\D/g, "");
    const lastTwo = digitsFromId.slice(-2) || "00";
    return `Einheit ${lastTwo}`;
  };

  if (einheitenLoading || zahlungenLoading || nebenkostenArtenLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="zahlungen" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="zahlungen" className="gap-2">
            <Euro className="h-4 w-4" />
            Zahlungen zuordnen
          </TabsTrigger>
          <TabsTrigger value="kostenpositionen" className="gap-2">
            <Layers className="h-4 w-4" />
            Kostenpositionen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zahlungen">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Linke Spalte: Zahlungen */}
            <div className="lg:col-span-1 space-y-4">
              {/* Statistik */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Gesamte Nebenkosten</p>
                    <p className="text-3xl font-bold text-primary mt-1">
                      {totalNebenkosten.toFixed(2)} €
                    </p>
                    <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>{unassignedZahlungen.length} unzugeordnet</span>
                      <span>{assignedZahlungen.length} zugeordnet</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nebenkostenarten Manager */}
              <NebenkostenArtenManager
                immobilieId={immobilieId}
                nebenkostenarten={nebenkostenarten || []}
              />

              {/* Unzugeordnete Zahlungen */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Euro className="h-5 w-5" />
                    Zahlungen zuordnen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {unassignedZahlungen.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Alle Zahlungen sind zugeordnet!</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-2">
                      <div className="space-y-2">
                        {unassignedZahlungen.map((zahlung) => (
                          <NebenkostenPaymentCard
                            key={zahlung.id}
                            zahlung={zahlung}
                            isAssigned={false}
                            onDragStart={setDraggedZahlung}
                            onDragEnd={() => setDraggedZahlung(null)}
                            onAutoDistribute={(id) => setAutoDistributeDialog({ open: true, zahlungId: id })}
                            isDragging={draggedZahlung === zahlung.id}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Mittlere Spalte: Gebäude-Visualisierung */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Gebäudeübersicht
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <NebenkostenBuildingView
                    einheiten={einheiten || []}
                    nebenkostenZahlungen={nebenkostenZahlungen || []}
                    nebenkostenarten={nebenkostenarten || []}
                    onDrop={handleDropOnEinheit}
                    draggedZahlung={draggedZahlung}
                    setDraggedZahlung={setDraggedZahlung}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Rechte Spalte: Zugeordnete Zahlungen */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" />
                    Zugeordnete Zahlungen ({assignedZahlungen.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assignedZahlungen.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">Noch keine Zahlungen zugeordnet.</p>
                      <p className="text-xs mt-1">Ziehen Sie Zahlungen auf eine Einheit oder nutzen Sie die Auto-Verteilung.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-2">
                      <div className="space-y-2">
                        {assignedZahlungen.map((zahlung) => (
                          <div key={zahlung.id} className="relative group">
                            <NebenkostenPaymentCard
                              zahlung={zahlung}
                              isAssigned={true}
                              assignedTo={getAssignedEinheitName(zahlung.id)}
                              onDragStart={setDraggedZahlung}
                              onDragEnd={() => setDraggedZahlung(null)}
                              onAutoDistribute={() => {}}
                              isDragging={draggedZahlung === zahlung.id}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveAssignment(zahlung.id)}
                            >
                              <Undo2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kostenpositionen">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linke Spalte: Nebenkostenarten */}
            <div className="space-y-4">
              <NebenkostenArtenManager
                immobilieId={immobilieId}
                nebenkostenarten={nebenkostenarten || []}
              />
            </div>

            {/* Rechte Spalte: Kostenpositionen */}
            <div>
              <KostenpositionenManager
                immobilieId={immobilieId}
                zahlungen={zahlungen || []}
                nebenkostenarten={nebenkostenarten || []}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Auto-Distribute Confirmation Dialog */}
      <AlertDialog
        open={autoDistributeDialog.open}
        onOpenChange={(open) => setAutoDistributeDialog({ open, zahlungId: open ? autoDistributeDialog.zahlungId : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Automatische Verteilung</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Zahlung wird automatisch nach dem Verteilerschlüssel auf alle Einheiten verteilt.
              Sie können auch eine Zahlung direkt auf eine Einheit ziehen, um sie manuell zuzuordnen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => autoDistributeDialog.zahlungId && handleAutoDistribute(autoDistributeDialog.zahlungId)}>
              Automatisch verteilen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
