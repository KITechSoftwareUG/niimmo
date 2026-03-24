import { useState, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2, Euro, Check, Calendar, Loader2,
  Search, Undo2, Sparkles, ChevronDown, ChevronUp, GripVertical, X, EyeOff, ArrowUpCircle, ExternalLink
} from "lucide-react";
import { useNavigationState } from "@/hooks/useNavigationState";
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

// ── Pagination constant ──
const PAGE_SIZE = 30;

// ── Formatting helpers (stable references) ──
const formatBetrag = (betrag: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Math.abs(betrag));

const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'high': return 'bg-green-100 text-green-800 border-green-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'low': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-muted text-muted-foreground';
  }
};

// ── Memoized Payment Card ──
interface PaymentCardProps {
  zahlung: Zahlung;
  isNichtmiete: boolean;
  isSelected: boolean;
  classification: ClassificationResult | undefined;
  isExpanded: boolean;
  isDragging: boolean;
  onToggleExpand: (id: string) => void;
  onAssign: (zahlungId: string, immobilieId: string) => void;
  onRecategorize: (zahlungId: string) => void;
  onDismiss: (zahlungId: string) => void;
  onPromote: (zahlungId: string) => void;
  onDragStart: (e: React.DragEvent, zahlungId: string) => void;
  onDragEnd: () => void;
  assignPending: boolean;
  recategorizePending: boolean;
  dismissPending: boolean;
  promotePending: boolean;
}

const PaymentCard = memo(function PaymentCard({
  zahlung,
  isNichtmiete,
  isSelected,
  classification,
  isExpanded,
  isDragging,
  onToggleExpand,
  onAssign,
  onRecategorize,
  onDismiss,
  onPromote,
  onDragStart,
  onDragEnd,
  assignPending,
  recategorizePending,
  dismissPending,
  promotePending,
}: PaymentCardProps) {
  const suggestedImmobilie = classification?.suggested_immobilie_id;
  const suggestedName = classification?.suggested_immobilie_name;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, zahlung.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "p-4 border rounded-lg transition-all cursor-grab active:cursor-grabbing",
        isNichtmiete
          ? "border-l-4 border-l-muted-foreground/30 opacity-80"
          : "border-l-4 border-l-blue-400",
        isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'hover:bg-accent/50',
        isDragging && 'opacity-50 scale-95'
      )}
    >
      {/* Header */}
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
          {isNichtmiete && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Nichtmiete
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

      {/* Verwendungszweck */}
      <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(zahlung.id)}>
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

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
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
                disabled={assignPending}
                onClick={() => onAssign(zahlung.id, suggestedImmobilie)}
              >
                <Check className="h-4 w-4" />
                Bestätigen
              </Button>
            </div>
          </div>
        )}

        {isNichtmiete ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 gap-1 text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              disabled={promotePending}
              onClick={() => onPromote(zahlung.id)}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Nebenkosten
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 gap-1 text-muted-foreground hover:bg-muted"
              disabled={dismissPending}
              onClick={() => onDismiss(zahlung.id)}
            >
              <EyeOff className="h-4 w-4" />
              Ausblenden
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            disabled={recategorizePending}
            onClick={() => onRecategorize(zahlung.id)}
          >
            <X className="h-4 w-4" />
            Nichtmiete
          </Button>
        )}
      </div>
    </div>
  );
});

