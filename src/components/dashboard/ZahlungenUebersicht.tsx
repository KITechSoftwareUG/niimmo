import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Euro, Calendar, Building2, Home, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ZahlungenUebersichtProps {
  onBack?: () => void;
}

interface ZahlungWithDetails {
  id: string;
  betrag: number;
  buchungsdatum: string;
  verwendungszweck: string | null;
  empfaengername: string | null;
  zugeordneter_monat: string | null;
  kategorie: string | null;
  mietvertrag_id: string | null;
  immobilie_name: string | null;
  immobilie_adresse: string | null;
  einheit_id: string | null;
  einheit_typ: string | null;
  mieter_name: string | null;
}

export const ZahlungenUebersicht = ({ onBack }: ZahlungenUebersichtProps = {}) => {
  const { data: zahlungen, isLoading } = useQuery({
    queryKey: ['zahlungen-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select(`
          id,
          betrag,
          buchungsdatum,
          verwendungszweck,
          empfaengername,
          zugeordneter_monat,
          kategorie,
          mietvertrag_id,
          mietvertrag:mietvertrag_id (
            id,
            einheit_id,
            einheiten:einheit_id (
              id,
              einheitentyp,
              immobilie_id,
              immobilien:immobilie_id (
                name,
                adresse
              )
            )
          ),
          mietvertrag_mieter!inner (
            mieter:mieter_id (
              vorname,
              nachname
            )
          )
        `)
        .neq('kategorie', 'Nichtmiete')
        .order('buchungsdatum', { ascending: false });

      if (error) throw error;

      // Transform data
      const transformed: ZahlungWithDetails[] = (data || []).map((zahlung: any) => {
        const einheit = zahlung.mietvertrag?.einheiten;
        const immobilie = einheit?.immobilien;
        const mieter = zahlung.mietvertrag_mieter?.[0]?.mieter;

        return {
          id: zahlung.id,
          betrag: zahlung.betrag,
          buchungsdatum: zahlung.buchungsdatum,
          verwendungszweck: zahlung.verwendungszweck,
          empfaengername: zahlung.empfaengername,
          zugeordneter_monat: zahlung.zugeordneter_monat,
          kategorie: zahlung.kategorie,
          mietvertrag_id: zahlung.mietvertrag_id,
          immobilie_name: immobilie?.name || null,
          immobilie_adresse: immobilie?.adresse || null,
          einheit_id: einheit?.id || null,
          einheit_typ: einheit?.einheitentyp || null,
          mieter_name: mieter ? `${mieter.vorname} ${mieter.nachname}` : null,
        };
      });

      return transformed;
    },
  });

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  const formatDatum = (datum: string) => {
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getEinheitNr = (einheitId: string | null) => {
    if (!einheitId) return 'N/A';
    return einheitId.slice(-2);
  };

  const gesamtbetrag = zahlungen?.reduce((sum, z) => sum + z.betrag, 0) || 0;
  const zugeordneteZahlungen = zahlungen?.filter(z => z.mietvertrag_id) || [];
  const nichtzugeordneteZahlungen = zahlungen?.filter(z => !z.mietvertrag_id) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
                </Button>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Zahlungsübersicht</h1>
                <p className="text-gray-600 mt-1">
                  Alle Zahlungen und ihre Zuordnung zu Mietverträgen
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Gesamtsumme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">
                  {formatBetrag(gesamtbetrag)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Zugeordnete Zahlungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <p className="text-2xl font-bold text-blue-600">
                  {zugeordneteZahlungen.length}
                </p>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {formatBetrag(zugeordneteZahlungen.reduce((sum, z) => sum + z.betrag, 0))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Nicht zugeordnet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-orange-600" />
                <p className="text-2xl font-bold text-orange-600">
                  {nichtzugeordneteZahlungen.length}
                </p>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {formatBetrag(nichtzugeordneteZahlungen.reduce((sum, z) => sum + z.betrag, 0))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Zahlungen Table */}
        <Card>
          <CardHeader>
            <CardTitle>Alle Zahlungen</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Lade Zahlungen...</p>
              </div>
            ) : zahlungen && zahlungen.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Monat</TableHead>
                      <TableHead>Objekt</TableHead>
                      <TableHead>Einheit</TableHead>
                      <TableHead>Mieter</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Verwendungszweck</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zahlungen.map((zahlung) => (
                      <TableRow key={zahlung.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDatum(zahlung.buchungsdatum)}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatBetrag(zahlung.betrag)}
                        </TableCell>
                        <TableCell>
                          {zahlung.zugeordneter_monat || '-'}
                        </TableCell>
                        <TableCell>
                          {zahlung.immobilie_name ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="font-medium">{zahlung.immobilie_name}</p>
                                <p className="text-xs text-gray-500">{zahlung.immobilie_adresse}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {zahlung.einheit_id ? (
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-gray-400" />
                              <span>
                                {zahlung.einheit_typ} - {getEinheitNr(zahlung.einheit_id)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {zahlung.mieter_name ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{zahlung.mieter_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {zahlung.kategorie && (
                            <Badge variant="outline" className="text-xs">
                              {zahlung.kategorie}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          <span className="text-sm text-gray-600" title={zahlung.verwendungszweck || ''}>
                            {zahlung.verwendungszweck || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {zahlung.mietvertrag_id ? (
                            <Badge className="bg-green-600 text-white">
                              Zugeordnet
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              Nicht zugeordnet
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">Keine Zahlungen gefunden</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
