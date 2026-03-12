import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Building2, Euro, Check, Calendar, Loader2, 
  Search, Undo2, Sparkles, ChevronDown, ChevronUp, GripVertical, X
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Zahlung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  verwendungszweck: string | null;
  empfaengername: string | null;
  iban: string | null;
  kategorie: string | null;
  immobilie_id: string | null;
}

interface Immobilie {
  id: string;
  name: string;
  adresse: string;
}

interface ClassificationResult {
  zahlung_id: string;
  is_betriebskosten: boolean;
  confidence: "high" | "medium" | "low";
  category: string;
  suggested_immobilie_id: string | null;
  suggested_immobilie_name: string | null;
  reasoning: string;
  zahlung?: Zahlung;
}

export function NebenkostenZuordnungTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZahlung, setSelectedZahlung] = useState<string | null>(null);
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [draggingZahlungId, setDraggingZahlungId] = useState<string | null>(null);
  const [dragOverImmobilieId, setDragOverImmobilieId] = useState<string | null>(null);

  // Fetch alle Immobilien
  const { data: immobilien, isLoading: immobilienLoading } = useQuery({
    queryKey: ['immobilien-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('id, name, adresse')
        .order('name');
      
      if (error) throw error;
      return data as Immobilie[];
    }
  });

  // Fetch unzugeordnete Nichtmiete-Zahlungen (Nichtmiete + Nebenkosten ohne Immobilie)
  const { data: unzugeordneteZahlungen, isLoading: unzugeordneteLoading } = useQuery({
    queryKey: ['unzugeordnete-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .in('kategorie', ['Nichtmiete', 'Nebenkosten'])
        .is('immobilie_id', null)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data as Zahlung[];
    }
  });

  // Fetch bereits zugeordnete Zahlungen - alle für Gruppierung
  const { data: zugeordneteZahlungen, isLoading: zugeordneteLoading } = useQuery({
    queryKey: ['zugeordnete-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*, immobilie:immobilie_id(id, name, adresse)')
        .eq('kategorie', 'Nichtmiete')
        .not('immobilie_id', 'is', null)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // NEU: Lade gespeicherte Klassifizierungen direkt aus der DB (kein API-Call nötig!)
  const { data: cachedClassifications, isLoading: classificationsLoading } = useQuery({
    queryKey: ['nebenkosten-klassifizierungen-cached'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nebenkosten_klassifizierungen')
        .select(`
          zahlung_id,
          is_betriebskosten,
          confidence,
          category,
          suggested_immobilie_id,
          reasoning,
          bestaetigt,
          uebersprungen,
          immobilie:suggested_immobilie_id(id, name)
        `)
        .eq('is_betriebskosten', true)
        .eq('bestaetigt', false)
        .eq('uebersprungen', false);
      
      if (error) throw error;
      
      // Transformiere zu ClassificationResult Format
      return (data || []).map(c => ({
        zahlung_id: c.zahlung_id,
        is_betriebskosten: c.is_betriebskosten,
        confidence: c.confidence as "high" | "medium" | "low",
        category: c.category,
        suggested_immobilie_id: c.suggested_immobilie_id,
        suggested_immobilie_name: (c.immobilie as any)?.name || null,
        reasoning: c.reasoning || '',
      })) as ClassificationResult[];
    },
    staleTime: 30000, // 30 Sekunden Cache
  });

  // Klassifizierungen aus Cache oder API
  const classifications = cachedClassifications || [];

  // Gruppiere zugeordnete Zahlungen nach Immobilie
  const zahlungenByImmobilie = useMemo(() => {
    const grouped: Record<string, { immobilie: Immobilie; zahlungen: any[]; total: number }> = {};
    
    (zugeordneteZahlungen || []).forEach((z: any) => {
      const immoId = z.immobilie_id;
      if (!immoId) return;
      
      if (!grouped[immoId]) {
        grouped[immoId] = {
          immobilie: z.immobilie || { id: immoId, name: 'Unbekannt', adresse: '' },
          zahlungen: [],
          total: 0
        };
      }
      grouped[immoId].zahlungen.push(z);
      grouped[immoId].total += z.betrag;
    });
    
    return grouped;
  }, [zugeordneteZahlungen]);

  // KI Klassifizierung aufrufen - nur für NEUE Zahlungen die noch nicht analysiert wurden
  const runClassification = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-nebenkosten', {
        body: { force: false } // Nur neue analysieren
      });
      
      if (error) throw error;
      
      // Cache invalidieren um neue Ergebnisse zu laden
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-cached'] });
      
      const newAnalyzed = data.ai_classified || 0;
      
      if (newAnalyzed > 0) {
        toast.success(`${newAnalyzed} neue Zahlungen analysiert`);
      } else {
        toast.info('Keine neuen Zahlungen zu analysieren', {
          description: 'Alle Zahlungen wurden bereits klassifiziert'
        });
      }
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Fehler bei der Klassifizierung');
    } finally {
      setIsClassifying(false);
    }
  };

  // Einfache Zuordnung (eine Immobilie)
  const assignMutation = useMutation({
    mutationFn: async ({ zahlungId, immobilieId }: { zahlungId: string; immobilieId: string }) => {
      // 1. Zahlung zuordnen
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: immobilieId })
        .eq('id', zahlungId);
      if (error) throw error;
      
      // 2. Klassifizierung als bestätigt markieren
      await supabase
        .from('nebenkosten_klassifizierungen')
        .update({ bestaetigt: true, bestaetigt_am: new Date().toISOString() })
        .eq('zahlung_id', zahlungId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unzugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-cached'] });
      setSelectedZahlung(null);
      setSelectedImmobilie(null);
      toast.success("Zahlung zugeordnet");
    },
    onError: () => {
      toast.error("Fehler beim Zuordnen");
    }
  });

  // Zuordnung aufheben
  const unassignMutation = useMutation({
    mutationFn: async (zahlungId: string) => {
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: null })
        .eq('id', zahlungId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unzugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
      toast.success("Zuordnung aufgehoben");
    },
    onError: () => {
      toast.error("Fehler beim Aufheben");
    }
  });

  // Als Nichtmiete rekategorisieren (aus Nebenkosten entfernen)
  const recategorizeNichtmieteMutation = useMutation({
    mutationFn: async (zahlungId: string) => {
      // Kategorie zurück auf Nichtmiete setzen und immobilie_id entfernen
      const { error } = await supabase
        .from('zahlungen')
        .update({ kategorie: 'Nichtmiete', immobilie_id: null })
        .eq('id', zahlungId);
      if (error) throw error;

      // Klassifizierung als übersprungen markieren
      await supabase
        .from('nebenkosten_klassifizierungen')
        .update({ uebersprungen: true })
        .eq('zahlung_id', zahlungId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unzugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-cached'] });
      toast.success("Zahlung als Nichtmiete kategorisiert");
    },
    onError: () => {
      toast.error("Fehler beim Rekategorisieren");
    }
  });

  const [dragOverNichtmiete, setDragOverNichtmiete] = useState(false);

  const handleDropNichtmiete = (e: React.DragEvent) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId) {
      recategorizeNichtmieteMutation.mutate(zahlungId);
    }
    setDragOverNichtmiete(false);
    setDraggingZahlungId(null);
  };

  // Gefilterte Zahlungen — immer ALLE anzeigen, KI nur als Badge
  const displayedPayments = useMemo(() => {
    if (!unzugeordneteZahlungen) return [];
    
    let payments = [...unzugeordneteZahlungen];
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      payments = payments.filter(z => 
        z.verwendungszweck?.toLowerCase().includes(search) ||
        z.empfaengername?.toLowerCase().includes(search) ||
        z.iban?.toLowerCase().includes(search)
      );
    }
    
    // Sortierung: buchungsdatum DESC (bereits aus DB, aber sicherstellen)
    payments.sort((a, b) => 
      new Date(b.buchungsdatum).getTime() - new Date(a.buchungsdatum).getTime()
    );
    
    return payments;
  }, [unzugeordneteZahlungen, searchTerm]);

  const getClassification = (zahlungId: string) => 
    classifications.find(c => c.zahlung_id === zahlungId);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Math.abs(betrag));
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, zahlungId: string) => {
    e.dataTransfer.setData('zahlungId', zahlungId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingZahlungId(zahlungId);
  };

  const handleDragEnd = () => {
    setDraggingZahlungId(null);
    setDragOverImmobilieId(null);
  };

  const handleDragOver = (e: React.DragEvent, immobilieId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverImmobilieId(immobilieId);
  };

  const handleDragLeave = () => {
    setDragOverImmobilieId(null);
  };

  const handleDrop = (e: React.DragEvent, immobilieId: string) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId && immobilieId) {
      assignMutation.mutate({ zahlungId, immobilieId });
    }
    setDragOverImmobilieId(null);
    setDraggingZahlungId(null);
  };

  const handleDropUnassign = (e: React.DragEvent) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId) {
      unassignMutation.mutate(zahlungId);
    }
    setDragOverImmobilieId(null);
    setDraggingZahlungId(null);
  };

  const isLoading = immobilienLoading || unzugeordneteLoading || zugeordneteLoading || classificationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Nebenkosten-Zuordnung
          </h3>
          <p className="text-sm text-muted-foreground">
            Ziehe Zahlungen auf Immobilien oder nutze KI-Vorschläge
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            {unzugeordneteZahlungen?.length || 0} unzugeordnet
          </Badge>
          {classifications.length > 0 && (
            <Badge variant="default" className="gap-1 bg-primary">
              <Sparkles className="h-3 w-3" />
              {classifications.length} erkannt
            </Badge>
          )}
        </div>
      </div>

      {/* Ladeindikator während automatischer Analyse */}
      {isClassifying && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analysiere Zahlungen...</span>
        </div>
      )}

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Suche nach Verwendungszweck, Empfänger oder IBAN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Spalte: Zahlungen zur Zuordnung */}
        <Card 
          className={cn(
            "transition-all",
            draggingZahlungId && !Object.keys(zahlungenByImmobilie).some(id => 
              zahlungenByImmobilie[id].zahlungen.some(z => z.id === draggingZahlungId)
            ) ? "" : draggingZahlungId ? "opacity-50" : ""
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverImmobilieId('unassigned');
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDropUnassign}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Nichtmiete / Nebenkosten ({displayedPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayedPayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Keine unzugeordneten Zahlungen</p>
              </div>
            ) : (
              <ScrollArea className="h-[900px]">
                <div className="space-y-3 pr-2">
                  {displayedPayments.map(zahlung => {
                    const isSelected = selectedZahlung === zahlung.id;
                    const classification = getClassification(zahlung.id);
                    const isExpanded = expandedPayments.has(zahlung.id);
                    const suggestedImmobilie = classification?.suggested_immobilie_id;
                    const suggestedName = classification?.suggested_immobilie_name;
                    const isDragging = draggingZahlungId === zahlung.id;
                    
                    return (
                      <div 
                        key={zahlung.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, zahlung.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "p-4 border rounded-lg transition-all cursor-grab active:cursor-grabbing",
                          isSelected 
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                            : 'hover:bg-accent/50',
                          isDragging && 'opacity-50 scale-95'
                        )}
                      >
                        {/* Kopfzeile mit Drag Handle */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
                            </span>
                            {classification && (
                              <Badge className={`text-xs ${getConfidenceColor(classification.confidence)}`}>
                                {classification.category}
                              </Badge>
                            )}
                          </div>
                          <span className="font-bold text-lg text-destructive">
                            -{formatBetrag(zahlung.betrag)}
                          </span>
                        </div>

                        {/* Empfänger */}
                        {zahlung.empfaengername && (
                          <div className="mb-2">
                            <span className="text-xs text-muted-foreground">An: </span>
                            <span className="font-medium">{zahlung.empfaengername}</span>
                          </div>
                        )}

                        {/* Verwendungszweck - Kollabierbar */}
                        <Collapsible 
                          open={isExpanded} 
                          onOpenChange={() => setExpandedPayments(prev => {
                            const next = new Set(prev);
                            if (next.has(zahlung.id)) {
                              next.delete(zahlung.id);
                            } else {
                              next.add(zahlung.id);
                            }
                            return next;
                          })}
                        >
                          <div className="bg-muted/50 rounded p-3 mb-3">
                            <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                              <p className="text-xs text-muted-foreground">Verwendungszweck:</p>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <p className="text-sm whitespace-pre-wrap break-words mt-2">
                                {zahlung.verwendungszweck || '(kein Verwendungszweck)'}
                              </p>
                            </CollapsibleContent>
                            {!isExpanded && (
                              <p className="text-sm truncate mt-1">
                                {zahlung.verwendungszweck || '(kein Verwendungszweck)'}
                              </p>
                            )}
                          </div>
                        </Collapsible>

                        {/* Aktionsleiste */}
                        <div className="flex items-center justify-between gap-2">
                          {/* KI-Vorschlag: Direkt bestätigen wenn vorhanden */}
                          {suggestedImmobilie && (
                            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">KI-Vorschlag:</p>
                                    <p className="font-medium truncate">{suggestedName}</p>
                                  </div>
                                </div>
                                <Button 
                                  size="sm"
                                  className="flex-shrink-0 gap-1"
                                  disabled={assignMutation.isPending}
                                  onClick={() => assignMutation.mutate({ 
                                    zahlungId: zahlung.id, 
                                    immobilieId: suggestedImmobilie 
                                  })}
                                >
                                  <Check className="h-4 w-4" />
                                  Bestätigen
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Nichtmiete Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-shrink-0 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            disabled={recategorizeNichtmieteMutation.isPending}
                            onClick={() => recategorizeNichtmieteMutation.mutate(zahlung.id)}
                          >
                            <X className="h-4 w-4" />
                            Nichtmiete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Rechte Spalte: Immobilien als Karten-Grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Immobilien
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {immobilien?.map(immo => {
              const grouped = zahlungenByImmobilie[immo.id];
              const zahlungen = grouped?.zahlungen || [];
              const total = grouped?.total || 0;
              const isDropTarget = dragOverImmobilieId === immo.id;
              const hasPayments = zahlungen.length > 0;
              
              return (
                <Card
                  key={immo.id}
                  className={cn(
                    "transition-all",
                    isDropTarget && "ring-2 ring-primary bg-primary/5 scale-[1.02]",
                    draggingZahlungId && !isDropTarget && "opacity-70"
                  )}
                  onDragOver={(e) => handleDragOver(e, immo.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, immo.id)}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{immo.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{immo.adresse}</p>
                        </div>
                      </div>
                      {hasPayments && (
                        <div className="text-right flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {zahlungen.length}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  {/* Drop Zone Indikator */}
                  {isDropTarget && (
                    <div className="mx-3 mb-3 border-2 border-dashed border-primary rounded-lg p-3 text-center text-sm text-primary">
                      Hier ablegen
                    </div>
                  )}
                  
                  {/* Zugeordnete Zahlungen kompakt */}
                  {hasPayments && !isDropTarget && (
                    <CardContent className="pt-0 px-3 pb-3">
                      <div className="space-y-1.5">
                        {zahlungen.slice(0, 3).map((z: any) => (
                          <div
                            key={z.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, z.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "p-1.5 rounded border bg-card text-xs flex items-center justify-between gap-1 cursor-grab active:cursor-grabbing group",
                              draggingZahlungId === z.id && "opacity-50"
                            )}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{z.empfaengername || 'Unbekannt'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-destructive whitespace-nowrap">
                                -{formatBetrag(z.betrag)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                                onClick={() => unassignMutation.mutate(z.id)}
                              >
                                <Undo2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {zahlungen.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{zahlungen.length - 3} weitere
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                  
                  {/* Leere Drop Zone */}
                  {!hasPayments && !isDropTarget && (
                    <CardContent className="pt-0 px-3 pb-3">
                      <div className="border border-dashed rounded-lg p-2 text-center text-xs text-muted-foreground">
                        Zahlungen hierher ziehen
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
