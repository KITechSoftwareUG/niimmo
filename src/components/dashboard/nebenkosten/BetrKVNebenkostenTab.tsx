import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Euro,
  Loader2,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Calculator,
  FileText,
  ClipboardList,
} from "lucide-react";
import { NebenkostenStep1Zuordnung } from "./NebenkostenStep1Zuordnung";
import { NebenkostenStep2Verteilung } from "./NebenkostenStep2Verteilung";

interface BetrKVNebenkostenTabProps {
  immobilieId: string;
}

export function BetrKVNebenkostenTab({ immobilieId }: BetrKVNebenkostenTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeStep, setActiveStep] = useState<string>("step1");

  // Fetch zahlungen für Jahresauswahl
  const { data: zahlungen, isLoading: zahlungenLoading } = useQuery({
    queryKey: ["immobilie-nebenkosten-zahlungen", immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zahlungen")
        .select("buchungsdatum")
        .eq("immobilie_id", immobilieId);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch kostenpositionen für Statistik
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

  // Verfügbare Jahre
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    zahlungen?.forEach((z) => years.add(new Date(z.buchungsdatum).getFullYear()));
    years.add(currentYear);
    years.add(currentYear - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [zahlungen, currentYear]);

  // Statistiken
  const stats = useMemo(() => {
    const yearPayments = zahlungen?.filter((z) => new Date(z.buchungsdatum).getFullYear() === selectedYear) || [];
    const assignedIds = new Set(kostenpositionen?.map((kp) => kp.zahlung_id).filter(Boolean));
    const unassigned = yearPayments.filter((z) => !assignedIds.has((z as any).id));
    
    const totalUmlagefaehig = kostenpositionen?.filter((kp) => kp.ist_umlagefaehig).reduce((s, kp) => s + kp.gesamtbetrag, 0) || 0;
    const totalNichtUmlagefaehig = kostenpositionen?.filter((kp) => !kp.ist_umlagefaehig).reduce((s, kp) => s + kp.gesamtbetrag, 0) || 0;

    return {
      unassignedCount: unassigned.length,
      assignedCount: kostenpositionen?.length || 0,
      totalUmlagefaehig,
      totalNichtUmlagefaehig,
    };
  }, [zahlungen, kostenpositionen, selectedYear]);

  if (zahlungenLoading || kostenLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Nebenkostenabrechnung</h2>
          <p className="text-muted-foreground">
            Nach BetrKV § 2 - Betriebskostenverordnung
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[160px] bg-background">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  Abrechnungsjahr {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistik-Übersicht */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Noch offen</p>
                <p className="text-2xl font-bold text-blue-800">{stats.unassignedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Zugeordnet</p>
                <p className="text-2xl font-bold text-green-800">{stats.assignedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Euro className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm text-emerald-700 font-medium">Umlagefähig</p>
                <p className="text-2xl font-bold text-emerald-800">{stats.totalUmlagefaehig.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Euro className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-sm text-amber-700 font-medium">Nicht umlagefähig</p>
                <p className="text-2xl font-bold text-amber-800">{stats.totalNichtUmlagefaehig.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zwei-Schritte-Tabs */}
      <Tabs value={activeStep} onValueChange={setActiveStep} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted">
          <TabsTrigger
            value="step1"
            className="flex items-center gap-3 py-4 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
              1
            </div>
            <div className="text-left">
              <p className="font-semibold">Zahlungen zuordnen</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Zahlungen den Nebenkostenarten zuweisen
              </p>
            </div>
            {stats.unassignedCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {stats.unassignedCount} offen
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="step2"
            className="flex items-center gap-3 py-4 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
              2
            </div>
            <div className="text-left">
              <p className="font-semibold">Kosten verteilen</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Auf Einheiten & Mietverträge aufteilen
              </p>
            </div>
            {stats.assignedCount > 0 && (
              <Badge variant="default" className="ml-auto bg-green-600">
                {stats.assignedCount} Positionen
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Schritt 1: Zuordnung */}
        <TabsContent value="step1" className="mt-6">
          <NebenkostenStep1Zuordnung
            immobilieId={immobilieId}
            selectedYear={selectedYear}
          />
        </TabsContent>

        {/* Schritt 2: Verteilung */}
        <TabsContent value="step2" className="mt-6">
          <NebenkostenStep2Verteilung
            immobilieId={immobilieId}
            selectedYear={selectedYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
