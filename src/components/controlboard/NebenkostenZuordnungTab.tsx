import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Building2, Euro, Zap, Droplets, Flame, CreditCard, Check, 
  Calendar, ChevronRight, Loader2, Users, Home, Calculator,
  CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";
import { format, startOfYear, endOfYear, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
import { Progress } from "@/components/ui/progress";
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
  einheiten_anzahl: number;
}

interface Einheit {
  id: string;
  immobilie_id: string;
  etage: string | null;
  einheitentyp: string | null;
  zaehler: number | null;
  qm: number | null;
}

interface Mietvertrag {
  id: string;
  einheit_id: string;
  start_datum: string | null;
  ende_datum: string | null;
  kaltmiete: number | null;
  status: string | null;
  mieter_namen?: string;
}

interface VerteilungResult {
  mietvertrag_id: string;
  mieter_namen: string;
  einheit_label: string;
  anteil_prozent: number;
  anteil_betrag: number;
  tage_im_jahr: number;
  gesamt_tage: number;
}

// Berechne anteilige Tage eines Mietvertrags im Jahr
function calculateContractDaysInYear(
  contract: Mietvertrag, 
  year: number
): { days: number; totalDays: number } {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const totalDaysInYear = differenceInDays(yearEnd, yearStart) + 1;

  const contractStart = contract.start_datum ? parseISO(contract.start_datum) : yearStart;
  const contractEnd = contract.ende_datum ? parseISO(contract.ende_datum) : yearEnd;

  // Berechne Überlappung mit dem Jahr
  const effectiveStart = contractStart > yearStart ? contractStart : yearStart;
  const effectiveEnd = contractEnd < yearEnd ? contractEnd : yearEnd;

  if (effectiveStart > effectiveEnd) {
    return { days: 0, totalDays: totalDaysInYear };
  }

  const days = differenceInDays(effectiveEnd, effectiveStart) + 1;
  return { days, totalDays: totalDaysInYear };
}

