import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Building2, Euro, Check, Calendar, Loader2, 
  Search, X, Undo2, Sparkles, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface MultiAssignment {
  immobilieId: string;
  betrag: number;
}

export function NebenkostenZuordnungTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZahlung, setSelectedZahlung] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [multiAssignments, setMultiAssignments] = useState<MultiAssignment[]>([]);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());

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

  // Fetch unzugeordnete Nichtmiete-Zahlungen
  const { data: unzugeordneteZahlungen, isLoading: unzugeordneteLoading } = useQuery({
    queryKey: ['unzugeordnete-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('kategorie', 'Nichtmiete')
        .is('immobilie_id', null)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data as Zahlung[];
    }
  });

  // Fetch bereits zugeordnete Zahlungen
  const { data: zugeordneteZahlungen, isLoading: zugeordneteLoading } = useQuery({
    queryKey: ['zugeordnete-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*, immobilie:immobilie_id(id, name, adresse)')
        .eq('kategorie', 'Nichtmiete')
        .not('immobilie_id', 'is', null)
        .order('buchungsdatum', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  // KI Klassifizierung aufrufen
  const runClassification = async (force = false) => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-nebenkosten', {
        body: { force }
      });
      
      if (error) throw error;
      
      // Nur Betriebskosten anzeigen
      const betriebskostenResults = (data.classifications || []).filter(
        (c: ClassificationResult) => c.is_betriebskosten
      );
      
      setClassifications(betriebskostenResults);
      
      const cacheInfo = data.from_cache ? ' (aus Cache)' : '';
      toast.success(
        `${betriebskostenResults.length} potenzielle Nebenkosten gefunden${cacheInfo}`,
        {
          description: `${data.auto_classified || 0} automatisch, ${data.ai_classified || 0} KI, ${data.excluded_count || 0} ausgeschlossen`
        }
      );
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
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: immobilieId })
        .eq('id', zahlungId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unzugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
      setSelectedZahlung(null);
      setClassifications(prev => prev.filter(c => c.zahlung_id !== selectedZahlung));
      toast.success("Zahlung zugeordnet");
    },
    onError: () => {
      toast.error("Fehler beim Zuordnen");
    }
  });

  // Multi-Zuordnung: Zahlung aufteilen auf mehrere Immobilien
  const multiAssignMutation = useMutation({
    mutationFn: async ({ zahlungId, assignments, originalBetrag }: { 
      zahlungId: string; 
      assignments: MultiAssignment[];
      originalBetrag: number;
    }) => {
      // Validiere Gesamtbetrag
      const totalAssigned = assignments.reduce((sum, a) => sum + a.betrag, 0);
      if (Math.abs(totalAssigned - originalBetrag) > 0.01) {
        throw new Error(`Summe (${totalAssigned.toFixed(2)}€) entspricht nicht dem Originalbetrag (${originalBetrag.toFixed(2)}€)`);
      }

      // Erste Zuordnung: Originalzahlung updaten
      const { error: updateError } = await supabase
        .from('zahlungen')
        .update({ 
          immobilie_id: assignments[0].immobilieId,
          betrag: assignments[0].betrag
        })
        .eq('id', zahlungId);
      
      if (updateError) throw updateError;

      // Weitere Zuordnungen: Neue Zahlungen erstellen
      if (assignments.length > 1) {
        const originalZahlung = unzugeordneteZahlungen?.find(z => z.id === zahlungId);
        if (!originalZahlung) throw new Error('Originalzahlung nicht gefunden');

        for (let i = 1; i < assignments.length; i++) {
          const { error: insertError } = await supabase
            .from('zahlungen')
            .insert({
              betrag: assignments[i].betrag,
              buchungsdatum: originalZahlung.buchungsdatum,
              verwendungszweck: originalZahlung.verwendungszweck,
              empfaengername: originalZahlung.empfaengername,
              iban: originalZahlung.iban,
              kategorie: 'Nichtmiete',
              immobilie_id: assignments[i].immobilieId
            });
          
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unzugeordnete-nebenkosten'] });
      queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
      setSelectedZahlung(null);
      setMultiAssignments([]);
      setClassifications(prev => prev.filter(c => c.zahlung_id !== selectedZahlung));
      toast.success("Zahlung aufgeteilt und zugeordnet");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Fehler beim Aufteilen");
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

  // Multi-Assignment Helpers
  const toggleImmobilie = (immobilieId: string, zahlungBetrag: number) => {
    setMultiAssignments(prev => {
      const exists = prev.find(a => a.immobilieId === immobilieId);
      if (exists) {
        return prev.filter(a => a.immobilieId !== immobilieId);
      } else {
        // Wenn noch keine Zuordnung, nutze den vollen Betrag, sonst Restbetrag
        const usedAmount = prev.reduce((sum, a) => sum + a.betrag, 0);
        const remainingAmount = Math.max(0, zahlungBetrag - usedAmount);
        return [...prev, { immobilieId, betrag: remainingAmount }];
      }
    });
  };

  const updateAssignmentBetrag = (immobilieId: string, betrag: number) => {
    setMultiAssignments(prev => 
      prev.map(a => a.immobilieId === immobilieId ? { ...a, betrag } : a)
    );
  };

  // Gefilterte und klassifizierte Zahlungen
  const displayedPayments = useMemo(() => {
    // Wenn KI-Klassifizierung vorhanden, nur diese anzeigen
    if (classifications.length > 0) {
      const classifiedIds = new Set(classifications.map(c => c.zahlung_id));
      let payments = (unzugeordneteZahlungen || []).filter(z => classifiedIds.has(z.id));
      
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        payments = payments.filter(z => 
          z.verwendungszweck?.toLowerCase().includes(search) ||
          z.empfaengername?.toLowerCase().includes(search) ||
          z.iban?.toLowerCase().includes(search)
        );
      }
      
      return payments;
    }
    
    // Ohne Klassifizierung: alle unzugeordneten
    if (!unzugeordneteZahlungen) return [];
    if (!searchTerm.trim()) return unzugeordneteZahlungen;
    
    const search = searchTerm.toLowerCase();
    return unzugeordneteZahlungen.filter(z => 
      z.verwendungszweck?.toLowerCase().includes(search) ||
      z.empfaengername?.toLowerCase().includes(search) ||
      z.iban?.toLowerCase().includes(search)
    );
  }, [unzugeordneteZahlungen, searchTerm, classifications]);

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

  const isLoading = immobilienLoading || unzugeordneteLoading || zugeordneteLoading;

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
            KI-gestützte Erkennung und manuelle Zuordnung zu Immobilien
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Euro className="h-3 w-3" />
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

      {/* KI-Analyse Button */}
      <div className="flex gap-3">
        <Button 
          onClick={() => runClassification(false)}
          disabled={isClassifying}
          className="gap-2"
        >
          {isClassifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Nebenkosten erkennen
        </Button>
        {classifications.length > 0 && (
          <Button 
            variant="outline"
            onClick={() => runClassification(true)}
            disabled={isClassifying}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Neu analysieren
          </Button>
        )}
      </div>

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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5" />
              {classifications.length > 0 ? 'Erkannte Nebenkosten' : 'Alle Nichtmiete-Zahlungen'} ({displayedPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayedPayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {classifications.length > 0 ? (
                  <>
                    <Check className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Alle erkannten Nebenkosten zugeordnet</p>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Klicke "Nebenkosten erkennen" um zu starten</p>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {displayedPayments.map(zahlung => {
                    const isSelected = selectedZahlung === zahlung.id;
                    const classification = getClassification(zahlung.id);
                    const isExpanded = expandedPayments.has(zahlung.id);
                    
                    return (
                      <div 
                        key={zahlung.id}
                        className={`p-4 border rounded-lg transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        {/* Kopfzeile */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
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

                        {/* IBAN */}
                        {zahlung.iban && (
                          <div className="text-xs text-muted-foreground font-mono mb-3">
                            IBAN: {zahlung.iban}
                          </div>
                        )}

                        {/* KI Begründung */}
                        {classification?.reasoning && (
                          <p className="text-xs text-muted-foreground italic mb-3">
                            💡 {classification.reasoning}
                          </p>
                        )}

                        {/* Zuordnungs-Button */}
                        {!isSelected ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => {
                              setSelectedZahlung(zahlung.id);
                              setMultiAssignments([]);
                            }}
                          >
                            Immobilie(n) zuordnen
                          </Button>
                        ) : (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <p className="text-sm font-medium">Immobilien auswählen:</p>
                            
                            {/* Immobilien-Liste mit Checkboxen */}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {immobilien?.map(immo => {
                                const assignment = multiAssignments.find(a => a.immobilieId === immo.id);
                                const isChecked = !!assignment;
                                
                                return (
                                  <div 
                                    key={immo.id}
                                    className={`p-3 border rounded-lg transition-colors ${
                                      isChecked ? 'border-primary bg-primary/5' : 'hover:bg-accent/30'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleImmobilie(immo.id, zahlung.betrag)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{immo.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{immo.adresse}</p>
                                      </div>
                                    </div>
                                    
                                    {/* Betrag-Eingabe wenn ausgewählt */}
                                    {isChecked && (
                                      <div className="mt-2 ml-6">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground">Betrag:</span>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={assignment?.betrag || 0}
                                            onChange={(e) => updateAssignmentBetrag(immo.id, parseFloat(e.target.value) || 0)}
                                            className="h-8 w-32"
                                          />
                                          <span className="text-xs text-muted-foreground">€</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Summen-Anzeige */}
                            {multiAssignments.length > 0 && (
                              <div className="bg-muted rounded-lg p-3">
                                <div className="flex justify-between text-sm">
                                  <span>Originalbetrag:</span>
                                  <span className="font-medium">{formatBetrag(zahlung.betrag)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Zugeordnet:</span>
                                  <span className={`font-medium ${
                                    Math.abs(multiAssignments.reduce((s, a) => s + a.betrag, 0) - zahlung.betrag) < 0.01
                                      ? 'text-green-600'
                                      : 'text-destructive'
                                  }`}>
                                    {formatBetrag(multiAssignments.reduce((s, a) => s + a.betrag, 0))}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Aktions-Buttons */}
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => {
                                  setSelectedZahlung(null);
                                  setMultiAssignments([]);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Abbrechen
                              </Button>
                              
                              {multiAssignments.length === 1 ? (
                                <Button 
                                  size="sm" 
                                  className="flex-1"
                                  disabled={assignMutation.isPending}
                                  onClick={() => {
                                    assignMutation.mutate({ 
                                      zahlungId: zahlung.id, 
                                      immobilieId: multiAssignments[0].immobilieId 
                                    });
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Zuordnen
                                </Button>
                              ) : multiAssignments.length > 1 ? (
                                <Button 
                                  size="sm" 
                                  className="flex-1"
                                  disabled={
                                    multiAssignMutation.isPending ||
                                    Math.abs(multiAssignments.reduce((s, a) => s + a.betrag, 0) - zahlung.betrag) >= 0.01
                                  }
                                  onClick={() => {
                                    multiAssignMutation.mutate({ 
                                      zahlungId: zahlung.id, 
                                      assignments: multiAssignments,
                                      originalBetrag: zahlung.betrag
                                    });
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Aufteilen ({multiAssignments.length} Immobilien)
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Rechte Spalte: Bereits zugeordnete Zahlungen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Check className="h-5 w-5" />
              Bereits zugeordnet (letzte 50)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!zugeordneteZahlungen || zugeordneteZahlungen.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Noch keine Zahlungen zugeordnet</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {zugeordneteZahlungen.map(zahlung => (
                    <div 
                      key={zahlung.id}
                      className="p-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-destructive">
                            -{formatBetrag(zahlung.betrag)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => unassignMutation.mutate(zahlung.id)}
                          >
                            <Undo2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Empfänger */}
                      {zahlung.empfaengername && (
                        <p className="text-sm font-medium truncate mb-1">
                          {zahlung.empfaengername}
                        </p>
                      )}

                      {/* Verwendungszweck gekürzt */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {zahlung.verwendungszweck || '(kein Verwendungszweck)'}
                      </p>

                      {/* Zugeordnete Immobilie */}
                      <Badge variant="secondary" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {(zahlung.immobilie as any)?.name || 'Unbekannt'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
