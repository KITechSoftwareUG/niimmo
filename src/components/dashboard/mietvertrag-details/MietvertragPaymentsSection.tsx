import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { calculateMietvertragRueckstand } from "@/utils/rueckstandsberechnung";
import { MietvertragTimelineView } from "./MietvertragTimelineView";
import { Plus, TrendingDown, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

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
  
  const { gesamtForderungen, gesamtZahlungen, rueckstand, unbestaetigteLastschriften } = rueckstandsBerechnung;
  
  // Alle Forderungen verwenden - ohne Filterung nach Startdatum
  const alleForderungenAbStart = (forderungen || []).filter(f => {
    return f.sollmonat; // Nur Forderungen mit sollmonat
  });
  
  const heute = new Date();
  
  // Berechne Fälligkeit basierend auf tatsächlichem Datum (10. des Monats)
  const faelligeForderungen = alleForderungenAbStart.filter(f => {
    if (!f.sollmonat) return false;
    const [year, month] = f.sollmonat.split('-');
    const faelligkeitsdatum = new Date(parseInt(year), parseInt(month) - 1, 10);
    return faelligkeitsdatum <= heute;
  });
  const nichtFaelligeForderungen = alleForderungenAbStart.filter(f => {
    if (!f.sollmonat) return false;
    const [year, month] = f.sollmonat.split('-');
    const faelligkeitsdatum = new Date(parseInt(year), parseInt(month) - 1, 10);
    return faelligkeitsdatum > heute;
  });
  
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

            {/* Rückstand / Guthaben */}
            <div className={`metric-card p-6 rounded-xl transition-all duration-300 hover:scale-[1.02] ${
              rueckstand > 0 
                ? 'border-yellow-400/30 bg-gradient-to-br from-yellow-50/80 via-yellow-25/40 to-transparent' 
                : 'border-green-400/30 bg-gradient-to-br from-green-50/80 via-green-25/40 to-transparent'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${rueckstand > 0 ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  {rueckstand > 0 ? (
                    <TrendingDown className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
                {unbestaetigteLastschriften > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-orange-600">
                      {formatBetrag(unbestaetigteLastschriften)} unbestätigt
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className={`text-sm font-medium ${rueckstand > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                  {rueckstand > 0 ? 'Rückstand' : (rueckstand < 0 ? 'Guthaben' : 'Kein Rückstand')}
                </p>
                <p className={`text-2xl font-bold ${rueckstand > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                  {formatBetrag(Math.abs(rueckstand))}
                </p>
                {unbestaetigteLastschriften > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    Lastschrift unbestätigt - noch in Wartefrist
                  </p>
                )}
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
            <div className="flex items-center space-x-4">
              {/* Lastschrift Status */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Lastschrift:</span>
                <Switch 
                  checked={vertrag?.lastschrift || false} 
                  disabled={true}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                />
                <span className={`text-sm font-medium ${vertrag?.lastschrift ? 'text-primary' : 'text-muted-foreground'}`}>
                  {vertrag?.lastschrift ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
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
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <MietvertragTimelineView
            forderungen={forderungen}
            zahlungen={zahlungen}
            allMietvertraege={allMietvertraege}
            vertragId={vertragId}
            vertrag={vertrag}
            formatDatum={formatDatum}
            formatBetrag={formatBetrag}
          />
        </CardContent>
      </Card>
    </>
  );
}