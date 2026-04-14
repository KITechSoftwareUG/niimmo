import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Euro,
  Loader2,
  Users,
  TrendingUp,
  Plus,
  Home,
  ArrowUp,
  ArrowDown,
  Receipt,
  Calculator,
  Ruler,
  Equal,
  Activity,
  Percent,
  Settings,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { KostenpositionModal } from "./KostenpositionModal";
import { NebenkostenArtenManager } from "./NebenkostenArtenManager";
import { NebenkostenZahlungenVerteiler } from "./NebenkostenZahlungenVerteiler";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

interface NebenkostenAbrechnungTabProps {
  immobilieId: string;
}

interface Nebenkostenart {
  id: string;
  name: string;
  verteilerschluessel_art: string;
  ist_umlagefaehig: boolean;
}

interface Kostenposition {
  id: string;
  nebenkostenart_id: string | null;
  gesamtbetrag: number;
  zeitraum_von: string;
  zeitraum_bis: string;
  bezeichnung: string | null;
  ist_umlagefaehig: boolean;
}

interface MieterKostenDetail {
  nebenkostenartName: string;
  verteilerschluessel: string;
  gesamtKosten: number;
  anteilProzent: number;
  anteilBetrag: number;
}

interface MieterMitVertrag {
  mieterId: string;
  mieterName: string;
  mietvertragId: string;
  einheitId: string;
  einheitName: string;
  betriebskostenVorauszahlung: number;
  startDatum: string | null;
  endeDatum: string | null;
  qm: number | null;
  anzahlPersonen: number;
  vorauszahlungenGesamt: number;
  kostenDetails: MieterKostenDetail[];
  kostenAnteilGesamt: number;
  saldo: number;
  zeitanteilFaktor: number;
  verbrauchsdaten?: {
    strom?: { einzug: number | null; auszug: number | null };
    gas?: { einzug: number | null; auszug: number | null };
    wasser?: { einzug: number | null; auszug: number | null };
  };
}

type VerteilungsModus = 'zeitanteilig' | 'zaehlerstaende' | 'kombiniert';

const VERTEILERSCHLUESSEL_ICONS: Record<string, typeof Ruler> = {
  qm: Ruler,
  personen: Users,
  verbrauch: Activity,
  gleich: Equal,
  individuell: Percent,
};

const VERTEILERSCHLUESSEL_LABELS: Record<string, string> = {
  qm: 'm²',
  personen: 'Pers.',
  verbrauch: 'Verbr.',
  gleich: 'Gleich',
  individuell: 'Ind.',
};

