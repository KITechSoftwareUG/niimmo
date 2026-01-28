import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Euro,
  Loader2,
  ChevronDown,
  ChevronRight,
  Building2,
  Droplets,
  Flame,
  Zap,
  Trash2,
  TreePine,
  Shield,
  User,
  Tv,
  WashingMachine,
  MoreHorizontal,
  Wrench,
  Home,
  Calendar,
  GripVertical,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { BetrKVKategorieCard } from "./BetrKVKategorieCard";

interface BetrKVNebenkostenTabProps {
  immobilieId: string;
}

// BetrKV § 2 - 17 umlagefähige Nebenkostenarten
export const BETRKV_KATEGORIEN = [
  { id: "grundsteuer", name: "Grundsteuer", icon: Building2, beschreibung: "Laufende öffentliche Lasten des Grundstücks", umlagefaehig: true },
  { id: "wasserversorgung", name: "Wasserversorgung", icon: Droplets, beschreibung: "Kosten des Wasserverbrauchs, Grundgebühren, Eichung von Wasserzählern", umlagefaehig: true },
  { id: "entwaesserung", name: "Entwässerung", icon: Droplets, beschreibung: "Kosten der Abwasserentsorgung (Kanalisation)", umlagefaehig: true },
  { id: "heizkosten", name: "Heizkosten", icon: Flame, beschreibung: "Kosten der zentralen Heizungsanlage (Brennstoff, Strom)", umlagefaehig: true },
  { id: "warmwasserkosten", name: "Warmwasserkosten", icon: Flame, beschreibung: "Kosten der zentralen Warmwasserversorgung", umlagefaehig: true },
  { id: "verbundene_anlagen", name: "Verbundene Heizungs-/Warmwasseranlagen", icon: Flame, beschreibung: "Kosten, wenn Anlagen Heizung und Warmwasser gleichzeitig erzeugen", umlagefaehig: true },
  { id: "aufzug", name: "Aufzug", icon: Building2, beschreibung: "Betriebsstrom, Beaufsichtigung, Bedienung, Überwachung, Reinigung, Wartung", umlagefaehig: true },
  { id: "strassenreinigung_muell", name: "Straßenreinigung & Müllbeseitigung", icon: Trash2, beschreibung: "Gebühren für Müllabfuhr, Sperrmüll, Straßenreinigung", umlagefaehig: true },
  { id: "gebaeudereinigung", name: "Gebäudereinigung & Ungezieferbekämpfung", icon: Home, beschreibung: "Reinigung von Flur, Hof, Waschküche; Kosten der Ungezieferbekämpfung", umlagefaehig: true },
  { id: "gartenpflege", name: "Gartenpflege", icon: TreePine, beschreibung: "Pflege von Gärten, Spielplätzen, einschließlich maschineller Einrichtungen", umlagefaehig: true },
  { id: "beleuchtung", name: "Beleuchtung", icon: Zap, beschreibung: "Strom für Außenbeleuchtung, Treppenhaus, Keller", umlagefaehig: true },
  { id: "schornsteinreinigung", name: "Schornsteinreinigung", icon: Flame, beschreibung: "Kehrgebühren, Emissionsmessungen", umlagefaehig: true },
  { id: "versicherungen", name: "Versicherungen", icon: Shield, beschreibung: "Sach- und Haftpflichtversicherungen (Gebäude, Feuer, Wasser, Aufzug)", umlagefaehig: true },
  { id: "hauswart", name: "Hauswart", icon: User, beschreibung: "Vergütung, Sozialbeiträge (nur für erlaubte Arbeiten)", umlagefaehig: true },
  { id: "antenne_kabel", name: "Antenne/Kabel", icon: Tv, beschreibung: "Betrieb der Gemeinschafts-Antennenanlage oder Breitbandkabelanschluss", umlagefaehig: true },
  { id: "waeschepflege", name: "Wäschepflege", icon: WashingMachine, beschreibung: "Kosten für gemeinschaftliche Waschmaschinen/Trockner", umlagefaehig: true },
  { id: "sonstige_betriebskosten", name: "Sonstige Betriebskosten", icon: MoreHorizontal, beschreibung: "Nur umlagefähig wenn vertraglich vereinbart", umlagefaehig: true },
];

