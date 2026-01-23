import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Users,
  TrendingUp,
  TrendingDown,
  Plus,
  FileText,
  Home,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Receipt,
  Calculator,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { KostenpositionModal } from "./KostenpositionModal";

interface NebenkostenAbrechnungTabProps {
  immobilieId: string;
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
  anteilProzent: number;
  vorauszahlungenGesamt: number;
  kostenAnteil: number;
  saldo: number;
}

export function NebenkostenAbrechnungTab({ immobilieId }: NebenkostenAbrechnungTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [abrechnungsjahr, setAbrechnungsjahr] = useState<number>(currentYear);
  const [kostenpositionModalOpen, setKostenpositionModalOpen] = useState(false);

  const abrechnungsStart = `${abrechnungsjahr}-01-01`;
  const abrechnungsEnde = `${abrechnungsjahr}-12-31`;

  // Fetch einheiten mit qm
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
      return data || [];
    },
  });

  // Fetch nebenkostenarten
  const { data: nebenkostenarten } = useQuery({
    queryKey: ['nebenkostenarten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nebenkostenarten')
        .select('*')
        .eq('immobilie_id', immobilieId);

      if (error) throw error;
      return data || [];
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

  // Berechne Gesamtfläche
  const gesamtQm = useMemo(() => {
    return einheiten?.reduce((sum, e) => sum + (e.qm || 0), 0) || 0;
  }, [einheiten]);

  // Berechne Gesamtkosten (umlagefähig)
  const { gesamtKosten, umlagefaehigeKosten } = useMemo(() => {
    const gesamt = kostenpositionen?.reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
    const umlagefaehig = kostenpositionen?.filter(kp => kp.ist_umlagefaehig).reduce((sum, kp) => sum + kp.gesamtbetrag, 0) || 0;
    return { gesamtKosten: gesamt, umlagefaehigeKosten: umlagefaehig };
  }, [kostenpositionen]);

  // Berechne Mieter mit Anteilen
  const mieterMitAnteilen: MieterMitVertrag[] = useMemo(() => {
    if (!mietvertraege || !einheiten) return [];

    return mietvertraege.map(mv => {
      const einheit = einheiten.find(e => e.id === mv.einheit_id);
      const mieterData = mv.mietvertrag_mieter?.[0]?.mieter;
      const qm = einheit?.qm || 0;
      
      // Anteil basierend auf qm
      const anteilProzent = gesamtQm > 0 ? (qm / gesamtQm) * 100 : 0;
      
      // Vorauszahlungen für das Jahr (12 Monate * monatliche Vorauszahlung)
      const monatlicheVorauszahlung = mv.betriebskosten || 0;
      
      // Zeitanteil berechnen (wie viele Monate war der Mieter da?)
      const mvStart = mv.start_datum ? new Date(mv.start_datum) : new Date(abrechnungsStart);
      const mvEnde = mv.ende_datum ? new Date(mv.ende_datum) : new Date(abrechnungsEnde);
      const jahresStart = new Date(abrechnungsStart);
      const jahresEnde = new Date(abrechnungsEnde);
      
      const effektivStart = mvStart > jahresStart ? mvStart : jahresStart;
      const effektivEnde = mvEnde < jahresEnde ? mvEnde : jahresEnde;
      
      // Monate im Abrechnungszeitraum
      const monate = Math.max(0, 
        (effektivEnde.getFullYear() - effektivStart.getFullYear()) * 12 +
        (effektivEnde.getMonth() - effektivStart.getMonth()) + 1
      );
      
      const vorauszahlungenGesamt = monatlicheVorauszahlung * monate;
      
      // Kostenanteil
      const kostenAnteil = umlagefaehigeKosten * (anteilProzent / 100);
      
      // Saldo: positiv = Nachzahlung, negativ = Guthaben
      const saldo = kostenAnteil - vorauszahlungenGesamt;

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
        anteilProzent,
        vorauszahlungenGesamt,
        kostenAnteil,
        saldo,
      };
    });
  }, [mietvertraege, einheiten, gesamtQm, umlagefaehigeKosten, abrechnungsStart, abrechnungsEnde]);

  // Summen
  const gesamtVorauszahlungen = mieterMitAnteilen.reduce((sum, m) => sum + m.vorauszahlungenGesamt, 0);
  const gesamtSaldo = mieterMitAnteilen.reduce((sum, m) => sum + m.saldo, 0);

  const isLoading = einheitenLoading || mietvertraegeLoading || kostenLoading;

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
            
            <div className="flex items-center gap-3">
              <Label className="text-sm">Jahr:</Label>
              <Select 
                value={abrechnungsjahr.toString()} 
                onValueChange={(v) => setAbrechnungsjahr(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Übersicht Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
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
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
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
              <div className="p-2 bg-purple-100 rounded-lg">
                <Euro className="h-5 w-5 text-purple-600" />
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
              <div className={`p-2 rounded-lg ${gesamtSaldo > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                {gesamtSaldo > 0 ? (
                  <ArrowUp className="h-5 w-5 text-red-600" />
                ) : (
                  <ArrowDown className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamt-Saldo</p>
                <p className={`text-xl font-bold ${gesamtSaldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {gesamtSaldo > 0 ? '+' : ''}{gesamtSaldo.toFixed(2)} €
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Spalte: Mieter-Übersicht */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mieter & Vorauszahlungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mieterMitAnteilen.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Keine aktiven Mietverträge im Abrechnungszeitraum.</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {mieterMitAnteilen.map((mieter) => (
                    <div
                      key={mieter.mietvertragId}
                      className="p-4 border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">{mieter.mieterName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Home className="h-3 w-3" />
                            <span>{mieter.einheitName}</span>
                            <span>•</span>
                            <span>{mieter.qm?.toFixed(0) || 0} m²</span>
                            <span>•</span>
                            <span>{mieter.anteilProzent.toFixed(1)}%</span>
                          </div>
                        </div>
                        <Badge 
                          variant={mieter.saldo > 0 ? "destructive" : "default"}
                          className={mieter.saldo <= 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                        >
                          {mieter.saldo > 0 ? 'Nachzahlung' : 'Guthaben'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Vorauszahlung</p>
                          <p className="font-medium">{mieter.vorauszahlungenGesamt.toFixed(2)} €</p>
                          <p className="text-xs text-muted-foreground">
                            ({mieter.betriebskostenVorauszahlung.toFixed(2)} €/Monat)
                          </p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">Kostenanteil</p>
                          <p className="font-medium">{mieter.kostenAnteil.toFixed(2)} €</p>
                        </div>
                        <div className={`p-2 rounded ${mieter.saldo > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className={`font-bold ${mieter.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
                onClick={() => setKostenpositionModalOpen(true)}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kostenpositionen && kostenpositionen.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {kostenpositionen.map((kp) => {
                    const nebenkostenart = nebenkostenarten?.find(n => n.id === kp.nebenkostenart_id);
                    
                    return (
                      <div
                        key={kp.id}
                        className="p-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {kp.bezeichnung || 'Ohne Bezeichnung'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
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
                                <Badge variant="outline" className="text-xs">
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
                          <p className="font-bold text-primary whitespace-nowrap ml-2">
                            {kp.gesamtbetrag.toFixed(2)} €
                          </p>
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
                  Fügen Sie Kosten hinzu, um die Abrechnung zu erstellen.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4 gap-1"
                  onClick={() => setKostenpositionModalOpen(true)}
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
        editingPosition={null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['kostenpositionen-abrechnung', immobilieId, abrechnungsjahr] });
        }}
      />
    </div>
  );
}
