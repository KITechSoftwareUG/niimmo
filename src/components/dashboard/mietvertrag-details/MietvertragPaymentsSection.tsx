import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateMietvertragRueckstand } from "@/utils/rueckstandsberechnung";
import { MietvertragTimelineView } from "./MietvertragTimelineView";
import { Plus, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";

interface MietvertragPaymentsSectionProps {
  vertrag: any;
  forderungen: any[];
  zahlungen: any[];
  allMietvertraege?: any[];
  vertragId: string;
  formatBetrag: (betrag: number) => string;
  formatDatum: (datum: string) => string;
  onCreateForderung: () => void;
}

export function MietvertragPaymentsSection({
  vertrag,
  forderungen,
  zahlungen,
  allMietvertraege,
  vertragId,
  formatBetrag,
  formatDatum,
  onCreateForderung
}: MietvertragPaymentsSectionProps) {

  const rueckstandsBerechnung = calculateMietvertragRueckstand(
    vertrag, 
    forderungen || [], 
    zahlungen || []
  );
  
  const { gesamtForderungen, gesamtZahlungen, rueckstand } = rueckstandsBerechnung;
  
  // Berechne Fälligkeitsinformationen
  const heute = new Date();
  const mietvertragStart = vertrag?.start_datum ? new Date(vertrag.start_datum) : new Date('2025-01-01');
  const startDatum = mietvertragStart > new Date('2025-01-01') ? mietvertragStart : new Date('2025-01-01');
  
  const alleForderungenAbStart = (forderungen || []).filter(f => {
    if (!f.sollmonat) return false;
    const forderungsDatum = new Date(f.sollmonat + '-01');
    return forderungsDatum >= startDatum;
  });
  
  const faelligeForderungen = alleForderungenAbStart.filter(f => f.ist_faellig === true);
  const nichtFaelligeForderungen = alleForderungenAbStart.filter(f => f.ist_faellig !== true);
  
  const faelligeForderungenBetrag = faelligeForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
  const nichtFaelligeForderungenBetrag = nichtFaelligeForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);

  return (
    <>
      {/* Overview Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Finanzübersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fällige Forderungen */}
            <div className={`metric-card p-6 rounded-xl transition-all duration-300 hover:scale-[1.02] ${
              faelligeForderungenBetrag > 0 
                ? 'border-destructive/20 bg-gradient-to-br from-destructive/5 via-destructive/3 to-transparent' 
                : 'border-muted bg-gradient-to-br from-muted/50 to-transparent'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${faelligeForderungenBetrag > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                  <AlertCircle className={`h-5 w-5 ${faelligeForderungenBetrag > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {faelligeForderungen.length} Forderung{faelligeForderungen.length !== 1 ? 'en' : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-sm font-medium ${faelligeForderungenBetrag > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  Fällige Forderungen
                </p>
                <p className={`text-2xl font-bold ${faelligeForderungenBetrag > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {formatBetrag(faelligeForderungenBetrag)}
                </p>
              </div>
            </div>

            {/* Geleistete Zahlungen */}
            <div className="metric-card p-6 rounded-xl transition-all duration-300 hover:scale-[1.02] border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Eingegangen
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">Geleistete Zahlungen</p>
                <p className="text-2xl font-bold text-primary">
                  {formatBetrag(gesamtZahlungen)}
                </p>
              </div>
            </div>

            {/* Rückstand */}
            <div className={`metric-card p-6 rounded-xl transition-all duration-300 hover:scale-[1.02] ${
              rueckstand > 0 
                ? 'border-yellow-400/30 bg-gradient-to-br from-yellow-50/80 via-yellow-25/40 to-transparent' 
                : 'border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${rueckstand > 0 ? 'bg-yellow-100' : 'bg-primary/10'}`}>
                  <TrendingDown className={`h-5 w-5 ${rueckstand > 0 ? 'text-yellow-600' : 'text-primary'}`} />
                </div>
                {nichtFaelligeForderungenBetrag > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-primary">
                      + {formatBetrag(nichtFaelligeForderungenBetrag)} noch nicht fällig
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className={`text-sm font-medium ${rueckstand > 0 ? 'text-yellow-700' : 'text-primary'}`}>
                  {rueckstand > 0 ? 'Rückstand' : 'Kein Rückstand'}
                </p>
                <p className={`text-2xl font-bold ${rueckstand > 0 ? 'text-yellow-800' : 'text-primary'}`}>
                  {formatBetrag(Math.abs(rueckstand))}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Section */}
      <Card className="elegant-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Zahlungen & Forderungen Timeline</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateForderung}
              className="modern-button-ghost hover:bg-primary/5 hover:border-primary/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Forderung erstellen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <MietvertragTimelineView
            forderungen={forderungen}
            zahlungen={zahlungen}
            allMietvertraege={allMietvertraege}
            vertragId={vertragId}
            formatDatum={formatDatum}
            formatBetrag={formatBetrag}
          />
        </CardContent>
      </Card>
    </>
  );
}