// Erkennt Zahlungstyp basierend auf Empfänger/Verwendungszweck
function detectPaymentType(zahlung: Zahlung): { type: string; icon: any; color: string; bg: string } {
  const text = `${zahlung.empfaengername || ""} ${zahlung.verwendungszweck || ""}`.toLowerCase();

  if (text.includes("strom") || text.includes("avacon") || text.includes("evi") || text.includes("energy")) {
    return { type: "Strom", icon: Zap, color: "text-yellow-600", bg: "bg-yellow-100" };
  }
  if (text.includes("wasser") || text.includes("zweckverband") || text.includes("abwasser")) {
    return { type: "Wasser", icon: Droplets, color: "text-blue-600", bg: "bg-blue-100" };
  }
  if (text.includes("gas") || text.includes("heizung")) {
    return { type: "Gas/Heizung", icon: Flame, color: "text-orange-600", bg: "bg-orange-100" };
  }
  if (text.includes("versicherung") || text.includes("haftpflicht") || text.includes("gebäude")) {
    return { type: "Versicherung", icon: Building2, color: "text-green-600", bg: "bg-green-100" };
  }
  if (text.includes("darlehen") || text.includes("bank") || text.includes("kredit") || text.includes("zins")) {
    return { type: "Darlehen", icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100" };
  }
  return { type: "Sonstige", icon: Euro, color: "text-gray-600", bg: "bg-gray-100" };
}

export function NebenkostenZuordnungTab() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedImmobilieId, setSelectedImmobilieId] = useState<string | null>(null);
  const [selectedZahlung, setSelectedZahlung] = useState<Zahlung | null>(null);
  const [verteilungPreview, setVerteilungPreview] = useState<VerteilungResult[]>([]);
  const [showVerteilungDialog, setShowVerteilungDialog] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Verfügbare Jahre
  const availableYears = [2024, 2025, 2026];

  // Fetch immobilien
  const { data: immobilien, isLoading: immobilienLoading } = useQuery({
    queryKey: ['immobilien-nebenkosten-zuordnung'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('id, name, adresse, einheiten_anzahl')
        .order('name');
      if (error) throw error;
      return data as Immobilie[];
    }
  });

  // Fetch Nichtmiete-Zahlungen für das gewählte Jahr
  const { data: nichtmieteZahlungen, isLoading: zahlungenLoading } = useQuery({
    queryKey: ['nichtmiete-zahlungen-year', selectedYear],
    queryFn: async () => {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('kategorie', 'Nichtmiete')
        .gte('buchungsdatum', yearStart)
        .lte('buchungsdatum', yearEnd)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data as Zahlung[];
    }
  });

  // Fetch Einheiten und Mietverträge für gewählte Immobilie
  const { data: einheiten } = useQuery({
    queryKey: ['einheiten-zuordnung', selectedImmobilieId],
    queryFn: async () => {
      if (!selectedImmobilieId) return [];
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', selectedImmobilieId);
      if (error) throw error;
      return data as Einheit[];
    },
    enabled: !!selectedImmobilieId
  });

  const { data: mietvertraege } = useQuery({
    queryKey: ['mietvertraege-zuordnung', selectedImmobilieId, selectedYear],
    queryFn: async () => {
      if (!selectedImmobilieId || !einheiten) return [];
      
      const einheitIds = einheiten.map(e => e.id);
      if (einheitIds.length === 0) return [];

      // Hole alle Mietverträge für die Einheiten
      const { data: contracts, error } = await supabase
        .from('mietvertrag')
        .select('*')
        .in('einheit_id', einheitIds);
      
      if (error) throw error;

      // Filter: Verträge die im gewählten Jahr aktiv waren
      const yearStart = new Date(selectedYear, 0, 1);
      const yearEnd = new Date(selectedYear, 11, 31);

      const activeContracts = (contracts || []).filter(c => {
        const start = c.start_datum ? parseISO(c.start_datum) : new Date(2000, 0, 1);
        const end = c.ende_datum ? parseISO(c.ende_datum) : new Date(2100, 11, 31);
        
        // Vertrag war im Jahr aktiv wenn Start <= Jahresende UND Ende >= Jahresanfang
        return start <= yearEnd && end >= yearStart;
      });

      // Hole Mieter-Namen für jeden Vertrag
      const contractsWithMieter = await Promise.all(
        activeContracts.map(async (contract) => {
          const { data: mieterData } = await supabase
            .from('mietvertrag_mieter')
            .select('mieter:mieter_id(vorname, nachname)')
            .eq('mietvertrag_id', contract.id);

          const mieterNamen = mieterData
            ?.map((m: any) => `${m.mieter?.vorname || ''} ${m.mieter?.nachname || ''}`.trim())
            .filter(Boolean)
            .join(', ') || 'Unbekannt';

          return { ...contract, mieter_namen: mieterNamen } as Mietvertrag;
        })
      );

      return contractsWithMieter;
    },
    enabled: !!selectedImmobilieId && !!einheiten && einheiten.length > 0
  });

  // Zahlungen nach Immobilien-Zuordnung gruppieren
  const { zugeordnete, nichtZugeordnete } = useMemo(() => {
    if (!nichtmieteZahlungen) return { zugeordnete: [], nichtZugeordnete: [] };

    const zugeordnete = nichtmieteZahlungen.filter(z => z.immobilie_id);
    const nichtZugeordnete = nichtmieteZahlungen.filter(z => !z.immobilie_id);

    return { zugeordnete, nichtZugeordnete };
  }, [nichtmieteZahlungen]);

  // Gefilterte Zahlungen basierend auf gewählter Immobilie
  const filteredZahlungen = useMemo(() => {
    if (!selectedImmobilieId) return nichtZugeordnete;
    return zugeordnete.filter(z => z.immobilie_id === selectedImmobilieId);
  }, [selectedImmobilieId, zugeordnete, nichtZugeordnete]);

  // Stats
  const stats = useMemo(() => {
    const total = nichtmieteZahlungen?.length || 0;
    const zugeordnetCount = zugeordnete.length;
    const summe = Math.abs(nichtmieteZahlungen?.reduce((acc, z) => acc + z.betrag, 0) || 0);
    
    return { total, zugeordnet: zugeordnetCount, offen: total - zugeordnetCount, summe };
  }, [nichtmieteZahlungen, zugeordnete]);

  // Berechne Verteilung für eine Zahlung
  const calculateVerteilung = async (zahlung: Zahlung) => {
    if (!einheiten || !mietvertraege || mietvertraege.length === 0) {
      toast.error("Keine aktiven Mietverträge gefunden");
      return;
    }

    setIsCalculating(true);
    setSelectedZahlung(zahlung);

    try {
      const gesamtBetrag = Math.abs(zahlung.betrag);
      const results: VerteilungResult[] = [];
      let totalTage = 0;

      // Berechne Tage pro Mietvertrag
      mietvertraege.forEach(mv => {
        const { days } = calculateContractDaysInYear(mv, selectedYear);
        if (days > 0) {
          const einheit = einheiten.find(e => e.id === mv.einheit_id);
          results.push({
            mietvertrag_id: mv.id,
            mieter_namen: mv.mieter_namen || 'Unbekannt',
            einheit_label: einheit ? `${einheit.einheitentyp || 'Einheit'} ${einheit.zaehler || ''}`.trim() : 'Einheit',
            anteil_prozent: 0,
            anteil_betrag: 0,
            tage_im_jahr: days,
            gesamt_tage: 0
          });
          totalTage += days;
        }
      });

      // Berechne Anteile
      results.forEach(r => {
        r.gesamt_tage = totalTage;
        r.anteil_prozent = totalTage > 0 ? (r.tage_im_jahr / totalTage) * 100 : 0;
        r.anteil_betrag = totalTage > 0 ? (r.tage_im_jahr / totalTage) * gesamtBetrag : 0;
      });

      setVerteilungPreview(results.sort((a, b) => b.anteil_betrag - a.anteil_betrag));
      setShowVerteilungDialog(true);
    } catch (error) {
      console.error('Error calculating distribution:', error);
      toast.error("Fehler bei der Berechnung");
    } finally {
      setIsCalculating(false);
    }
  };

  // Zahlung einer Immobilie zuordnen
  const assignToImmobilieMutation = useMutation({
    mutationFn: async ({ zahlungId, immobilieId }: { zahlungId: string; immobilieId: string }) => {
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: immobilieId })
        .eq('id', zahlungId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-zahlungen-year'] });
      toast.success("Zahlung zugeordnet");
    }
  });

  // Verteilung speichern (in nebenkosten_zahlungen)
  const saveVerteilungMutation = useMutation({
    mutationFn: async () => {
      if (!selectedZahlung || !selectedImmobilieId) return;

      // Erst Immobilie zuordnen falls noch nicht geschehen
      if (!selectedZahlung.immobilie_id) {
        await supabase
          .from('zahlungen')
          .update({ immobilie_id: selectedImmobilieId })
          .eq('id', selectedZahlung.id);
      }

      // Verteilung speichern
      for (const result of verteilungPreview) {
        const einheit = einheiten?.find(e => 
          mietvertraege?.find(m => m.id === result.mietvertrag_id)?.einheit_id === e.id
        );

        if (einheit) {
          await supabase
            .from('nebenkosten_zahlungen')
            .upsert({
              zahlung_id: selectedZahlung.id,
              einheit_id: einheit.id,
              verteilung_typ: 'anteilig'
            }, { onConflict: 'zahlung_id' });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-zahlungen-year'] });
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-zahlungen'] });
      toast.success("Verteilung gespeichert");
      setShowVerteilungDialog(false);
      setSelectedZahlung(null);
      setVerteilungPreview([]);
    }
  });

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag);
  };

  const getEinheitLabel = (einheit: Einheit) => {
    if (einheit.zaehler) return `${einheit.einheitentyp || 'Einheit'} ${einheit.zaehler}`;
    return einheit.einheitentyp || `Einheit`;
  };

  if (immobilienLoading || zahlungenLoading) {
    return (
      <div className="flex items-center justify-center py-12">
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
            <Sparkles className="h-5 w-5 text-primary" />
            Nebenkosten auf Mietverträge verteilen
          </h3>
          <p className="text-sm text-muted-foreground">
            Anteilige Berechnung basierend auf Mietvertragslaufzeiten
          </p>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedImmobilieId || "all"} 
            onValueChange={(v) => setSelectedImmobilieId(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Alle Immobilien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Nicht zugeordnete</SelectItem>
              {immobilien?.map(imm => (
                <SelectItem key={imm.id} value={imm.id}>{imm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Gesamt {selectedYear}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.zugeordnet}</div>
          <div className="text-sm text-muted-foreground">Zugeordnet</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-600">{stats.offen}</div>
          <div className="text-sm text-muted-foreground">Offen</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{formatBetrag(stats.summe)}</div>
          <div className="text-sm text-muted-foreground">Gesamtbetrag</div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zahlungsliste */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5" />
              {selectedImmobilieId 
                ? `Zahlungen für ${immobilien?.find(i => i.id === selectedImmobilieId)?.name}` 
                : "Nicht zugeordnete Zahlungen"}
              <Badge variant="secondary">{filteredZahlungen.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filteredZahlungen.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Keine Zahlungen gefunden</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredZahlungen.map(zahlung => {
                    const paymentType = detectPaymentType(zahlung);
                    const PaymentIcon = paymentType.icon;

                    return (
                      <div
                        key={zahlung.id}
                        className="p-3 rounded-lg border bg-card hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("p-2 rounded-lg shrink-0", paymentType.bg)}>
                            <PaymentIcon className={cn("h-4 w-4", paymentType.color)} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy')}
                              </span>
                              <span className={cn("font-bold", zahlung.betrag < 0 ? "text-destructive" : "text-green-600")}>
                                {formatBetrag(zahlung.betrag)}
                              </span>
                            </div>
                            <p className="font-medium text-sm truncate">{zahlung.empfaengername || "Unbekannt"}</p>
                            {zahlung.verwendungszweck && (
                              <p className="text-xs text-muted-foreground truncate">{zahlung.verwendungszweck}</p>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{paymentType.type}</Badge>
                              
                              {!selectedImmobilieId ? (
                                // Immobilie zuordnen
                                <Select
                                  onValueChange={(immId) => {
                                    assignToImmobilieMutation.mutate({ zahlungId: zahlung.id, immobilieId: immId });
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    Zuordnen
                                  </SelectTrigger>
                                  <SelectContent>
                                    {immobilien?.map(imm => (
                                      <SelectItem key={imm.id} value={imm.id} className="text-xs">
                                        {imm.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                // Verteilung berechnen
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => calculateVerteilung(zahlung)}
                                  disabled={isCalculating}
                                >
                                  {isCalculating && selectedZahlung?.id === zahlung.id ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Calculator className="h-3 w-3 mr-1" />
                                  )}
                                  Verteilen
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Mietverträge Übersicht */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mietverträge {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedImmobilieId ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Wählen Sie eine Immobilie aus</p>
              </div>
            ) : !mietvertraege || mietvertraege.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Keine aktiven Mietverträge in {selectedYear}</p>
              </div>
            ) : (
              <ScrollArea className="h-[450px]">
                <div className="space-y-3">
                  {mietvertraege.map(mv => {
                    const einheit = einheiten?.find(e => e.id === mv.einheit_id);
                    const { days, totalDays } = calculateContractDaysInYear(mv, selectedYear);
                    const anteil = (days / totalDays) * 100;

                    return (
                      <TooltipProvider key={mv.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <Home className="h-4 w-4 text-primary" />
                                <span className="font-medium text-sm">{getEinheitLabel(einheit!)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground truncate mb-2">
                                {mv.mieter_namen}
                              </p>
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span>{days} Tage</span>
                                  <span className="font-medium">{anteil.toFixed(1)}%</span>
                                </div>
                                <Progress value={anteil} className="h-1.5" />
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {mv.start_datum ? format(parseISO(mv.start_datum), 'dd.MM.yy') : 'Unbegrenzt'} 
                                {' - '}
                                {mv.ende_datum ? format(parseISO(mv.ende_datum), 'dd.MM.yy') : 'Unbegrenzt'}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{days} von {totalDays} Tagen im Jahr {selectedYear}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verteilungs-Dialog */}
      <AlertDialog open={showVerteilungDialog} onOpenChange={setShowVerteilungDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Anteilige Verteilung
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedZahlung && (
                <span>
                  <strong>{formatBetrag(Math.abs(selectedZahlung.betrag))}</strong> von {selectedZahlung.empfaengername} 
                  {' '}wird auf {verteilungPreview.length} Mietverträge verteilt
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {verteilungPreview.map((result, idx) => (
                  <div 
                    key={result.mietvertrag_id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{result.einheit_label}</p>
                        <p className="text-xs text-muted-foreground">{result.mieter_namen}</p>
                        <p className="text-xs text-muted-foreground">
                          {result.tage_im_jahr} von {result.gesamt_tage} Tagen
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatBetrag(result.anteil_betrag)}</p>
                      <p className="text-xs text-muted-foreground">{result.anteil_prozent.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedZahlung(null);
              setVerteilungPreview([]);
            }}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => saveVerteilungMutation.mutate()}
              disabled={saveVerteilungMutation.isPending}
            >
              {saveVerteilungMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Verteilung speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