export function NebenkostenAbrechnungTab({ immobilieId }: NebenkostenAbrechnungTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<string>('zahlungen');
  const [abrechnungsjahr, setAbrechnungsjahr] = useState<number>(currentYear);
  const [kostenpositionModalOpen, setKostenpositionModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Kostenposition | null>(null);
  const [nebenkostenArtenOpen, setNebenkostenArtenOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [verteilungsModus, setVerteilungsModus] = useState<VerteilungsModus>('kombiniert');

  const abrechnungsStart = `${abrechnungsjahr}-01-01`;
  const abrechnungsEnde = `${abrechnungsjahr}-12-31`;

  // Fetch einheiten mit qm und Personenzahl
  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ['einheiten-abrechnung', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('id, zaehler, qm, einheitentyp, anzahl_personen')
        .eq('immobilie_id', immobilieId);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch mietverträge mit mieter für das Jahr
  const { data: mietvertraege, isLoading: mietvertraegeLoading } = useQuery({
    queryKey: ['mietvertraege-abrechnung', immobilieId, abrechnungsjahr],
    queryFn: async () => {
      const einheitIds = einheiten?.map(e => e.id) || [];
      if (einheitIds.length === 0) return [];

      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          einheit_id,
          betriebskosten,
          start_datum,
          ende_datum,
          status,
          mietvertrag_mieter (
            mieter:mieter_id (
              id,
              vorname,
              nachname
            )
          )
        `)
        .in('einheit_id', einheitIds)
        .or(`start_datum.lte.${abrechnungsEnde},start_datum.is.null`)
        .or(`ende_datum.gte.${abrechnungsStart},ende_datum.is.null`);

      if (error) throw error;
      return data || [];
    },
    enabled: !!einheiten && einheiten.length > 0,
  });

  // Fetch nebenkostenarten
  const { data: nebenkostenarten, isLoading: nebenkostenArtenLoading } = useQuery({
    queryKey: ['nebenkostenarten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nebenkostenarten')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('name');

      if (error) throw error;
      return (data || []) as Nebenkostenart[];
    },
  });

  // Fetch kostenpositionen für das Jahr
  const { data: kostenpositionen, isLoading: kostenLoading } = useQuery({
    queryKey: ['kostenpositionen-abrechnung', immobilieId, abrechnungsjahr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kostenpositionen')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .lte('zeitraum_von', abrechnungsEnde)
        .gte('zeitraum_bis', abrechnungsStart);

      if (error) throw error;
      return (data || []) as Kostenposition[];
    },
  });

  // Fetch zahlungen für manuelle Kostenposition-Erstellung
  const { data: zahlungen } = useQuery({
    queryKey: ['zahlungen-abrechnung', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .eq('kategorie', 'Nichtmiete');

      if (error) throw error;
      return data || [];
    },
  });

  // Berechne Bezugsgrößen
  const bezugsgroessen = useMemo(() => {
    if (!einheiten) return { qm: 0, personen: 0, einheiten: 0 };
    
    return {
      qm: einheiten.reduce((sum, e) => sum + (e.qm || 0), 0),
      personen: einheiten.reduce((sum, e) => sum + (e.anzahl_personen || 1), 0),
      einheiten: einheiten.length,
    };
  }, [einheiten]);

  // Kosten pro Nebenkostenart gruppieren
  const kostenProArt = useMemo(() => {
    if (!kostenpositionen || !nebenkostenarten) return new Map<string, number>();
    
    const map = new Map<string, number>();
    
    kostenpositionen.forEach(kp => {
      if (!kp.ist_umlagefaehig) return;
      
      const artId = kp.nebenkostenart_id || 'ohne_art';
      const current = map.get(artId) || 0;
      map.set(artId, current + kp.gesamtbetrag);
    });
    
    return map;
  }, [kostenpositionen, nebenkostenarten]);

  // Berechne Gesamtkosten
  const { gesamtKosten, umlagefaehigeKosten } = useMemo(() => {
    const gesamt = kostenpositionen?.reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
    const umlagefaehig = kostenpositionen?.filter(kp => kp.ist_umlagefaehig).reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
    return { gesamtKosten: gesamt, umlagefaehigeKosten: umlagefaehig };
  }, [kostenpositionen]);

  // Berechne Anteil für eine Einheit basierend auf Verteilerschlüssel
  const berechneAnteil = (
    einheit: { qm: number | null; anzahl_personen: number | null },
    verteilerschluessel: string
  ): number => {
    switch (verteilerschluessel) {
      case 'qm':
        return bezugsgroessen.qm > 0 ? ((einheit.qm || 0) / bezugsgroessen.qm) : 0;
      case 'personen':
        return bezugsgroessen.personen > 0 ? ((einheit.anzahl_personen || 1) / bezugsgroessen.personen) : 0;
      case 'gleich':
        return bezugsgroessen.einheiten > 0 ? (1 / bezugsgroessen.einheiten) : 0;
      case 'verbrauch':
        // Verbrauch würde spezielle Zählerdaten benötigen - fallback auf qm
        return bezugsgroessen.qm > 0 ? ((einheit.qm || 0) / bezugsgroessen.qm) : 0;
      case 'individuell':
        // Individuell würde manuelle Prozentsätze benötigen - fallback auf gleich
        return bezugsgroessen.einheiten > 0 ? (1 / bezugsgroessen.einheiten) : 0;
      default:
        return bezugsgroessen.qm > 0 ? ((einheit.qm || 0) / bezugsgroessen.qm) : 0;
    }
  };

  // Berechne Mieter mit detaillierten Kostenanteilen
  // Berechne Mieter mit detaillierten Kostenanteilen
  const mieterMitAnteilen: MieterMitVertrag[] = useMemo(() => {
    if (!mietvertraege || !einheiten || !nebenkostenarten) return [];

    // Gruppiere Mietverträge nach Einheit für zeitanteilige Berechnung
    const vertraegeProEinheit = new Map<string, typeof mietvertraege>();
    mietvertraege.forEach(mv => {
      const existing = vertraegeProEinheit.get(mv.einheit_id) || [];
      existing.push(mv);
      vertraegeProEinheit.set(mv.einheit_id, existing);
    });

    return mietvertraege.map(mv => {
      const einheit = einheiten.find(e => e.id === mv.einheit_id);
      const mieterData = mv.mietvertrag_mieter?.[0]?.mieter;
      const qm = einheit?.qm || 0;
      const anzahlPersonen = einheit?.anzahl_personen || 1;
      
      // Vorauszahlungen für das Jahr
      const monatlicheVorauszahlung = mv.betriebskosten || 0;
      
      // Zeitanteil berechnen (in Tagen)
      const mvStart = mv.start_datum ? new Date(mv.start_datum) : new Date(abrechnungsStart);
      const mvEnde = mv.ende_datum ? new Date(mv.ende_datum) : new Date(abrechnungsEnde);
      const jahresStart = new Date(abrechnungsStart);
      const jahresEnde = new Date(abrechnungsEnde);
      
      const effektivStart = mvStart > jahresStart ? mvStart : jahresStart;
      const effektivEnde = mvEnde < jahresEnde ? mvEnde : jahresEnde;
      
      // Tage im Abrechnungszeitraum
      const tageImZeitraum = Math.max(0, 
        Math.ceil((effektivEnde.getTime() - effektivStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      const tageImJahr = 365;
      const zeitanteilFaktor = tageImZeitraum / tageImJahr;
      
      const monate = Math.max(0, 
        (effektivEnde.getFullYear() - effektivStart.getFullYear()) * 12 +
        (effektivEnde.getMonth() - effektivStart.getMonth()) + 1
      );
      
      const vorauszahlungenGesamt = monatlicheVorauszahlung * monate;

      // Verbrauchsdaten aus dem Mietvertrag
      const verbrauchsdaten = {
        strom: { 
          einzug: (mv as any).strom_einzug, 
          auszug: (mv as any).strom_auszug 
        },
        gas: { 
          einzug: (mv as any).gas_einzug, 
          auszug: (mv as any).gas_auszug 
        },
        wasser: { 
          einzug: (mv as any).kaltwasser_einzug, 
          auszug: (mv as any).kaltwasser_auszug 
        },
      };
      
      // Kostenanteile pro Nebenkostenart berechnen
      const kostenDetails: MieterKostenDetail[] = [];
      let kostenAnteilGesamt = 0;

      // Anzahl der Mietverträge in dieser Einheit für dieses Jahr
      const vertraegeInEinheit = vertraegeProEinheit.get(mv.einheit_id) || [mv];
      const anzahlVertraegeInEinheit = vertraegeInEinheit.length;

      kostenProArt.forEach((kosten, artId) => {
        const art = artId !== 'ohne_art' ? nebenkostenarten.find(n => n.id === artId) : null;
        const schluessel = art?.verteilerschluessel_art || 'qm';
        
        // Basisanteil nach Verteilerschlüssel
        let basisAnteil = berechneAnteil({ qm, anzahl_personen: anzahlPersonen }, schluessel);
        
        // Modus-abhängige Anpassung
        let effektiverAnteil = basisAnteil;
        
        if (verteilungsModus === 'zeitanteilig') {
          // Immer zeitanteilig
          effektiverAnteil = basisAnteil * zeitanteilFaktor;
        } else if (verteilungsModus === 'zaehlerstaende') {
          // Versuche Verbrauch zu nutzen
          if (schluessel === 'verbrauch') {
            // Hier könnte man Zählerstände verwenden
            // Fallback auf zeitanteilig wenn keine Daten
            effektiverAnteil = basisAnteil * zeitanteilFaktor;
          } else {
            effektiverAnteil = basisAnteil;
          }
        } else {
          // Kombiniert: Bei mehreren Verträgen pro Einheit zeitanteilig, sonst normal
          if (anzahlVertraegeInEinheit > 1) {
            effektiverAnteil = basisAnteil * zeitanteilFaktor;
          } else {
            effektiverAnteil = basisAnteil;
          }
        }
        
        const betrag = kosten * effektiverAnteil;
        kostenAnteilGesamt += betrag;
        kostenDetails.push({
          nebenkostenartName: art?.name || 'Sonstige',
          verteilerschluessel: schluessel,
          gesamtKosten: kosten,
          anteilProzent: effektiverAnteil * 100,
          anteilBetrag: betrag,
        });
      });
      
      // Saldo: positiv = Nachzahlung, negativ = Guthaben
      const saldo = kostenAnteilGesamt - vorauszahlungenGesamt;

      const einheitName = einheit?.zaehler 
        ? `Einheit ${einheit.zaehler}` 
        : `Einheit ${(einheit?.id as string)?.slice(-2) || '??'}`;

      return {
        mieterId: mieterData?.id || '',
        mieterName: mieterData 
          ? `${mieterData.vorname} ${mieterData.nachname || ''}`.trim()
          : 'Unbekannt',
        mietvertragId: mv.id,
        einheitId: mv.einheit_id,
        einheitName,
        betriebskostenVorauszahlung: monatlicheVorauszahlung,
        startDatum: mv.start_datum,
        endeDatum: mv.ende_datum,
        qm,
        anzahlPersonen,
        vorauszahlungenGesamt,
        kostenDetails,
        kostenAnteilGesamt,
        saldo,
        zeitanteilFaktor,
        verbrauchsdaten,
      };
    });
  }, [mietvertraege, einheiten, nebenkostenarten, kostenProArt, bezugsgroessen, abrechnungsStart, abrechnungsEnde, verteilungsModus]);

  // Summen
  const gesamtVorauszahlungen = mieterMitAnteilen.reduce((sum, m) => sum + m.vorauszahlungenGesamt, 0);
  const gesamtSaldo = mieterMitAnteilen.reduce((sum, m) => sum + m.saldo, 0);

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
      queryClient.invalidateQueries({ queryKey: ['kostenpositionen-abrechnung', immobilieId, abrechnungsjahr] });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Die Kostenposition konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const isLoading = einheitenLoading || mietvertraegeLoading || kostenLoading || nebenkostenArtenLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="zahlungen" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Zahlungen verteilen
        </TabsTrigger>
        <TabsTrigger value="abrechnung" className="gap-2">
          <Calculator className="h-4 w-4" />
          Abrechnung
        </TabsTrigger>
      </TabsList>

      {/* Tab: Zahlungen verteilen */}
      <TabsContent value="zahlungen" className="mt-6">
        <NebenkostenZahlungenVerteiler immobilieId={immobilieId} />
      </TabsContent>

      {/* Tab: Abrechnung */}
      <TabsContent value="abrechnung" className="mt-6 space-y-6">
      {/* Header mit Jahresauswahl */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Nebenkostenabrechnung</h2>
                <p className="text-sm text-muted-foreground">
                  Abrechnungszeitraum: 01.01.{abrechnungsjahr} - 31.12.{abrechnungsjahr}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Jahr:</Label>
                <Select 
                  value={abrechnungsjahr.toString()} 
                  onValueChange={(v) => setAbrechnungsjahr(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Verteilung:</Label>
                <Select 
                  value={verteilungsModus} 
                  onValueChange={(v) => setVerteilungsModus(v as VerteilungsModus)}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kombiniert">
                      <span className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Kombiniert
                      </span>
                    </SelectItem>
                    <SelectItem value="zeitanteilig">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Zeitanteilig
                      </span>
                    </SelectItem>
                    <SelectItem value="zaehlerstaende">
                      <span className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Zählerstände
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Übersicht Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamtkosten</p>
                <p className="text-xl font-bold">{gesamtKosten.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Umlagefähig</p>
                <p className="text-xl font-bold">{umlagefaehigeKosten.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Euro className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vorauszahlungen</p>
                <p className="text-xl font-bold">{gesamtVorauszahlungen.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${gesamtSaldo > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                {gesamtSaldo > 0 ? (
                  <ArrowUp className="h-5 w-5 text-destructive" />
                ) : (
                  <ArrowDown className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamt-Saldo</p>
                <p className={`text-xl font-bold ${gesamtSaldo > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {gesamtSaldo > 0 ? '+' : ''}{gesamtSaldo.toFixed(2)} €
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nebenkostenarten Manager (Collapsible) */}
      <Collapsible open={nebenkostenArtenOpen} onOpenChange={setNebenkostenArtenOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Nebenkostenarten & Verteilerschlüssel
                </div>
                <Badge variant="outline">
                  {nebenkostenarten?.length || 0} Arten
                </Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <NebenkostenArtenManager
                immobilieId={immobilieId}
                nebenkostenarten={nebenkostenarten || []}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Linke Spalte: Mieter-Übersicht */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mieter & Abrechnungssaldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mieterMitAnteilen.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Keine aktiven Mietverträge im Abrechnungszeitraum.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] sm:h-[600px]">
                <div className="space-y-4">
                  {mieterMitAnteilen.map((mieter) => (
                    <div
                      key={mieter.mietvertragId}
                      className="p-4 border rounded-lg bg-card"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">{mieter.mieterName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Home className="h-3 w-3" />
                              {mieter.einheitName}
                            </span>
                            <span>•</span>
                            <span>{mieter.qm?.toFixed(0) || 0} m²</span>
                            <span>•</span>
                            <span>{mieter.anzahlPersonen} Pers.</span>
                            {mieter.zeitanteilFaktor < 1 && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-[10px] px-1 py-0 gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {(mieter.zeitanteilFaktor * 100).toFixed(0)}% Jahr
                                </Badge>
                              </>
                            )}
                          </div>
                          {/* Zeitraum anzeigen */}
                          <div className="text-xs text-muted-foreground mt-1">
                            {mieter.startDatum && format(new Date(mieter.startDatum), 'dd.MM.yy', { locale: de })}
                            {' - '}
                            {mieter.endeDatum 
                              ? format(new Date(mieter.endeDatum), 'dd.MM.yy', { locale: de })
                              : 'laufend'
                            }
                          </div>
                        </div>
                        <Badge 
                          variant={mieter.saldo > 0 ? "destructive" : "default"}
                        >
                          {mieter.saldo > 0 ? 'Nachzahlung' : 'Guthaben'}
                        </Badge>
                      </div>

                      {/* Verbrauchsdaten wenn vorhanden */}
                      {mieter.verbrauchsdaten && (
                        mieter.verbrauchsdaten.strom?.einzug !== null ||
                        mieter.verbrauchsdaten.gas?.einzug !== null ||
                        mieter.verbrauchsdaten.wasser?.einzug !== null
                      ) && (
                        <div className="mb-3 p-2 bg-muted/30 rounded text-xs">
                          <p className="text-muted-foreground mb-1 font-medium">Zählerstände:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {mieter.verbrauchsdaten?.strom?.einzug !== null && (
                              <div>
                                <span className="text-muted-foreground">Strom: </span>
                                <span>{mieter.verbrauchsdaten?.strom?.einzug}</span>
                                {mieter.verbrauchsdaten?.strom?.auszug !== null && (
                                  <span> → {mieter.verbrauchsdaten?.strom?.auszug}</span>
                                )}
                              </div>
                            )}
                            {mieter.verbrauchsdaten?.gas?.einzug !== null && (
                              <div>
                                <span className="text-muted-foreground">Gas: </span>
                                <span>{mieter.verbrauchsdaten?.gas?.einzug}</span>
                                {mieter.verbrauchsdaten?.gas?.auszug !== null && (
                                  <span> → {mieter.verbrauchsdaten?.gas?.auszug}</span>
                                )}
                              </div>
                            )}
                            {mieter.verbrauchsdaten?.wasser?.einzug !== null && (
                              <div>
                                <span className="text-muted-foreground">Wasser: </span>
                                <span>{mieter.verbrauchsdaten?.wasser?.einzug}</span>
                                {mieter.verbrauchsdaten?.wasser?.auszug !== null && (
                                  <span> → {mieter.verbrauchsdaten?.wasser?.auszug}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Kostenaufschlüsselung */}
                      {mieter.kostenDetails.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {mieter.kostenDetails.map((detail, idx) => {
                            const Icon = VERTEILERSCHLUESSEL_ICONS[detail.verteilerschluessel] || Ruler;
                            return (
                              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-0">
                                <div className="flex items-center gap-2">
                                  <Icon className="h-3 w-3 text-muted-foreground" />
                                  <span>{detail.nebenkostenartName}</span>
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    {VERTEILERSCHLUESSEL_LABELS[detail.verteilerschluessel] || detail.verteilerschluessel}
                                  </Badge>
                                </div>
                                <span className="font-medium">{detail.anteilBetrag.toFixed(2)} €</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Vorauszahlung</p>
                          <p className="font-medium">{mieter.vorauszahlungenGesamt.toFixed(2)} €</p>
                          <p className="text-xs text-muted-foreground">
                            ({mieter.betriebskostenVorauszahlung.toFixed(2)} €/Mon.)
                          </p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Kostenanteil</p>
                          <p className="font-medium">{mieter.kostenAnteilGesamt.toFixed(2)} €</p>
                        </div>
                        <div className={`p-2 rounded ${mieter.saldo > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className={`font-bold ${mieter.saldo > 0 ? 'text-destructive' : 'text-primary'}`}>
                            {mieter.saldo > 0 ? '+' : ''}{mieter.saldo.toFixed(2)} €
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Rechte Spalte: Kostenpositionen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Tatsächliche Kosten
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  setEditingPosition(null);
                  setKostenpositionModalOpen(true);
                }}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kostenpositionen && kostenpositionen.length > 0 ? (
              <ScrollArea className="h-[400px] sm:h-[600px]">
                <div className="space-y-2">
                  {kostenpositionen.map((kp) => {
                    const nebenkostenart = nebenkostenarten?.find(n => n.id === kp.nebenkostenart_id);
                    const Icon = nebenkostenart 
                      ? VERTEILERSCHLUESSEL_ICONS[nebenkostenart.verteilerschluessel_art] || Ruler
                      : Ruler;
                    
                    return (
                      <div
                        key={kp.id}
                        className="p-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {kp.bezeichnung || 'Ohne Bezeichnung'}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(kp.zeitraum_von), 'dd.MM.yy', { locale: de })}
                                {kp.zeitraum_von !== kp.zeitraum_bis && (
                                  <>
                                    {' - '}
                                    {format(new Date(kp.zeitraum_bis), 'dd.MM.yy', { locale: de })}
                                  </>
                                )}
                              </span>
                              {nebenkostenart && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Icon className="h-3 w-3" />
                                  {nebenkostenart.name}
                                </Badge>
                              )}
                              {!kp.ist_umlagefaehig && (
                                <Badge variant="secondary" className="text-xs">
                                  Nicht umlagefähig
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-primary whitespace-nowrap">
                              {kp.gesamtbetrag.toFixed(2)} €
                            </p>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditingPosition(kp);
                                  setKostenpositionModalOpen(true);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setDeleteId(kp.id);
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
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Noch keine Kostenpositionen für {abrechnungsjahr}.</p>
                <p className="text-xs mt-1">
                  Fügen Sie Kosten hinzu oder ordnen Sie Zahlungen unter Zahlungen zu.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4 gap-1"
                  onClick={() => {
                    setEditingPosition(null);
                    setKostenpositionModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Kostenposition hinzufügen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kostenposition Modal */}
      <KostenpositionModal
        open={kostenpositionModalOpen}
        onOpenChange={setKostenpositionModalOpen}
        immobilieId={immobilieId}
        nebenkostenarten={nebenkostenarten || []}
        zahlungen={zahlungen || []}
        editingPosition={editingPosition}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['kostenpositionen-abrechnung', immobilieId, abrechnungsjahr] });
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kostenposition löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Kostenposition wirklich löschen?
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
      </TabsContent>
    </Tabs>
  );
}