export function NebenkostenZuordnungTab() {
  const queryClient = useQueryClient();
  const { updateNav } = useNavigationState();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZahlung, setSelectedZahlung] = useState<string | null>(null);
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [expandedImmobilien, setExpandedImmobilien] = useState<Set<string>>(new Set());
  const [draggingZahlungId, setDraggingZahlungId] = useState<string | null>(null);
  const [dragOverImmobilieId, setDragOverImmobilieId] = useState<string | null>(null);
  const [nichtmieteOpen, setNichtmieteOpen] = useState(true);
  const [nebenkostenPage, setNebenkostenPage] = useState(1);
  const [nichtmietePage, setNichtmietePage] = useState(1);

  const toggleImmobilieExpanded = useCallback((immoId: string) => {
    setExpandedImmobilien(prev => {
      const next = new Set(prev);
      if (next.has(immoId)) next.delete(immoId);
      else next.add(immoId);
      return next;
    });
  }, []);

  const navigateToImmobilie = useCallback((immoId: string) => {
    updateNav({
      selectedImmobilie: immoId,
      selectedEinheit: null,
      selectedMietvertrag: null,
      showControlboard: false,
      navigationSource: "immobilie",
    });
  }, [updateNav]);

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
    },
    staleTime: 60000,
  });

  // Fetch unzugeordnete Nichtmiete-Zahlungen
  const { data: unzugeordneteZahlungen, isLoading: unzugeordneteLoading } = useQuery({
    queryKey: ['unzugeordnete-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('id, betrag, buchungsdatum, verwendungszweck, empfaengername, iban, kategorie, immobilie_id')
        .in('kategorie', ['Nichtmiete', 'Nebenkosten'])
        .is('immobilie_id', null)
        .order('buchungsdatum', { ascending: false });
      if (error) throw error;
      return data as Zahlung[];
    },
    staleTime: 15000,
  });

  // Fetch bereits zugeordnete Zahlungen
  const { data: zugeordneteZahlungen, isLoading: zugeordneteLoading } = useQuery({
    queryKey: ['zugeordnete-nebenkosten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('id, betrag, buchungsdatum, empfaengername, immobilie_id, immobilie:immobilie_id(id, name, adresse)')
        .in('kategorie', ['Nichtmiete', 'Nebenkosten'])
        .not('immobilie_id', 'is', null)
        .order('buchungsdatum', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 15000,
  });

  // Lade gespeicherte Klassifizierungen
  const { data: cachedClassifications, isLoading: classificationsLoading } = useQuery({
    queryKey: ['nebenkosten-klassifizierungen-cached'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nebenkosten_klassifizierungen')
        .select(`
          zahlung_id, is_betriebskosten, confidence, category,
          suggested_immobilie_id, reasoning,
          immobilie:suggested_immobilie_id(id, name)
        `)
        .eq('is_betriebskosten', true)
        .eq('bestaetigt', false)
        .eq('uebersprungen', false);
      if (error) throw error;
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
    staleTime: 30000,
  });

  // Lade übersprungene Klassifizierungen
  const { data: skippedClassifications } = useQuery({
    queryKey: ['nebenkosten-klassifizierungen-skipped'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nebenkosten_klassifizierungen')
        .select('zahlung_id')
        .eq('uebersprungen', true);
      if (error) throw error;
      return new Set((data || []).map(c => c.zahlung_id));
    },
    staleTime: 30000,
  });

  // Build a classification map for O(1) lookups
  const classificationMap = useMemo(() => {
    const map = new Map<string, ClassificationResult>();
    (cachedClassifications || []).forEach(c => map.set(c.zahlung_id, c));
    return map;
  }, [cachedClassifications]);

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
          total: 0,
        };
      }
      grouped[immoId].zahlungen.push(z);
      grouped[immoId].total += z.betrag;
    });
    return grouped;
  }, [zugeordneteZahlungen]);

  // Filtered & split payments
  const { nebenkostenPayments, nichtmietePayments } = useMemo(() => {
    if (!unzugeordneteZahlungen) return { nebenkostenPayments: [], nichtmietePayments: [] };
    const skipped = skippedClassifications || new Set<string>();
    let payments = unzugeordneteZahlungen.filter(z => !skipped.has(z.id));
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      payments = payments.filter(z =>
        z.verwendungszweck?.toLowerCase().includes(search) ||
        z.empfaengername?.toLowerCase().includes(search) ||
        z.iban?.toLowerCase().includes(search)
      );
    }
    // Already sorted by DB query, no need to re-sort
    return {
      nebenkostenPayments: payments.filter(z => z.kategorie === 'Nebenkosten'),
      nichtmietePayments: payments.filter(z => z.kategorie === 'Nichtmiete'),
    };
  }, [unzugeordneteZahlungen, searchTerm, skippedClassifications]);

  // Paginated slices
  const visibleNebenkosten = useMemo(
    () => nebenkostenPayments.slice(0, nebenkostenPage * PAGE_SIZE),
    [nebenkostenPayments, nebenkostenPage]
  );
  const visibleNichtmiete = useMemo(
    () => nichtmietePayments.slice(0, nichtmietePage * PAGE_SIZE),
    [nichtmietePayments, nichtmietePage]
  );

  const totalDisplayed = nebenkostenPayments.length + nichtmietePayments.length;

  // ── Stable callbacks ──

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedPayments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, zahlungId: string) => {
    e.dataTransfer.setData('zahlungId', zahlungId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingZahlungId(zahlungId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingZahlungId(null);
    setDragOverImmobilieId(null);
  }, []);

  // Reset pagination on search change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setNebenkostenPage(1);
    setNichtmietePage(1);
  }, []);

  // ── Mutations ──

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unzugeordnete-nebenkosten'] });
    queryClient.invalidateQueries({ queryKey: ['zugeordnete-nebenkosten'] });
    queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-cached'] });
  }, [queryClient]);

  const assignMutation = useMutation({
    mutationFn: async ({ zahlungId, immobilieId }: { zahlungId: string; immobilieId: string }) => {
      const { error } = await supabase.from('zahlungen').update({ immobilie_id: immobilieId }).eq('id', zahlungId);
      if (error) throw error;
      await supabase.from('nebenkosten_klassifizierungen')
        .update({ bestaetigt: true, bestaetigt_am: new Date().toISOString() })
        .eq('zahlung_id', zahlungId);
    },
    onSuccess: () => { invalidateAll(); setSelectedZahlung(null); setSelectedImmobilie(null); toast.success("Zahlung zugeordnet"); },
    onError: () => { toast.error("Fehler beim Zuordnen"); },
  });

  const unassignMutation = useMutation({
    mutationFn: async (zahlungId: string) => {
      const { error } = await supabase.from('zahlungen').update({ immobilie_id: null }).eq('id', zahlungId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Zuordnung aufgehoben"); },
    onError: () => { toast.error("Fehler beim Aufheben"); },
  });

  const recategorizeNichtmieteMutation = useMutation({
    mutationFn: async (zahlungId: string) => {
      const { error } = await supabase.from('zahlungen').update({ kategorie: 'Nichtmiete', immobilie_id: null }).eq('id', zahlungId);
      if (error) throw error;
      await supabase.from('nebenkosten_klassifizierungen').update({ uebersprungen: true }).eq('zahlung_id', zahlungId);
    },
    onSuccess: () => { invalidateAll(); toast.success("Zahlung als Nichtmiete kategorisiert"); },
    onError: () => { toast.error("Fehler beim Rekategorisieren"); },
  });

  const dismissNichtmieteMutation = useMutation({
    mutationFn: async (zahlungId: string) => {
      const { data: existing } = await supabase.from('nebenkosten_klassifizierungen').select('id').eq('zahlung_id', zahlungId).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('nebenkosten_klassifizierungen').update({ uebersprungen: true }).eq('zahlung_id', zahlungId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nebenkosten_klassifizierungen').insert({
          zahlung_id: zahlungId, is_betriebskosten: false, confidence: 'high', category: 'Nichtmiete', uebersprungen: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-skipped'] });
      toast.success("Zahlung ausgeblendet");
    },
    onError: () => { toast.error("Fehler beim Ausblenden"); },
  });

  const promoteToNebenkostenMutation = useMutation({
    mutationFn: async (zahlungId: string) => {
      const { error } = await supabase.from('zahlungen').update({ kategorie: 'Nebenkosten' as any }).eq('id', zahlungId);
      if (error) throw error;
      const { data: existing } = await supabase.from('nebenkosten_klassifizierungen').select('id').eq('zahlung_id', zahlungId).maybeSingle();
      if (existing) {
        await supabase.from('nebenkosten_klassifizierungen').update({ uebersprungen: false, is_betriebskosten: true }).eq('zahlung_id', zahlungId);
      }
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-skipped'] });
      toast.success("Zahlung als Nebenkosten markiert");
    },
    onError: () => { toast.error("Fehler beim Umwandeln"); },
  });

  // Stable assign callback for PaymentCard
  const handleAssign = useCallback((zahlungId: string, immobilieId: string) => {
    assignMutation.mutate({ zahlungId, immobilieId });
  }, []);

  const handleRecategorize = useCallback((zahlungId: string) => {
    recategorizeNichtmieteMutation.mutate(zahlungId);
  }, []);

  const handleDismiss = useCallback((zahlungId: string) => {
    dismissNichtmieteMutation.mutate(zahlungId);
  }, []);

  const handlePromote = useCallback((zahlungId: string) => {
    promoteToNebenkostenMutation.mutate(zahlungId);
  }, []);

  // KI Klassifizierung
  const runClassification = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-nebenkosten', { body: { force: false } });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['nebenkosten-klassifizierungen-cached'] });
      const newAnalyzed = data.ai_classified || 0;
      if (newAnalyzed > 0) {
        toast.success(`${newAnalyzed} neue Zahlungen analysiert`);
      } else {
        toast.info('Keine neuen Zahlungen zu analysieren', { description: 'Alle Zahlungen wurden bereits klassifiziert' });
      }
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Fehler bei der Klassifizierung');
    } finally {
      setIsClassifying(false);
    }
  };

  // Drag & Drop helpers
  const handleDragOver = useCallback((e: React.DragEvent, immobilieId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverImmobilieId(immobilieId);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverImmobilieId(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, immobilieId: string) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId && immobilieId) assignMutation.mutate({ zahlungId, immobilieId });
    setDragOverImmobilieId(null);
    setDraggingZahlungId(null);
  }, []);

  const handleDropUnassign = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId) unassignMutation.mutate(zahlungId);
    setDragOverImmobilieId(null);
    setDraggingZahlungId(null);
  }, []);

  const [dragOverNichtmiete, setDragOverNichtmiete] = useState(false);

  const handleDropNichtmiete = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData('zahlungId');
    if (zahlungId) recategorizeNichtmieteMutation.mutate(zahlungId);
    setDragOverNichtmiete(false);
    setDraggingZahlungId(null);
  }, []);

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
            {totalDisplayed} unzugeordnet
          </Badge>
          {(cachedClassifications || []).length > 0 && (
            <Badge variant="default" className="gap-1 bg-primary">
              <Sparkles className="h-3 w-3" />
              {(cachedClassifications || []).length} erkannt
            </Badge>
          )}
        </div>
      </div>

      {isClassifying && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analysiere Zahlungen...</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Suche nach Verwendungszweck, Empfänger oder IBAN..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Payments */}
        <Card
          className={cn(
            "transition-all",
            draggingZahlungId && !Object.keys(zahlungenByImmobilie).some(id =>
              zahlungenByImmobilie[id].zahlungen.some(z => z.id === draggingZahlungId)
            ) ? "" : draggingZahlungId ? "opacity-50" : ""
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOverImmobilieId('unassigned'); }}
          onDragLeave={handleDragLeave}
          onDrop={handleDropUnassign}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Zahlungen ({totalDisplayed})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalDisplayed === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Keine unzugeordneten Zahlungen</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-100px)] overflow-y-auto">
                <div className="space-y-3 pr-2">
                  {/* Nebenkosten section */}
                  {nebenkostenPayments.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                        <div className="h-3 w-3 rounded-full bg-blue-400" />
                        <h4 className="font-semibold text-sm text-foreground">
                          Nebenkosten ({nebenkostenPayments.length})
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {visibleNebenkosten.map(zahlung => (
                          <PaymentCard
                            key={zahlung.id}
                            zahlung={zahlung}
                            isNichtmiete={false}
                            isSelected={selectedZahlung === zahlung.id}
                            classification={classificationMap.get(zahlung.id)}
                            isExpanded={expandedPayments.has(zahlung.id)}
                            isDragging={draggingZahlungId === zahlung.id}
                            onToggleExpand={handleToggleExpand}
                            onAssign={handleAssign}
                            onRecategorize={handleRecategorize}
                            onDismiss={handleDismiss}
                            onPromote={handlePromote}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            assignPending={assignMutation.isPending}
                            recategorizePending={recategorizeNichtmieteMutation.isPending}
                            dismissPending={dismissNichtmieteMutation.isPending}
                            promotePending={promoteToNebenkostenMutation.isPending}
                          />
                        ))}
                        {visibleNebenkosten.length < nebenkostenPayments.length && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setNebenkostenPage(p => p + 1)}
                          >
                            Weitere laden ({nebenkostenPayments.length - visibleNebenkosten.length} übrig)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nichtmiete section */}
                  {nichtmietePayments.length > 0 && (
                    <Collapsible open={nichtmieteOpen} onOpenChange={setNichtmieteOpen}>
                      <div className="mt-4">
                        <CollapsibleTrigger className="flex items-center gap-2 mb-3 pb-2 border-b w-full text-left hover:bg-accent/30 rounded px-1 -mx-1">
                          <div className="h-3 w-3 rounded-full bg-muted-foreground/40" />
                          <h4 className="font-semibold text-sm text-muted-foreground flex-1">
                            Nichtmiete ({nichtmietePayments.length})
                          </h4>
                          {nichtmieteOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-3">
                            {visibleNichtmiete.map(zahlung => (
                              <PaymentCard
                                key={zahlung.id}
                                zahlung={zahlung}
                                isNichtmiete={true}
                                isSelected={selectedZahlung === zahlung.id}
                                classification={classificationMap.get(zahlung.id)}
                                isExpanded={expandedPayments.has(zahlung.id)}
                                isDragging={draggingZahlungId === zahlung.id}
                                onToggleExpand={handleToggleExpand}
                                onAssign={handleAssign}
                                onRecategorize={handleRecategorize}
                                onDismiss={handleDismiss}
                                onPromote={handlePromote}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                assignPending={assignMutation.isPending}
                                recategorizePending={recategorizeNichtmieteMutation.isPending}
                                dismissPending={dismissNichtmieteMutation.isPending}
                                promotePending={promoteToNebenkostenMutation.isPending}
                              />
                            ))}
                            {visibleNichtmiete.length < nichtmietePayments.length && (
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setNichtmietePage(p => p + 1)}
                              >
                                Weitere laden ({nichtmietePayments.length - visibleNichtmiete.length} übrig)
                              </Button>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Immobilien */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Immobilien
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {immobilien?.map(immo => {
              const grouped = zahlungenByImmobilie[immo.id];
              const zahlungen = grouped?.zahlungen || [];
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
                      <div className="flex items-center gap-1.5">
                        {hasPayments && (
                          <Badge variant="secondary" className="text-xs">{zahlungen.length}</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title="Zur Immobilie (Nebenkosten-Tab)"
                          onClick={() => navigateToImmobilie(immo.id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isDropTarget && (
                    <div className="mx-3 mb-3 border-2 border-dashed border-primary rounded-lg p-3 text-center text-sm text-primary">
                      Hier ablegen
                    </div>
                  )}

                  {hasPayments && !isDropTarget && (
                    <CardContent className="pt-0 px-3 pb-3">
                      <div className="space-y-1.5">
                        {(expandedImmobilien.has(immo.id) ? zahlungen : zahlungen.slice(0, 3)).map((z: any) => (
                          <div
                            key={z.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, z.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "p-1.5 rounded border bg-card text-xs cursor-grab active:cursor-grabbing group",
                              draggingZahlungId === z.id && "opacity-50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
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
                            {expandedImmobilien.has(immo.id) && (
                              <div className="mt-1 pl-5 text-[11px] text-muted-foreground space-y-0.5">
                                <p>{format(new Date(z.buchungsdatum), 'dd.MM.yyyy', { locale: de })}</p>
                                {z.verwendungszweck && (
                                  <p className="truncate" title={z.verwendungszweck}>{z.verwendungszweck}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {zahlungen.length > 3 && (
                          <button
                            type="button"
                            className="w-full text-xs text-primary hover:underline text-center py-1 flex items-center justify-center gap-1"
                            onClick={() => toggleImmobilieExpanded(immo.id)}
                          >
                            {expandedImmobilien.has(immo.id) ? (
                              <><ChevronUp className="h-3 w-3" /> Weniger anzeigen</>
                            ) : (
                              <><ChevronDown className="h-3 w-3" /> +{zahlungen.length - 3} weitere anzeigen</>
                            )}
                          </button>
                        )}
                      </div>
                    </CardContent>
                  )}

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
