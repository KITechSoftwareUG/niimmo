import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, CheckCircle, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FaelligkeitsUebersicht = () => {
  const { data: faelligkeitsStatistik, isLoading } = useQuery({
    queryKey: ['faelligkeits-statistik'],
    queryFn: async () => {
      const { data: alleForderungen, error } = await supabase
        .from('mietforderungen')
        .select('ist_faellig, faelligkeitsdatum, sollbetrag, sollmonat')
        .order('faelligkeitsdatum');

      if (error) throw error;

      const heute = new Date();
      const morgen = new Date(heute);
      morgen.setDate(heute.getDate() + 1);
      const in7Tagen = new Date(heute);
      in7Tagen.setDate(heute.getDate() + 7);

      const faelligeForderungen = alleForderungen?.filter(f => f.ist_faellig === true) || [];
      const nichtFaelligeForderungen = alleForderungen?.filter(f => f.ist_faellig !== true) || [];
      
      const morgenFaellig = nichtFaelligeForderungen.filter(f => 
        f.faelligkeitsdatum && new Date(f.faelligkeitsdatum).toDateString() === morgen.toDateString()
      );
      
      const baldFaellig = nichtFaelligeForderungen.filter(f => 
        f.faelligkeitsdatum && new Date(f.faelligkeitsdatum) <= in7Tagen && new Date(f.faelligkeitsdatum) > morgen
      );

      const faelligeBetrag = faelligeForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
      const morgenFaelligBetrag = morgenFaellig.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
      const baldFaelligBetrag = baldFaellig.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);

      return {
        gesamt: alleForderungen?.length || 0,
        faellig: faelligeForderungen.length,
        morgenFaellig: morgenFaellig.length,
        baldFaellig: baldFaellig.length,
        nichtFaellig: nichtFaelligeForderungen.length - morgenFaellig.length - baldFaellig.length,
        faelligeBetrag,
        morgenFaelligBetrag,
        baldFaelligBetrag
      };
    }
  });

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Fälligkeitsübersicht</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!faelligkeitsStatistik) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Fälligkeitsübersicht</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aktuell fällig */}
        {faelligkeitsStatistik.faellig > 0 && (
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Bereits fällig</p>
                <p className="text-sm text-red-600">{faelligkeitsStatistik.faellig} Forderungen</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="destructive">{formatBetrag(faelligkeitsStatistik.faelligeBetrag)}</Badge>
            </div>
          </div>
        )}

        {/* Morgen fällig */}
        {faelligkeitsStatistik.morgenFaellig > 0 && (
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">Morgen fällig</p>
                <p className="text-sm text-orange-600">{faelligkeitsStatistik.morgenFaellig} Forderungen</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                {formatBetrag(faelligkeitsStatistik.morgenFaelligBetrag)}
              </Badge>
            </div>
          </div>
        )}

        {/* Bald fällig */}
        {faelligkeitsStatistik.baldFaellig > 0 && (
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">In den nächsten 7 Tagen</p>
                <p className="text-sm text-yellow-600">{faelligkeitsStatistik.baldFaellig} Forderungen</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                {formatBetrag(faelligkeitsStatistik.baldFaelligBetrag)}
              </Badge>
            </div>
          </div>
        )}

        {/* Noch nicht fällig */}
        {faelligkeitsStatistik.nichtFaellig > 0 && (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Noch nicht fällig</p>
                <p className="text-sm text-green-600">{faelligkeitsStatistik.nichtFaellig} Forderungen</p>
              </div>
            </div>
          </div>
        )}

        {/* Zusammenfassung */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Gesamtanzahl Forderungen:</span>
            <span className="font-medium">{faelligkeitsStatistik.gesamt}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};