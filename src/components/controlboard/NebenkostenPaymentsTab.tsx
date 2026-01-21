import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Search, Building2, Home, MapPin, Euro, Settings2, Zap, Droplets, 
  Flame, CreditCard, Check, X, Filter, Calendar, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { NichtmieteRegelnManager } from "./NichtmieteRegelnManager";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface NebenkostenZahlung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  verwendungszweck: string | null;
  empfaengername: string | null;
  iban: string | null;
  kategorie: string | null;
  immobilie_id: string | null;
  mietvertrag_id: string | null;
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

const PAYMENT_CATEGORIES = [
  { value: "strom", label: "Strom", icon: Zap, color: "text-yellow-600" },
  { value: "wasser", label: "Wasser", icon: Droplets, color: "text-blue-600" },
  { value: "gas", label: "Gas", icon: Flame, color: "text-orange-600" },
  { value: "darlehen", label: "Darlehen", icon: CreditCard, color: "text-purple-600" },
  { value: "versicherung", label: "Versicherung", icon: Building2, color: "text-green-600" },
  { value: "sonstige", label: "Sonstige", icon: Euro, color: "text-gray-600" },
];

export function NebenkostenPaymentsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "zugeordnet" | "offen">("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedPayment, setSelectedPayment] = useState<NebenkostenZahlung | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [assignmentTarget, setAssignmentTarget] = useState<"immobilie" | "einheit">("immobilie");
  const [selectedImmobilieId, setSelectedImmobilieId] = useState<string | null>(null);
  const [selectedEinheitId, setSelectedEinheitId] = useState<string | null>(null);

  // Fetch all Nichtmiete payments
  const { data: nichtmieteZahlungen, isLoading } = useQuery({
    queryKey: ['nichtmiete-zahlungen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('kategorie', 'Nichtmiete')
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data as NebenkostenZahlung[];
    }
  });

  // Fetch immobilien for assignment
  const { data: immobilien } = useQuery({
    queryKey: ['immobilien-for-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('id, name, adresse, einheiten_anzahl')
        .order('name');
      if (error) throw error;
      return data as Immobilie[];
    }
  });

  // Fetch einheiten for selected immobilie
  const { data: einheiten } = useQuery({
    queryKey: ['einheiten-for-nebenkosten', selectedImmobilieId],
    queryFn: async () => {
      if (!selectedImmobilieId) return [];
      const { data, error } = await supabase
        .from('einheiten')
        .select('id, immobilie_id, etage, einheitentyp, zaehler, qm')
        .eq('immobilie_id', selectedImmobilieId)
        .order('zaehler');
      if (error) throw error;
      return data as Einheit[];
    },
    enabled: !!selectedImmobilieId
  });

  // Fetch assignment details for payments
  const { data: immobilienMap } = useQuery({
    queryKey: ['immobilien-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('id, name, adresse');
      if (error) throw error;
      return new Map(data.map(i => [i.id, i]));
    }
  });

  // Assign payment mutation
  const assignMutation = useMutation({
    mutationFn: async ({ paymentId, immobilieId, einheitId }: { paymentId: string; immobilieId: string | null; einheitId?: string | null }) => {
      // Update payment with immobilie assignment
      const { error: updateError } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: immobilieId })
        .eq('id', paymentId);
      
      if (updateError) throw updateError;

      // If einheit is specified, also create nebenkosten_zahlungen entry
      if (einheitId) {
        // First check if entry exists
        const { data: existing } = await supabase
          .from('nebenkosten_zahlungen')
          .select('id')
          .eq('zahlung_id', paymentId)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('nebenkosten_zahlungen')
            .update({ einheit_id: einheitId })
            .eq('zahlung_id', paymentId);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('nebenkosten_zahlungen')
            .insert({ zahlung_id: paymentId, einheit_id: einheitId, verteilung_typ: 'manuell' });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-zahlungen'] });
      queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten'] });
      toast.success("Zahlung erfolgreich zugeordnet");
      setAssignDialogOpen(false);
      resetAssignment();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    }
  });

  // Note: Nebenkosten payments are tracked via immobilie_id assignment, 
  // not a separate category (DB only allows: Miete, Mietkaution, Nichtmiete, Rücklastschrift, Ignorieren)

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: null })
        .eq('id', paymentId);
      if (error) throw error;

      // Also remove from nebenkosten_zahlungen
      await supabase
        .from('nebenkosten_zahlungen')
        .delete()
        .eq('zahlung_id', paymentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nichtmiete-zahlungen'] });
      queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten'] });
      toast.success("Zuordnung aufgehoben");
    }
  });

  const resetAssignment = () => {
    setSelectedPayment(null);
    setSelectedImmobilieId(null);
    setSelectedEinheitId(null);
    setAssignmentTarget("immobilie");
  };

  const getPaymentIcon = (payment: NebenkostenZahlung) => {
    const empfaenger = (payment.empfaengername || "").toLowerCase();
    const zweck = (payment.verwendungszweck || "").toLowerCase();
    const combined = empfaenger + " " + zweck;

    if (combined.includes("strom") || combined.includes("avacon") || combined.includes("evi")) {
      return { icon: Zap, color: "text-yellow-600", bg: "bg-yellow-100" };
    }
    if (combined.includes("wasser") || combined.includes("zweckverband")) {
      return { icon: Droplets, color: "text-blue-600", bg: "bg-blue-100" };
    }
    if (combined.includes("gas")) {
      return { icon: Flame, color: "text-orange-600", bg: "bg-orange-100" };
    }
    if (combined.includes("darlehen") || combined.includes("bank") || combined.includes("kredit")) {
      return { icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100" };
    }
    if (combined.includes("versicherung")) {
      return { icon: Building2, color: "text-green-600", bg: "bg-green-100" };
    }
    return { icon: Euro, color: "text-gray-600", bg: "bg-gray-100" };
  };

  // Filter payments
  const filteredPayments = useMemo(() => {
    if (!nichtmieteZahlungen) return [];
    
    return nichtmieteZahlungen.filter(payment => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          payment.empfaengername?.toLowerCase().includes(search) ||
          payment.verwendungszweck?.toLowerCase().includes(search) ||
          payment.iban?.toLowerCase().includes(search) ||
          payment.betrag.toString().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filterStatus === "zugeordnet" && !payment.immobilie_id) return false;
      if (filterStatus === "offen" && payment.immobilie_id) return false;

      // Date filter
      if (dateRange.from || dateRange.to) {
        const paymentDate = new Date(payment.buchungsdatum);
        if (dateRange.from && paymentDate < dateRange.from) return false;
        if (dateRange.to && paymentDate > dateRange.to) return false;
      }

      return true;
    });
  }, [nichtmieteZahlungen, searchTerm, filterStatus, dateRange]);

  // Stats
  const stats = useMemo(() => {
    if (!nichtmieteZahlungen) return { total: 0, zugeordnet: 0, offen: 0, summe: 0 };
    
    const zugeordnet = nichtmieteZahlungen.filter(p => p.immobilie_id).length;
    const summe = nichtmieteZahlungen.reduce((acc, p) => acc + Math.abs(p.betrag), 0);
    
    return {
      total: nichtmieteZahlungen.length,
      zugeordnet,
      offen: nichtmieteZahlungen.length - zugeordnet,
      summe
    };
  }, [nichtmieteZahlungen]);

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag);
  };

  const getEinheitLabel = (einheit: Einheit) => {
    if (einheit.zaehler) {
      return `${einheit.einheitentyp || 'Einheit'} ${einheit.zaehler}`;
    }
    return einheit.einheitentyp || `Einheit ${einheit.id.slice(-4)}`;
  };

  const handleAssign = () => {
    if (!selectedPayment) return;
    
    if (assignmentTarget === "immobilie" && selectedImmobilieId) {
      assignMutation.mutate({ paymentId: selectedPayment.id, immobilieId: selectedImmobilieId });
    } else if (assignmentTarget === "einheit" && selectedImmobilieId && selectedEinheitId) {
      assignMutation.mutate({ paymentId: selectedPayment.id, immobilieId: selectedImmobilieId, einheitId: selectedEinheitId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Nichtmiete-Zahlungen</h3>
          <p className="text-sm text-muted-foreground">
            Zahlungen als Nebenkosten markieren und Immobilien/Einheiten zuordnen
          </p>
        </div>
        <Button variant="outline" onClick={() => setRulesDialogOpen(true)} className="shrink-0">
          <Settings2 className="h-4 w-4 mr-2" />
          Regeln verwalten
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Gesamt</div>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach Empfänger, Verwendungszweck, IBAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Zahlungen</SelectItem>
            <SelectItem value="zugeordnet">Zugeordnet</SelectItem>
            <SelectItem value="offen">Nicht zugeordnet</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-auto", dateRange.from && "bg-blue-50")}>
              <Calendar className="h-4 w-4 mr-2" />
              {dateRange.from && dateRange.to 
                ? `${format(dateRange.from, "dd.MM", { locale: de })} – ${format(dateRange.to, "dd.MM", { locale: de })}`
                : "Zeitraum"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-white" align="end">
            <CalendarComponent
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {(dateRange.from || searchTerm || filterStatus !== "all") && (
          <Button variant="ghost" size="icon" onClick={() => { setDateRange({ from: undefined, to: undefined }); setSearchTerm(""); setFilterStatus("all"); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Payments List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Euro className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Keine Nichtmiete-Zahlungen gefunden</p>
            </div>
          ) : (
            filteredPayments.map(payment => {
              const { icon: PaymentIcon, color, bg } = getPaymentIcon(payment);
              const assignedImmobilie = payment.immobilie_id ? immobilienMap?.get(payment.immobilie_id) : null;

              return (
                <Card key={payment.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={cn("p-2 rounded-lg shrink-0", bg)}>
                        <PaymentIcon className={cn("h-5 w-5", color)} />
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(payment.buchungsdatum), 'dd.MM.yyyy')}
                              </span>
                              <span className={cn("text-lg font-bold", payment.betrag < 0 ? "text-destructive" : "text-green-600")}>
                                {formatBetrag(payment.betrag)}
                              </span>
                            </div>
                            <p className="font-medium truncate">{payment.empfaengername || "Unbekannter Empfänger"}</p>
                            {payment.verwendungszweck && (
                              <p className="text-sm text-muted-foreground truncate">{payment.verwendungszweck}</p>
                            )}
                          </div>

                          {/* Assignment Status & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {assignedImmobilie ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {assignedImmobilie.name}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeAssignmentMutation.mutate(payment.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-orange-600 border-orange-300">
                                  Nicht zugeordnet
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setAssignDialogOpen(true);
                                  }}
                                >
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  Zuordnen
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={(open) => { if (!open) resetAssignment(); setAssignDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Zahlung zuordnen</DialogTitle>
            {selectedPayment && (
              <DialogDescription>
                <span className="font-semibold">{formatBetrag(selectedPayment.betrag)}</span> vom {format(new Date(selectedPayment.buchungsdatum), 'dd.MM.yyyy')}
                {selectedPayment.empfaengername && <span> • {selectedPayment.empfaengername}</span>}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {/* Assignment Type */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                variant={assignmentTarget === "immobilie" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => { setAssignmentTarget("immobilie"); setSelectedEinheitId(null); }}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Immobilie
              </Button>
              <Button
                variant={assignmentTarget === "einheit" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setAssignmentTarget("einheit")}
              >
                <Home className="h-4 w-4 mr-2" />
                Einheit
              </Button>
            </div>

            {/* Immobilie Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Immobilie auswählen</label>
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {immobilien?.map(immobilie => (
                    <div
                      key={immobilie.id}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-all",
                        selectedImmobilieId === immobilie.id 
                          ? "bg-primary/10 border-2 border-primary" 
                          : "hover:bg-muted border-2 border-transparent"
                      )}
                      onClick={() => { setSelectedImmobilieId(immobilie.id); setSelectedEinheitId(null); }}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{immobilie.name}</p>
                          <p className="text-xs text-muted-foreground">{immobilie.adresse}</p>
                        </div>
                        {selectedImmobilieId === immobilie.id && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Einheit Selection (if target is einheit) */}
            {assignmentTarget === "einheit" && selectedImmobilieId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Einheit auswählen</label>
                <ScrollArea className="h-[150px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {einheiten?.map(einheit => (
                      <div
                        key={einheit.id}
                        className={cn(
                          "p-3 rounded-lg cursor-pointer transition-all",
                          selectedEinheitId === einheit.id 
                            ? "bg-primary/10 border-2 border-primary" 
                            : "hover:bg-muted border-2 border-transparent"
                        )}
                        onClick={() => setSelectedEinheitId(einheit.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{getEinheitLabel(einheit)}</p>
                            {einheit.qm && <p className="text-xs text-muted-foreground">{einheit.qm} m²</p>}
                          </div>
                          {selectedEinheitId === einheit.id && (
                            <Check className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetAssignment(); setAssignDialogOpen(false); }}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={
                assignMutation.isPending || 
                !selectedImmobilieId || 
                (assignmentTarget === "einheit" && !selectedEinheitId)
              }
            >
              {assignMutation.isPending ? "Zuordnen..." : "Zuordnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Management Dialog */}
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Nichtmiete-Regeln verwalten</DialogTitle>
            <DialogDescription>
              Definieren Sie Regeln zur automatischen Erkennung von Nichtmiete-Zahlungen
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <NichtmieteRegelnManager />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
