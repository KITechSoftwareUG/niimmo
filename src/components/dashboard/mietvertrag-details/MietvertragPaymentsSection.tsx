import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateMietvertragRueckstand } from "@/utils/rueckstandsberechnung";
import { MietvertragTimelineView } from "./MietvertragTimelineView";
import { Plus } from "lucide-react";

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
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('list');

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
            <div className={`p-4 border rounded-lg ${faelligeForderungenBetrag > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex flex-col">
                <p className={`text-sm font-medium ${faelligeForderungenBetrag > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  Fällige Forderungen
                </p>
                <p className={`text-2xl font-bold mt-1 ${faelligeForderungenBetrag > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                  {formatBetrag(faelligeForderungenBetrag)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {faelligeForderungen.length} Forderung{faelligeForderungen.length !== 1 ? 'en' : ''}
                </p>
              </div>
            </div>

            {/* Geleistete Zahlungen */}
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="flex flex-col">
                <p className="text-sm font-medium text-green-600">Geleistete Zahlungen</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {formatBetrag(gesamtZahlungen)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Relevante Mietzahlungen
                </p>
              </div>
            </div>

            {/* Rückstand */}
            <div className={`p-4 border rounded-lg ${rueckstand > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex flex-col">
                <p className={`text-sm font-medium ${rueckstand > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {rueckstand > 0 ? 'Rückstand' : 'Kein Rückstand'}
                </p>
                <p className={`text-2xl font-bold mt-1 ${rueckstand > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  {formatBetrag(Math.abs(rueckstand))}
                </p>
                {nichtFaelligeForderungenBetrag > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    + {formatBetrag(nichtFaelligeForderungenBetrag)} noch nicht fällig
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zahlungen & Forderungen Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Zahlungen & Forderungen</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateForderung}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Forderung erstellen
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className="h-8"
              >
                Timeline
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                Liste
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'timeline' ? (
            <MietvertragTimelineView
              forderungen={forderungen}
              zahlungen={zahlungen}
              allMietvertraege={allMietvertraege}
              vertragId={vertragId}
              formatDatum={formatDatum}
              formatBetrag={formatBetrag}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Listen-Ansicht wird geladen...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}