// Nicht umlagefähige Kostenarten
export const NICHT_UMLAGEFAEHIGE_KATEGORIEN = [
  { id: "reparaturen", name: "Reparaturen", icon: Wrench, beschreibung: "Instandhaltungskosten", umlagefaehig: false },
  { id: "wartungen", name: "Wartungen zur Instandsetzung", icon: Wrench, beschreibung: "Wartungskosten", umlagefaehig: false },
  { id: "bankgebuehren", name: "Bankgebühren", icon: Euro, beschreibung: "Kontoführung, Porto", umlagefaehig: false },
  { id: "hausverwaltung", name: "Hausverwaltung", icon: Building2, beschreibung: "Verwaltungskosten", umlagefaehig: false },
];

export function BetrKVNebenkostenTab({ immobilieId }: BetrKVNebenkostenTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [draggedPayment, setDraggedPayment] = useState<string | null>(null);

  // Fetch zahlungen für diese Immobilie
  const { data: zahlungen, isLoading: zahlungenLoading } = useQuery({
    queryKey: ["immobilie-nebenkosten-zahlungen", immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zahlungen")
        .select("*")
        .eq("immobilie_id", immobilieId)
        .order("buchungsdatum", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch einheiten für Verteilung
  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ["einheiten-betrkv", immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("einheiten")
        .select("id, zaehler, qm, anzahl_personen, einheitentyp")
        .eq("immobilie_id", immobilieId);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch kostenpositionen
  const { data: kostenpositionen, isLoading: kostenLoading } = useQuery({
    queryKey: ["kostenpositionen-betrkv", immobilieId, selectedYear],
    queryFn: async () => {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data, error } = await supabase
        .from("kostenpositionen")
        .select("*")
        .eq("immobilie_id", immobilieId)
        .gte("zeitraum_von", yearStart)
        .lte("zeitraum_bis", yearEnd);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch nebenkostenarten für mapping
  const { data: nebenkostenarten } = useQuery({
    queryKey: ["nebenkostenarten-betrkv", immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nebenkostenarten")
        .select("*")
        .eq("immobilie_id", immobilieId);

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation für Kostenposition erstellen
  const createKostenpositionMutation = useMutation({
    mutationFn: async ({
      zahlungId,
      kategorieId,
      betrag,
      bezeichnung,
      istUmlagefaehig,
    }: {
      zahlungId: string;
      kategorieId: string;
      betrag: number;
      bezeichnung: string;
      istUmlagefaehig: boolean;
    }) => {
      // Finde oder erstelle die Nebenkostenart
      let nebenkostenartId = nebenkostenarten?.find(
        (n) => n.name.toLowerCase().includes(kategorieId.replace(/_/g, " "))
      )?.id;

      if (!nebenkostenartId) {
        const kategorie = [...BETRKV_KATEGORIEN, ...NICHT_UMLAGEFAEHIGE_KATEGORIEN].find(
          (k) => k.id === kategorieId
        );
        if (kategorie) {
          const { data: newArt, error: artError } = await supabase
            .from("nebenkostenarten")
            .insert({
              immobilie_id: immobilieId,
              name: kategorie.name,
              ist_umlagefaehig: kategorie.umlagefaehig,
              verteilerschluessel_art: "qm",
            })
            .select()
            .single();

          if (artError) throw artError;
          nebenkostenartId = newArt.id;
        }
      }

      // Hole Zahlung für Datum
      const zahlung = zahlungen?.find((z) => z.id === zahlungId);
      const buchungsdatum = zahlung?.buchungsdatum || new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("kostenpositionen").insert({
        immobilie_id: immobilieId,
        zahlung_id: zahlungId,
        nebenkostenart_id: nebenkostenartId,
        gesamtbetrag: Math.abs(betrag),
        zeitraum_von: buchungsdatum,
        zeitraum_bis: buchungsdatum,
        bezeichnung,
        ist_umlagefaehig: istUmlagefaehig,
        quelle: "zahlung",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Zugeordnet",
        description: "Die Zahlung wurde der Kategorie zugeordnet.",
      });
      queryClient.invalidateQueries({ queryKey: ["kostenpositionen-betrkv", immobilieId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["nebenkostenarten-betrkv", immobilieId] });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Zuordnung fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  // Gruppiere Zahlungen nach Jahr
  const zahlungenByYear = useMemo(() => {
    if (!zahlungen) return {};
    const grouped: Record<number, typeof zahlungen> = {};

    zahlungen.forEach((z) => {
      const year = new Date(z.buchungsdatum).getFullYear();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(z);
    });

    return grouped;
  }, [zahlungen]);

  // Zahlungen für das ausgewählte Jahr, die noch keiner Kostenposition zugeordnet sind
  const unassignedZahlungen = useMemo(() => {
    const yearPayments = zahlungenByYear[selectedYear] || [];
    const assignedIds = new Set(kostenpositionen?.map((kp) => kp.zahlung_id).filter(Boolean));
    return yearPayments.filter((z) => !assignedIds.has(z.id));
  }, [zahlungenByYear, selectedYear, kostenpositionen]);

  // Kostenpositionen pro Kategorie gruppieren
  const kostenProKategorie = useMemo(() => {
    const map = new Map<string, typeof kostenpositionen>();

    kostenpositionen?.forEach((kp) => {
      const art = nebenkostenarten?.find((n) => n.id === kp.nebenkostenart_id);
      const kategorieId = art
        ? BETRKV_KATEGORIEN.find((k) =>
            art.name.toLowerCase().includes(k.id.replace(/_/g, " ")) ||
            k.name.toLowerCase() === art.name.toLowerCase()
          )?.id || "sonstige_betriebskosten"
        : "sonstige_betriebskosten";

      const existing = map.get(kategorieId) || [];
      existing.push(kp);
      map.set(kategorieId, existing);
    });

    return map;
  }, [kostenpositionen, nebenkostenarten]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, zahlungId: string) => {
    e.dataTransfer.setData("zahlungId", zahlungId);
    setDraggedPayment(zahlungId);
  };

  const handleDragEnd = () => {
    setDraggedPayment(null);
  };

  const handleDrop = (e: React.DragEvent, kategorieId: string, istUmlagefaehig: boolean) => {
    e.preventDefault();
    const zahlungId = e.dataTransfer.getData("zahlungId");
    if (!zahlungId) return;

    const zahlung = zahlungen?.find((z) => z.id === zahlungId);
    if (!zahlung) return;

    const kategorie = [...BETRKV_KATEGORIEN, ...NICHT_UMLAGEFAEHIGE_KATEGORIEN].find(
      (k) => k.id === kategorieId
    );

    createKostenpositionMutation.mutate({
      zahlungId,
      kategorieId,
      betrag: zahlung.betrag,
      bezeichnung: zahlung.verwendungszweck || zahlung.empfaengername || kategorie?.name || "Kostenposition",
      istUmlagefaehig,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const toggleCategory = (kategorieId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(kategorieId)) {
        next.delete(kategorieId);
      } else {
        next.add(kategorieId);
      }
      return next;
    });
  };

  // Verfügbare Jahre
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    zahlungen?.forEach((z) => years.add(new Date(z.buchungsdatum).getFullYear()));
    // Füge aktuelle und letztes Jahr hinzu falls nicht vorhanden
    years.add(currentYear);
    years.add(currentYear - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [zahlungen, currentYear]);

  // Berechne Gesamtsummen
  const totalUmlagefaehig = useMemo(() => {
    return kostenpositionen?.filter((kp) => kp.ist_umlagefaehig).reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
  }, [kostenpositionen]);

  const totalNichtUmlagefaehig = useMemo(() => {
    return kostenpositionen?.filter((kp) => !kp.ist_umlagefaehig).reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
  }, [kostenpositionen]);

  const isLoading = zahlungenLoading || einheitenLoading || kostenLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Jahresauswahl */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Nebenkostenabrechnung nach BetrKV § 2</h2>
          <p className="text-sm text-muted-foreground">
            Zahlungen den 17 Nebenkostenarten zuordnen und auf Einheiten verteilen
          </p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Statistik-Übersicht */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <p className="text-sm text-green-700">Umlagefähig</p>
            <p className="text-2xl font-bold text-green-800">{totalUmlagefaehig.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700">Nicht umlagefähig</p>
            <p className="text-2xl font-bold text-amber-800">{totalNichtUmlagefaehig.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-700">Noch zuzuordnen</p>
            <p className="text-2xl font-bold text-blue-800">{unassignedZahlungen.length} Zahlungen</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte: Nicht zugeordnete Zahlungen */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Zahlungen {selectedYear}
              <Badge variant="secondary">{unassignedZahlungen.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 pr-2">
                {unassignedZahlungen.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Alle Zahlungen für {selectedYear} wurden zugeordnet
                  </p>
                ) : (
                  unassignedZahlungen.map((zahlung) => (
                    <div
                      key={zahlung.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, zahlung.id)}
                      onDragEnd={handleDragEnd}
                      className={`p-3 border rounded-lg bg-card cursor-grab active:cursor-grabbing transition-all ${
                        draggedPayment === zahlung.id ? "opacity-50 ring-2 ring-primary" : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">
                              {zahlung.empfaengername || "Unbekannt"}
                            </p>
                            <span className={`text-sm font-bold ${zahlung.betrag >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {zahlung.betrag.toFixed(2)} €
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {zahlung.verwendungszweck || "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(zahlung.buchungsdatum), "dd.MM.yyyy", { locale: de })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Rechte Spalte: BetrKV Kategorien */}
        <div className="lg:col-span-2 space-y-4">
          {/* Umlagefähige Kosten (BetrKV § 2) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-700">
                Umlagefähige Betriebskosten (BetrKV § 2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2 pr-2">
                  {BETRKV_KATEGORIEN.map((kategorie) => {
                    const positionen = kostenProKategorie.get(kategorie.id) || [];
                    const total = positionen.reduce((sum, kp) => sum + kp.gesamtbetrag, 0);
                    const isExpanded = expandedCategories.has(kategorie.id);
                    const Icon = kategorie.icon;

                    return (
                      <BetrKVKategorieCard
                        key={kategorie.id}
                        kategorie={kategorie}
                        positionen={positionen}
                        total={total}
                        isExpanded={isExpanded}
                        einheiten={einheiten || []}
                        onToggle={() => toggleCategory(kategorie.id)}
                        onDrop={(e) => handleDrop(e, kategorie.id, true)}
                        onDragOver={handleDragOver}
                        immobilieId={immobilieId}
                        selectedYear={selectedYear}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Nicht umlagefähige Kosten */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-700">
                Nicht umlagefähige Kosten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {NICHT_UMLAGEFAEHIGE_KATEGORIEN.map((kategorie) => {
                  const positionen = kostenProKategorie.get(kategorie.id) || [];
                  const total = positionen.reduce((sum, kp) => sum + kp.gesamtbetrag, 0);
                  const Icon = kategorie.icon;

                  return (
                    <div
                      key={kategorie.id}
                      onDrop={(e) => handleDrop(e, kategorie.id, false)}
                      onDragOver={handleDragOver}
                      className="p-3 border-2 border-dashed border-amber-200 rounded-lg bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium">{kategorie.name}</span>
                          {positionen.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {positionen.length}
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-bold text-amber-700">
                          {total.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
