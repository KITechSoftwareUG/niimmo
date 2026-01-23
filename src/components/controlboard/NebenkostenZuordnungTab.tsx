import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Building2, Euro, Check, Calendar, Loader2, 
  Search, ArrowRight, X, Undo2
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

export function NebenkostenZuordnungTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZahlung, setSelectedZahlung] = useState<string | null>(null);

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

  // Zuordnen
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

  // Gefilterte unzugeordnete Zahlungen
  const filteredZahlungen = useMemo(() => {
    if (!unzugeordneteZahlungen) return [];
    if (!searchTerm.trim()) return unzugeordneteZahlungen;
    
    const search = searchTerm.toLowerCase();
    return unzugeordneteZahlungen.filter(z => 
      z.verwendungszweck?.toLowerCase().includes(search) ||
      z.empfaengername?.toLowerCase().includes(search) ||
      z.iban?.toLowerCase().includes(search)
    );
  }, [unzugeordneteZahlungen, searchTerm]);

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
            Nichtmiete-Zahlungen den Immobilien zuordnen
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Euro className="h-3 w-3" />
            {unzugeordneteZahlungen?.length || 0} unzugeordnet
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
            {zugeordneteZahlungen?.length || 0} zugeordnet
          </Badge>
        </div>
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
        {/* Linke Spalte: Unzugeordnete Zahlungen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Unzugeordnete Zahlungen ({filteredZahlungen.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredZahlungen.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Keine unzugeordneten Zahlungen</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredZahlungen.map(zahlung => {
                    const isSelected = selectedZahlung === zahlung.id;
                    
                    return (
                      <div 
                        key={zahlung.id}
                        className={`p-4 border rounded-lg transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => setSelectedZahlung(isSelected ? null : zahlung.id)}
                      >
                        {/* Kopfzeile */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
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

                        {/* Verwendungszweck - VOLLSTÄNDIG */}
                        <div className="bg-muted/50 rounded p-3 mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Verwendungszweck:</p>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {zahlung.verwendungszweck || '(kein Verwendungszweck)'}
                          </p>
                        </div>

                        {/* IBAN */}
                        {zahlung.iban && (
                          <div className="text-xs text-muted-foreground font-mono">
                            IBAN: {zahlung.iban}
                          </div>
                        )}

                        {/* Zuordnungs-Bereich wenn ausgewählt */}
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <ArrowRight className="h-4 w-4" />
                              Immobilie zuordnen:
                            </p>
                            <Select
                              onValueChange={(immobilieId) => {
                                assignMutation.mutate({ zahlungId: zahlung.id, immobilieId });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Immobilie auswählen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {immobilien?.map(immo => (
                                  <SelectItem key={immo.id} value={immo.id}>
                                    <div>
                                      <div className="font-medium">{immo.name}</div>
                                      <div className="text-xs text-muted-foreground">{immo.adresse}</div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedZahlung(null);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Abbrechen
                            </Button>
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
