import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Euro, Calendar, Building2, Home, User, Check, Edit2, X, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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
  const [selectedZahlungId, setSelectedZahlungId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMietvertragId, setSelectedMietvertragId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'datum-desc' | 'datum-asc' | 'betrag-desc' | 'betrag-asc' | 'status' | 'kategorie'>('datum-desc');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();
  const { data: zahlungen, isLoading } = useQuery({
    queryKey: ['zahlungen-overview'],
    queryFn: async () => {
      // First get all payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('zahlungen')
        .select('*')
        .order('buchungsdatum', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Transform data by fetching related information
      const transformed: ZahlungWithDetails[] = await Promise.all(
        (paymentsData || []).map(async (zahlung: any) => {
          let immobilie_name = null;
          let immobilie_adresse = null;
          let einheit_id = null;
          let einheit_typ = null;
          let mieter_name = null;

          if (zahlung.mietvertrag_id) {
            // Get contract details
            const { data: contractData } = await supabase
              .from('mietvertrag')
              .select(`
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
              `)
              .eq('id', zahlung.mietvertrag_id)
              .single();

            if (contractData) {
              const einheit = contractData.einheiten;
              const immobilie = einheit?.immobilien;
              
              einheit_id = einheit?.id || null;
              einheit_typ = einheit?.einheitentyp || null;
              immobilie_name = immobilie?.name || null;
              immobilie_adresse = immobilie?.adresse || null;

              // Get tenant names
              const { data: mieterData } = await supabase
                .from('mietvertrag_mieter')
                .select(`
                  mieter:mieter_id (
                    vorname,
                    nachname
                  )
                `)
                .eq('mietvertrag_id', zahlung.mietvertrag_id);

              if (mieterData && mieterData.length > 0) {
                const mieter = mieterData[0].mieter;
                mieter_name = mieter ? `${mieter.vorname} ${mieter.nachname}` : null;
              }
            }
          }

          return {
            id: zahlung.id,
            betrag: zahlung.betrag,
            buchungsdatum: zahlung.buchungsdatum,
            verwendungszweck: zahlung.verwendungszweck,
            empfaengername: zahlung.empfaengername,
            zugeordneter_monat: zahlung.zugeordneter_monat,
            kategorie: zahlung.kategorie,
            mietvertrag_id: zahlung.mietvertrag_id,
            immobilie_name,
            immobilie_adresse,
            einheit_id,
            einheit_typ,
            mieter_name,
          };
        })
      );

      return transformed;
    },
  });

  // Query all contracts for the assignment dropdown
  const { data: allContracts } = useQuery({
    queryKey: ['all-contracts-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          einheit_id,
          status,
          einheiten:einheit_id (
            id,
            einheitentyp,
            immobilie_id,
            immobilien:immobilie_id (
              name,
              adresse
            )
          ),
          mietvertrag_mieter (
            mieter:mieter_id (
              vorname,
              nachname
            )
          )
        `)
        .in('status', ['aktiv', 'gekuendigt'])
        .order('einheit_id');

      if (error) throw error;

      return (data || []).map((contract: any) => {
        const einheit = contract.einheiten;
        const immobilie = einheit?.immobilien;
        const mieter = contract.mietvertrag_mieter?.[0]?.mieter;

        return {
          id: contract.id,
          einheit_id: contract.einheit_id,
          immobilie_name: immobilie?.name || 'Unbekannt',
          immobilie_adresse: immobilie?.adresse || '',
          einheit_typ: einheit?.einheitentyp || 'Unbekannt',
          einheit_nr: einheit?.id ? einheit.id.slice(-2) : 'N/A',
          mieter_name: mieter ? `${mieter.vorname} ${mieter.nachname}` : 'Unbekannt',
          status: contract.status,
        };
      });
    },
  });

  // Mutation to update payment assignment
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ zahlungId, mietvertragId }: { zahlungId: string; mietvertragId: string | null }) => {
      const { error } = await supabase
        .from('zahlungen')
        .update({ mietvertrag_id: mietvertragId })
        .eq('id', zahlungId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });
      toast.success('Zuordnung erfolgreich aktualisiert');
      setIsEditing(false);
    },
    onError: (error) => {
      console.error('Error updating assignment:', error);
      toast.error('Fehler beim Aktualisieren der Zuordnung');
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

  // Filter payments by date range
  const filteredZahlungen = zahlungen ? zahlungen.filter((zahlung) => {
    if (!startDate && !endDate) return true;
    
    const zahlungDate = new Date(zahlung.buchungsdatum);
    
    if (startDate && endDate) {
      return zahlungDate >= startDate && zahlungDate <= endDate;
    }
    
    if (startDate) {
      return zahlungDate >= startDate;
    }
    
    if (endDate) {
      return zahlungDate <= endDate;
    }
    
    return true;
  }) : [];

  // Sort payments
  const sortedZahlungen = filteredZahlungen ? [...filteredZahlungen].sort((a, b) => {
    switch (sortBy) {
      case 'datum-desc':
        return new Date(b.buchungsdatum).getTime() - new Date(a.buchungsdatum).getTime();
      case 'datum-asc':
        return new Date(a.buchungsdatum).getTime() - new Date(b.buchungsdatum).getTime();
      case 'betrag-desc':
        return b.betrag - a.betrag;
      case 'betrag-asc':
        return a.betrag - b.betrag;
      case 'status':
        return (b.mietvertrag_id ? 1 : 0) - (a.mietvertrag_id ? 1 : 0);
      case 'kategorie':
        const katA = a.kategorie || 'Keine Kategorie';
        const katB = b.kategorie || 'Keine Kategorie';
        return katA.localeCompare(katB);
      default:
        return 0;
    }
  }) : [];

  const selectedZahlung = sortedZahlungen?.find(z => z.id === selectedZahlungId);

  const handleSaveAssignment = () => {
    if (selectedZahlungId) {
      updateAssignmentMutation.mutate({
        zahlungId: selectedZahlungId,
        mietvertragId: selectedMietvertragId,
      });
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setSelectedMietvertragId(selectedZahlung?.mietvertrag_id || null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSelectedMietvertragId(selectedZahlung?.mietvertrag_id || null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
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
              Verwalten Sie Zahlungen und deren Zuordnung zu Mietverträgen
            </p>
          </div>
        </div>

        {/* Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Zahlungsliste */}
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader className="pb-3">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Euro className="h-5 w-5 text-green-600" />
                      Zahlungen
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {sortedZahlungen?.length || 0} von {zahlungen?.length || 0} Zahlung{(zahlungen?.length || 0) !== 1 ? 'en' : ''}
                    </p>
                  </div>
                  <div className="w-48">
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50">
                        <SelectItem value="datum-desc">Datum (neueste)</SelectItem>
                        <SelectItem value="datum-asc">Datum (älteste)</SelectItem>
                        <SelectItem value="betrag-desc">Betrag (höchste)</SelectItem>
                        <SelectItem value="betrag-asc">Betrag (niedrigste)</SelectItem>
                        <SelectItem value="status">Zuordnung</SelectItem>
                        <SelectItem value="kategorie">Kategorie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd.MM.yyyy", { locale: de }) : "Von Datum"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => endDate ? date > endDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-sm text-gray-600">bis</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd.MM.yyyy", { locale: de }) : "Bis Datum"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                      className="h-8 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Lade Zahlungen...</p>
                </div>
              ) : sortedZahlungen && sortedZahlungen.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-2 p-4">
                    {sortedZahlungen.map((zahlung) => (
                      <Card
                        key={zahlung.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedZahlungId === zahlung.id
                            ? 'ring-2 ring-blue-500 bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedZahlungId(zahlung.id);
                          setIsEditing(false);
                          setSelectedMietvertragId(zahlung.mietvertrag_id);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium">
                                  {formatDatum(zahlung.buchungsdatum)}
                                </span>
                                {zahlung.zugeordneter_monat && (
                                  <Badge variant="outline" className="text-xs">
                                    {zahlung.zugeordneter_monat}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-lg font-bold text-green-600">
                                {formatBetrag(zahlung.betrag)}
                              </p>
                            </div>
                            <div>
                              {zahlung.mietvertrag_id ? (
                                <Badge className="bg-green-600">Zugeordnet</Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  Nicht zugeordnet
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {zahlung.verwendungszweck && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {zahlung.verwendungszweck}
                            </p>
                          )}
                          
                          {zahlung.empfaengername && (
                            <p className="text-xs text-gray-500">
                              Empfänger: {zahlung.empfaengername}
                            </p>
                          )}
                          
                          {zahlung.kategorie && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {zahlung.kategorie}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <Euro className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">Keine Zahlungen gefunden</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Details und Zuordnung */}
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Zuordnung & Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedZahlung ? (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-6">
                    {/* Zahlungsdetails */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Zahlungsdetails</h3>
                      <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Datum:</span>
                          <span className="text-sm font-medium">
                            {formatDatum(selectedZahlung.buchungsdatum)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Betrag:</span>
                          <span className="text-sm font-bold text-green-600">
                            {formatBetrag(selectedZahlung.betrag)}
                          </span>
                        </div>
                        {selectedZahlung.zugeordneter_monat && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Monat:</span>
                            <span className="text-sm font-medium">
                              {selectedZahlung.zugeordneter_monat}
                            </span>
                          </div>
                        )}
                        {selectedZahlung.kategorie && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Kategorie:</span>
                            <Badge variant="secondary" className="text-xs">
                              {selectedZahlung.kategorie}
                            </Badge>
                          </div>
                        )}
                        {selectedZahlung.empfaengername && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Empfänger:</span>
                            <span className="text-sm font-medium">
                              {selectedZahlung.empfaengername}
                            </span>
                          </div>
                        )}
                        {selectedZahlung.verwendungszweck && (
                          <div>
                            <span className="text-sm text-gray-600 block mb-1">Verwendungszweck:</span>
                            <p className="text-sm font-medium bg-white p-2 rounded border">
                              {selectedZahlung.verwendungszweck}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Aktuelle Zuordnung */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">Mietvertrag-Zuordnung</h3>
                        {!isEditing && (
                          <Button
                            onClick={handleEditClick}
                            size="sm"
                            variant="outline"
                            className="gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Bearbeiten
                          </Button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                              Mietvertrag auswählen
                            </label>
                            <Select
                              value={selectedMietvertragId || 'none'}
                              onValueChange={(value) => 
                                setSelectedMietvertragId(value === 'none' ? null : value)
                              }
                            >
                              <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder="Mietvertrag auswählen" />
                              </SelectTrigger>
                              <SelectContent className="bg-white max-h-[300px] z-50">
                                <SelectItem value="none">
                                  <span className="text-gray-500">Keine Zuordnung</span>
                                </SelectItem>
                                {allContracts?.map((contract) => (
                                  <SelectItem key={contract.id} value={contract.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {contract.immobilie_name} - {contract.einheit_typ} {contract.einheit_nr}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {contract.mieter_name}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveAssignment}
                              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                              disabled={updateAssignmentMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                              Speichern
                            </Button>
                            <Button
                              onClick={handleCancelEdit}
                              variant="outline"
                              className="flex-1 gap-2"
                              disabled={updateAssignmentMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          {selectedZahlung.mietvertrag_id ? (
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">
                                    {selectedZahlung.immobilie_name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {selectedZahlung.immobilie_adresse}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <Home className="h-5 w-5 text-blue-600" />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {selectedZahlung.einheit_typ} - {getEinheitNr(selectedZahlung.einheit_id)}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-blue-600" />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {selectedZahlung.mieter_name}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <Home className="h-12 w-12 text-orange-300 mx-auto mb-2" />
                              <p className="text-orange-700 font-medium mb-1">
                                Nicht zugeordnet
                              </p>
                              <p className="text-sm text-orange-600">
                                Diese Zahlung ist keinem Mietvertrag zugeordnet
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">
                    Keine Zahlung ausgewählt
                  </p>
                  <p className="text-sm text-gray-500">
                    Wählen Sie eine Zahlung aus der Liste aus
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
