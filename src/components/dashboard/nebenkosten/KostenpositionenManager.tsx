import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Calendar, 
  Euro, 
  Layers, 
  ArrowRight, 
  Trash2, 
  Edit2,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { KostenpositionModal } from "./KostenpositionModal";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KostenpositionenManagerProps {
  immobilieId: string;
  zahlungen: any[];
  nebenkostenarten: any[];
}

interface Kostenposition {
  id: string;
  zahlung_id: string | null;
  nebenkostenart_id: string | null;
  immobilie_id: string;
  gesamtbetrag: number;
  zeitraum_von: string;
  zeitraum_bis: string;
  bezeichnung: string | null;
  quelle: string;
  ist_umlagefaehig: boolean;
  erstellt_am: string;
}

export function KostenpositionenManager({ 
  immobilieId, 
  zahlungen, 
  nebenkostenarten 
}: KostenpositionenManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Kostenposition | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAllZahlungen, setShowAllZahlungen] = useState(false);

  // Fetch kostenpositionen
  const { data: kostenpositionen, isLoading } = useQuery({
    queryKey: ['kostenpositionen', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kostenpositionen')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('zeitraum_von', { ascending: false });

      if (error) throw error;
      return data as Kostenposition[];
    },
  });

  // Zahlungen ohne Kostenposition
  const zahlungenOhnePosition = zahlungen.filter(z => {
    const hasPosition = kostenpositionen?.some(kp => kp.zahlung_id === z.id);
    return !hasPosition && z.kategorie === 'Nichtmiete';
  });

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('kostenpositionen')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: "Kostenposition gelöscht",
        description: "Die Kostenposition wurde erfolgreich entfernt.",
      });

      setDeleteDialogOpen(false);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['kostenpositionen', immobilieId] });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Die Kostenposition konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleCreateFromZahlung = (zahlung: any) => {
    // Öffne Modal mit vorausgefüllten Daten aus der Zahlung
    setEditingPosition({
      id: '',
      zahlung_id: zahlung.id,
      nebenkostenart_id: null,
      immobilie_id: immobilieId,
      gesamtbetrag: Math.abs(zahlung.betrag),
      zeitraum_von: zahlung.buchungsdatum,
      zeitraum_bis: zahlung.buchungsdatum,
      bezeichnung: zahlung.verwendungszweck || zahlung.empfaengername || 'Neue Kostenposition',
      quelle: 'zahlung',
      ist_umlagefaehig: true,
      erstellt_am: new Date().toISOString(),
    });
    setModalOpen(true);
  };

  const getNebenkostenartName = (id: string | null) => {
    if (!id) return null;
    return nebenkostenarten.find(n => n.id === id)?.name;
  };

  const getZahlungInfo = (zahlungId: string | null) => {
    if (!zahlungId) return null;
    return zahlungen.find(z => z.id === zahlungId);
  };

  const totalKosten = kostenpositionen?.reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
  const umlagefaehigeKosten = kostenpositionen?.filter(kp => kp.ist_umlagefaehig).reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Kostenpositionen
            </div>
            <Button 
              size="sm" 
              onClick={() => {
                setEditingPosition(null);
                setModalOpen(true);
              }}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Manuell erstellen
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistiken */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-xs text-muted-foreground">Gesamtkosten</p>
              <p className="text-lg font-bold text-primary">{totalKosten.toFixed(2)} €</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Umlagefähig</p>
              <p className="text-lg font-bold text-green-600">{umlagefaehigeKosten.toFixed(2)} €</p>
            </div>
          </div>

          {/* Zahlungen die noch in Kostenpositionen umgewandelt werden müssen */}
          {zahlungenOhnePosition.length > 0 && (
            <div className="border-2 border-dashed border-amber-300 bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                  {zahlungenOhnePosition.length} Zahlung(en) ohne Kostenposition
                </p>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                Diese Zahlungen sollten in Kostenpositionen umgewandelt werden, um sie korrekt in der Abrechnung zu berücksichtigen.
              </p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(showAllZahlungen ? zahlungenOhnePosition : zahlungenOhnePosition.slice(0, 5)).map((zahlung) => (
                  <div
                    key={zahlung.id}
                    className="flex items-center justify-between p-2 bg-white rounded border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {zahlung.empfaengername || 'Unbekannt'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })} • {Math.abs(zahlung.betrag).toFixed(2)} €
                      </p>
                      {zahlung.verwendungszweck && (
                        <p className="text-xs text-muted-foreground truncate" title={zahlung.verwendungszweck}>
                          {zahlung.verwendungszweck}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateFromZahlung(zahlung)}
                      className="gap-1 ml-2"
                    >
                      <ArrowRight className="h-3 w-3" />
                      Umwandeln
                    </Button>
                  </div>
                ))}
                {zahlungenOhnePosition.length > 5 && (
                  <button
                    type="button"
                    className="w-full text-xs text-amber-700 hover:text-amber-900 hover:underline text-center py-1"
                    onClick={() => setShowAllZahlungen(!showAllZahlungen)}
                  >
                    {showAllZahlungen
                      ? 'Weniger anzeigen'
                      : `+ ${zahlungenOhnePosition.length - 5} weitere anzeigen`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Liste der Kostenpositionen */}
          {kostenpositionen && kostenpositionen.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {kostenpositionen.map((position) => {
                  const nebenkostenartName = getNebenkostenartName(position.nebenkostenart_id);
                  const zahlung = getZahlungInfo(position.zahlung_id);
                  
                  return (
                    <div
                      key={position.id}
                      className="p-3 border rounded-lg bg-white hover:bg-accent/30 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">
                              {position.bezeichnung || 'Ohne Bezeichnung'}
                            </p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {position.ist_umlagefaehig ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {position.ist_umlagefaehig 
                                    ? "Umlagefähig auf Mieter" 
                                    : "Nicht umlagefähig"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(position.zeitraum_von), 'dd.MM.yy', { locale: de })}
                              {position.zeitraum_von !== position.zeitraum_bis && (
                                <>
                                  <ArrowRight className="h-3 w-3" />
                                  {format(new Date(position.zeitraum_bis), 'dd.MM.yy', { locale: de })}
                                </>
                              )}
                            </span>
                            
                            {nebenkostenartName && (
                              <Badge variant="outline" className="text-xs">
                                {nebenkostenartName}
                              </Badge>
                            )}
                            
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                            >
                              {position.quelle === 'zahlung' ? 'Aus Zahlung' : 
                               position.quelle === 'manuell' ? 'Manuell' : 
                               position.quelle}
                            </Badge>
                          </div>
                          
                          {zahlung && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              Zahlung: {zahlung.empfaengername}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-primary whitespace-nowrap">
                            {position.gesamtbetrag.toFixed(2)} €
                          </p>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingPosition(position);
                                setModalOpen(true);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeleteId(position.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Noch keine Kostenpositionen erstellt.</p>
              <p className="text-xs mt-1">
                Erstellen Sie Kostenpositionen aus Zahlungen oder manuell.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal für Kostenposition */}
      <KostenpositionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        immobilieId={immobilieId}
        nebenkostenarten={nebenkostenarten}
        zahlungen={zahlungen}
        editingPosition={editingPosition}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['kostenpositionen', immobilieId] });
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kostenposition löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Kostenposition wirklich löschen? Die zugehörigen Kostenanteile werden ebenfalls entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
