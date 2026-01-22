import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Building2, Euro, Zap, Droplets, Flame, Check, 
  Calendar, Loader2, AlertTriangle, CheckCircle2, 
  Sparkles, RefreshCw, ThumbsUp, ThumbsDown, HelpCircle,
  ChevronRight, Shield, Trash2, X, Database
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  zahlung: Zahlung;
}

const getCategoryIcon = (category: string) => {
  const lower = category.toLowerCase();
  if (lower.includes("strom")) return { icon: Zap, color: "text-yellow-600", bg: "bg-yellow-100" };
  if (lower.includes("wasser") || lower.includes("abwasser")) return { icon: Droplets, color: "text-blue-600", bg: "bg-blue-100" };
  if (lower.includes("gas") || lower.includes("heiz")) return { icon: Flame, color: "text-orange-600", bg: "bg-orange-100" };
  if (lower.includes("versicherung")) return { icon: Shield, color: "text-green-600", bg: "bg-green-100" };
  return { icon: Euro, color: "text-muted-foreground", bg: "bg-muted" };
};

const getConfidenceBadge = (confidence: "high" | "medium" | "low") => {
  switch (confidence) {
    case "high":
      return { label: "Sicher", variant: "default" as const, className: "bg-green-100 text-green-800 hover:bg-green-100" };
    case "medium":
      return { label: "Wahrscheinlich", variant: "secondary" as const, className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" };
    case "low":
      return { label: "Unsicher", variant: "outline" as const, className: "bg-orange-100 text-orange-800 hover:bg-orange-100" };
  }
};

export function NebenkostenZuordnungTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"high" | "medium" | "low">("high");
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [immobilien, setImmobilien] = useState<Immobilie[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [selectedImmobilieOverrides, setSelectedImmobilieOverrides] = useState<Record<string, string>>({});
  const [isFromCache, setIsFromCache] = useState(false);

  // Fetch bereits zugeordnete Zahlungen
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

  // Auto-load classifications on mount
  useEffect(() => {
    loadClassifications(false);
  }, []);

  // Load classifications (from cache or fresh)
  const loadClassifications = async (force: boolean = false) => {
    setIsClassifying(true);
    
    try {
      const response = await supabase.functions.invoke('classify-nebenkosten', {
        body: { force }
      });

      if (response.error) throw response.error;
      
      const data = response.data;
      
      if (data.error) {
        if (data.error.includes("Rate limits")) {
          toast.error("Rate Limit erreicht - bitte versuche es später erneut");
        } else if (data.error.includes("Payment required")) {
          toast.error("Credits aufgebraucht - bitte Guthaben aufladen");
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setClassifications(data.classifications || []);
      setImmobilien(data.immobilien || []);
      setIsFromCache(data.from_cache || false);
      
      const cachedCount = data.cached_count || 0;
      const newCount = data.new_count || 0;
      const autoCount = data.auto_classified || 0;
      const aiCount = data.ai_classified || 0;
      const excludedCount = data.excluded_count || 0;
      
      if (data.from_cache && cachedCount > 0) {
        toast.success(`${cachedCount} Klassifizierungen aus Cache geladen`);
      } else if (newCount > 0) {
        toast.success(
          `${autoCount + aiCount} neue Betriebskosten erkannt (${autoCount} automatisch, ${aiCount} per KI). ${excludedCount} Zahlungen ausgeschlossen.`
        );
      } else if (cachedCount === 0 && newCount === 0) {
        toast.info("Keine neuen Zahlungen zu klassifizieren");
      }
    } catch (error) {
      console.error("Classification error:", error);
      toast.error("Fehler beim Laden der Klassifizierungen");
    } finally {
      setIsClassifying(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const high = classifications.filter(c => c.confidence === "high" && c.is_betriebskosten).length;
    const medium = classifications.filter(c => c.confidence === "medium" && c.is_betriebskosten).length;
    const low = classifications.filter(c => c.confidence === "low" || !c.is_betriebskosten).length;
    const zugeordnet = zugeordneteZahlungen?.length || 0;
    
    return { high, medium, low, zugeordnet, total: high + medium + low };
  }, [classifications, zugeordneteZahlungen]);

  // Zahlung einer Immobilie zuordnen
  const assignMutation = useMutation({
    mutationFn: async ({ zahlungId, immobilieId }: { zahlungId: string; immobilieId: string }) => {
      // Update zahlung
      const { error: zahlungError } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: immobilieId })
        .eq('id', zahlungId);
      if (zahlungError) throw zahlungError;

      // Mark classification as confirmed
      const { error: classError } = await supabase
        .from('nebenkosten_klassifizierungen')
        .update({ bestaetigt: true, bestaetigt_am: new Date().toISOString() })
        .eq('zahlung_id', zahlungId);
      if (classError) console.error("Error updating classification:", classError);
    },
    onSuccess: (_, variables) => {
      setClassifications(prev => prev.filter(c => c.zahlung_id !== variables.zahlungId));
      queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
      toast.success("Zahlung zugeordnet");
    },
    onError: () => {
      toast.error("Fehler beim Zuordnen");
    }
  });

  // Alle sicheren Zuordnungen bestätigen
  const confirmAllHighConfidence = async () => {
    const highConfidence = classifications.filter(
      c => c.confidence === "high" && c.is_betriebskosten && c.suggested_immobilie_id
    );
    
    if (highConfidence.length === 0) {
      toast.info("Keine sicheren Zuordnungen vorhanden");
      return;
    }

    let success = 0;
    for (const c of highConfidence) {
      const immobilieId = selectedImmobilieOverrides[c.zahlung_id] || c.suggested_immobilie_id;
      if (immobilieId) {
        try {
          await supabase
            .from('zahlungen')
            .update({ immobilie_id: immobilieId })
            .eq('id', c.zahlung_id);
          
          await supabase
            .from('nebenkosten_klassifizierungen')
            .update({ bestaetigt: true, bestaetigt_am: new Date().toISOString() })
            .eq('zahlung_id', c.zahlung_id);
          
          success++;
        } catch (e) {
          console.error("Error assigning:", e);
        }
      }
    }
    
    setClassifications(prev => prev.filter(c => c.confidence !== "high" || !c.is_betriebskosten || !c.suggested_immobilie_id));
    queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
    toast.success(`${success} Zahlungen zugeordnet`);
  };

  // Zahlung aus Klassifizierung entfernen (überspringen)
  const skipClassification = async (zahlungId: string) => {
    try {
      await supabase
        .from('nebenkosten_klassifizierungen')
        .update({ uebersprungen: true })
        .eq('zahlung_id', zahlungId);
      
      setClassifications(prev => prev.filter(c => c.zahlung_id !== zahlungId));
      toast.success("Zahlung übersprungen");
    } catch (error) {
      console.error("Error skipping:", error);
      toast.error("Fehler beim Überspringen");
    }
  };

  // Immobilie für Zahlung ändern
  const handleImmobilieChange = (zahlungId: string, immobilieId: string) => {
    setSelectedImmobilieOverrides(prev => ({ ...prev, [zahlungId]: immobilieId }));
  };

  // Filtern nach Tab
  const filteredClassifications = useMemo(() => {
    return classifications.filter(c => {
      if (activeTab === "high") return c.confidence === "high" && c.is_betriebskosten;
      if (activeTab === "medium") return c.confidence === "medium" && c.is_betriebskosten;
      if (activeTab === "low") return c.confidence === "low" || !c.is_betriebskosten;
      return true;
    });
  }, [classifications, activeTab]);

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Math.abs(betrag));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            KI-Nebenkosten-Zuordnung
            {isFromCache && (
              <Badge variant="outline" className="ml-2 gap-1">
                <Database className="h-3 w-3" />
                Aus Cache
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            Automatische Klassifizierung und Zuordnung zu Immobilien
          </p>
        </div>
        
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline"
                  onClick={() => loadClassifications(true)} 
                  disabled={isClassifying}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", isClassifying && "animate-spin")} />
                  Neu analysieren
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Alle Zahlungen neu klassifizieren (ignoriert Cache)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.high}</div>
              <div className="text-xs text-muted-foreground">Sicher</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
              <div className="text-xs text-muted-foreground">Wahrscheinlich</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{stats.low}</div>
              <div className="text-xs text-muted-foreground">Unsicher</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <div className="text-2xl font-bold">{stats.zugeordnet}</div>
              <div className="text-xs text-muted-foreground">Zugeordnet</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Zu prüfen</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      {isClassifying && classifications.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-4" />
            <h4 className="text-lg font-medium mb-2">Lade Klassifizierungen...</h4>
            <p className="text-muted-foreground">
              Prüfe auf neue Zahlungen und lade gecachte Ergebnisse.
            </p>
          </div>
        </Card>
      ) : classifications.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500/30 mb-4" />
            <h4 className="text-lg font-medium mb-2">Keine Zahlungen zu prüfen</h4>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Alle Nichtmiete-Zahlungen wurden bereits zugeordnet oder es gibt keine neuen Zahlungen.
            </p>
            <Button onClick={() => loadClassifications(true)} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Erneut prüfen
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Klassifizierte Zahlungen */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Klassifizierte Zahlungen</CardTitle>
                  {stats.high > 0 && (
                    <Button 
                      onClick={confirmAllHighConfidence}
                      size="sm"
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Alle sicheren bestätigen ({stats.high})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="high" className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Sicher ({stats.high})
                    </TabsTrigger>
                    <TabsTrigger value="medium" className="gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Wahrscheinlich ({stats.medium})
                    </TabsTrigger>
                    <TabsTrigger value="low" className="gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Unsicher ({stats.low})
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="h-[500px]">
                    {filteredClassifications.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Keine Zahlungen in dieser Kategorie</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredClassifications.map(classification => {
                          const { icon: CategoryIcon, color, bg } = getCategoryIcon(classification.category);
                          const confidenceBadge = getConfidenceBadge(classification.confidence);
                          const selectedImmobilieId = selectedImmobilieOverrides[classification.zahlung_id] || classification.suggested_immobilie_id;
                          const selectedImmobilie = immobilien.find(i => i.id === selectedImmobilieId);

                          return (
                            <Card 
                              key={classification.zahlung_id}
                              className={cn(
                                "p-4 transition-all",
                                classification.confidence === "high" && "border-green-200 bg-green-50/30",
                                classification.confidence === "medium" && "border-yellow-200 bg-yellow-50/30",
                                classification.confidence === "low" && "border-orange-200 bg-orange-50/30"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn("p-2 rounded-lg", bg)}>
                                  <CategoryIcon className={cn("h-5 w-5", color)} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold">
                                      {formatBetrag(classification.zahlung.betrag)}
                                    </span>
                                    <Badge className={confidenceBadge.className}>
                                      {confidenceBadge.label}
                                    </Badge>
                                    <Badge variant="outline">{classification.category}</Badge>
                                  </div>
                                  
                                  <p className="text-sm text-muted-foreground truncate">
                                    {classification.zahlung.empfaengername || 'Unbekannt'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate mb-2">
                                    {classification.zahlung.verwendungszweck?.substring(0, 60)}...
                                  </p>
                                  
                                  <p className="text-xs text-muted-foreground italic mb-3">
                                    KI: {classification.reasoning}
                                  </p>
                                  
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Select
                                      value={selectedImmobilieId || ""}
                                      onValueChange={(value) => handleImmobilieChange(classification.zahlung_id, value)}
                                    >
                                      <SelectTrigger className="w-[200px] h-8 text-sm">
                                        <SelectValue placeholder="Immobilie wählen..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {immobilien.map(imm => (
                                          <SelectItem key={imm.id} value={imm.id}>
                                            {imm.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        const immId = selectedImmobilieId;
                                        if (immId) {
                                          assignMutation.mutate({ zahlungId: classification.zahlung_id, immobilieId: immId });
                                        } else {
                                          toast.error("Bitte eine Immobilie auswählen");
                                        }
                                      }}
                                      disabled={!selectedImmobilieId || assignMutation.isPending}
                                      className="gap-1"
                                    >
                                      <Check className="h-3 w-3" />
                                      Bestätigen
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => skipClassification(classification.zahlung_id)}
                                      className="gap-1 text-muted-foreground"
                                    >
                                      <X className="h-3 w-3" />
                                      Überspringen
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(classification.zahlung.buchungsdatum), "dd.MM.yy", { locale: de })}
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Bereits zugeordnet */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Bereits zugeordnet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {zugeordneteLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !zugeordneteZahlungen || zugeordneteZahlungen.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Noch keine Zuordnungen</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {zugeordneteZahlungen.slice(0, 20).map(zahlung => (
                        <div 
                          key={zahlung.id}
                          className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              {formatBetrag(zahlung.betrag)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(zahlung.buchungsdatum), "dd.MM.yy", { locale: de })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {zahlung.empfaengername}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary">
                              {(zahlung.immobilie as any)?.name || 'Unbekannt'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {zugeordneteZahlungen.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{zugeordneteZahlungen.length - 20} weitere
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}