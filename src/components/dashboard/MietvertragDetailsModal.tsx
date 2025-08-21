import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Euro, 
  Calendar, 
  FileText, 
  CreditCard, 
  Building2,
  Users,
  Download,
  AlertCircle,
  Copy,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MietvertragDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: any;
  immobilie?: any;
}

export const MietvertragDetailsModal = ({ 
  isOpen, 
  onClose, 
  vertragId, 
  einheit, 
  immobilie 
}: MietvertragDetailsModalProps) => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Kopiert!",
        description: `${type} wurde in die Zwischenablage kopiert.`,
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description: `${type} konnte nicht kopiert werden.`,
        variant: "destructive",
      });
    }
  };
  const { data: vertrag, isLoading: vertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select('*')
        .eq('id', vertragId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!vertragId
  });

  const { data: mieter } = useQuery({
    queryKey: ['mietvertrag-mieter-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mieter:mieter_id (
            id,
            vorname,
            nachname,
            hauptmail,
            telnr,
            geburtsdatum
          )
        `)
        .eq('mietvertrag_id', vertragId);
      
      if (error) throw error;
      return data?.map(mm => mm.mieter) || [];
    },
    enabled: isOpen && !!vertragId
  });

  const { data: zahlungen } = useQuery({
    queryKey: ['zahlungen-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!vertragId
  });

  // Hole alle Forderungen
  const { data: forderungen } = useQuery({
    queryKey: ['forderungen-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietforderungen')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('sollmonat', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!vertragId
  });

  const { data: dokumente } = useQuery({
    queryKey: ['dokumente-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!vertragId
  });

  const formatDatum = (datum: string) => {
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  const gesamtZahlungen = zahlungen?.reduce((sum, zahlung) => sum + (Number(zahlung.betrag) || 0), 0) || 0;
  const sollMiete = vertrag ? (Number(vertrag.kaltmiete) || 0) + (Number(vertrag.betriebskosten) || 0) : 0;
  const gesamtForderungen = forderungen?.reduce((sum, forderung) => sum + (Number(forderung.sollbetrag) || 0), 0) || 0;

  // Erstelle eine Liste der Monate basierend auf der Vertragslaufzeit
  const generateMonthlyComparison = () => {
    if (!forderungen || !zahlungen || !vertrag) return [];
    
    const monthlyData = [];
    
    // Bestimme Start- und Enddatum basierend auf Vertragslaufzeit
    const vertragStart = vertrag.start_datum ? new Date(vertrag.start_datum) : new Date('2025-01-01');
    const vertragEnde = vertrag.ende_datum ? new Date(vertrag.ende_datum) : 
                       vertrag.kuendigungsdatum ? new Date(vertrag.kuendigungsdatum) : 
                       new Date();
    
    // Filtere nach ausgewähltem Jahr oder zeige alle Jahre
    const filterStart = selectedYear ? new Date(`${selectedYear}-01-01`) : vertragStart;
    const filterEnd = selectedYear ? new Date(`${selectedYear}-12-31`) : vertragEnde;
    
    // Bestimme den tatsächlichen Zeitraum (Schnittmenge von Vertrag und Filter)
    const startDate = new Date(Math.max(vertragStart.getTime(), filterStart.getTime()));
    const endDate = new Date(Math.min(vertragEnde.getTime(), filterEnd.getTime()));
    
    // Erstelle Monate für den Zeitraum
    const monthIterator = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endIterator = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    while (monthIterator <= endIterator) {
      const monthKey = monthIterator.toISOString().slice(0, 7); // YYYY-MM Format
      
      // Filtere nach ausgewähltem Monat wenn gesetzt
      if (selectedMonth && monthKey !== `${selectedYear}-${selectedMonth.padStart(2, '0')}`) {
        monthIterator.setMonth(monthIterator.getMonth() + 1);
        continue;
      }
      
      // Finde Forderung für diesen Monat
      const forderung = forderungen.find(f => f.sollmonat === monthKey);
      
      // Finde Zahlungen für diesen Monat (intelligente Zuordnung)
      const monthZahlungen = zahlungen.filter(z => {
        if (!z.buchungsdatum) return false;
        
        const zahlungsDatum = new Date(z.buchungsdatum);
        const zahlungsTag = zahlungsDatum.getDate();
        const zahlungMonat = z.buchungsdatum.slice(0, 7); // YYYY-MM
        
        // Wenn Zahlung nach dem 25. des Monats, ordne sie dem nächsten Monat zu
        if (zahlungsTag > 25) {
          const naechsterMonat = new Date(zahlungsDatum);
          naechsterMonat.setMonth(naechsterMonat.getMonth() + 1);
          const naechsterMonatKey = naechsterMonat.toISOString().slice(0, 7);
          return naechsterMonatKey === monthKey;
        } else {
          // Normale Zuordnung zum aktuellen Monat
          return zahlungMonat === monthKey;
        }
      });
      
      const zahlungenSum = monthZahlungen.reduce((sum, z) => sum + (Number(z.betrag) || 0), 0);
      const sollbetrag = Number(forderung?.sollbetrag || 0);
      
      monthlyData.push({
        monat: monthKey,
        sollbetrag,
        zahlungen: zahlungenSum,
        differenz: zahlungenSum - sollbetrag,
        status: zahlungenSum >= sollbetrag ? 'vollständig' : zahlungenSum > 0 ? 'teilweise' : 'offen'
      });
      
      monthIterator.setMonth(monthIterator.getMonth() + 1);
    }
    
    return monthlyData.reverse(); // Neueste zuerst
  };

  // Verfügbare Jahre basierend auf Vertragsdaten
  const getAvailableYears = () => {
    if (!vertrag) return [];
    
    const startYear = vertrag.start_datum ? new Date(vertrag.start_datum).getFullYear() : 2025;
    const endYear = vertrag.ende_datum ? new Date(vertrag.ende_datum).getFullYear() : 
                   vertrag.kuendigungsdatum ? new Date(vertrag.kuendigungsdatum).getFullYear() : 
                   new Date().getFullYear();
    
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year.toString());
    }
    return years;
  };

  // Verfügbare Monate für das ausgewählte Jahr
  const getAvailableMonths = () => {
    if (!vertrag || !selectedYear) return [];
    
    const year = parseInt(selectedYear);
    const vertragStart = vertrag.start_datum ? new Date(vertrag.start_datum) : new Date(`${year}-01-01`);
    const vertragEnde = vertrag.ende_datum ? new Date(vertrag.ende_datum) : 
                       vertrag.kuendigungsdatum ? new Date(vertrag.kuendigungsdatum) : 
                       new Date(`${year}-12-31`);
    
    const startMonth = vertragStart.getFullYear() === year ? vertragStart.getMonth() + 1 : 1;
    const endMonth = vertragEnde.getFullYear() === year ? vertragEnde.getMonth() + 1 : 12;
    
    const months = [];
    for (let month = startMonth; month <= endMonth; month++) {
      months.push({
        value: month.toString(),
        label: new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long' })
      });
    }
    return months;
  };

  const monthlyComparison = generateMonthlyComparison();

  if (vertragLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!vertrag) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mietvertrag nicht gefunden</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Der angeforderte Mietvertrag konnte nicht gefunden werden.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Mietvertrag Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Grundinformationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Grundinformationen</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Immobilie</p>
                  <p className="font-semibold">{immobilie?.name}</p>
                  <p className="text-sm text-gray-500">{immobilie?.adresse}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Einheit</p>
                  <p className="font-semibold">
                    Einheit {einheit?.nummer || 'N/A'} • {einheit?.qm && `${einheit.qm} m²`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mietbeginn</p>
                  <p className="font-semibold">
                    {vertrag?.start_datum ? formatDatum(vertrag.start_datum) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="space-y-1">
                    <Badge className={
                      vertrag?.status === 'aktiv' ? 'bg-green-600' : 
                      vertrag?.status === 'gekuendigt' ? 'bg-yellow-600' :
                      vertrag?.status === 'beendet' ? 'bg-red-600' : 'bg-gray-600'
                    }>
                      {vertrag?.status}
                    </Badge>
                    {vertrag?.status === 'gekuendigt' && vertrag?.kuendigungsdatum && (
                      <p className="text-sm text-yellow-600 font-medium">
                        Gekündigt zum: {formatDatum(vertrag.kuendigungsdatum)}
                      </p>
                    )}
                    {vertrag?.ende_datum && (
                      <p className="text-sm text-gray-600">
                        Vertragsende: {formatDatum(vertrag.ende_datum)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mieter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Mieter ({mieter?.length || 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mieter && mieter.length > 0 ? (
                <div className="space-y-3">
                  {mieter.map((m, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <p className="font-semibold">{m.vorname} {m.nachname}</p>
                        <div className="space-y-2 mt-2">
                          {m.hauptmail && (
                            <div className="flex items-center justify-between group">
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-600">{m.hauptmail}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(m.hauptmail, 'E-Mail-Adresse');
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                title="E-Mail-Adresse kopieren"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          
                          {m.telnr && (
                            <div className="flex items-center justify-between group">
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-600">{m.telnr}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(m.telnr, 'Telefonnummer');
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                title="Telefonnummer kopieren"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          
                          {m.geburtsdatum && (
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">Geburtsdatum: {formatDatum(m.geburtsdatum)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Keine Mieter zugeordnet</p>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="zahlungen" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="zahlungen">Zahlungen</TabsTrigger>
              <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
            </TabsList>

            <TabsContent value="zahlungen" className="space-y-4">
              {/* Zahlungsübersicht */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Euro className="h-5 w-5" />
                    <span>Zahlungsübersicht</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Kaltmiete</p>
                      <p className="font-semibold text-lg">{formatBetrag(Number(vertrag?.kaltmiete) || 0)}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Betriebskosten</p>
                      <p className="font-semibold text-lg">{formatBetrag(Number(vertrag?.betriebskosten) || 0)}</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-600">Gesamtforderungen</p>
                      <p className="font-semibold text-lg">{formatBetrag(gesamtForderungen)}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Gesamtmiete (monatlich)</p>
                      <p className="font-semibold text-lg">{formatBetrag(sollMiete)}</p>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Eingegangene Zahlungen</p>
                      <p className="font-semibold text-lg text-green-600">{formatBetrag(gesamtZahlungen)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kaution</p>
                      <p className="font-semibold text-lg">{formatBetrag(Number(vertrag?.kaution_betrag) || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monatliche Forderungen vs Zahlungen */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Forderungen vs. Zahlungen</CardTitle>
                    
                    <div className="flex items-center space-x-2">
                      {/* Jahr auswählen */}
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Jahr" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Alle Jahre</SelectItem>
                          {getAvailableYears().map(year => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Monat auswählen */}
                      {selectedYear && (
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Monat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Alle Monate</SelectItem>
                            {getAvailableMonths().map(month => (
                              <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {monthlyComparison && monthlyComparison.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {monthlyComparison.map((monthly) => (
                        <div key={monthly.monat} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {new Date(monthly.monat + '-01').toLocaleDateString('de-DE', { 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <div className="text-sm text-gray-600 space-y-1">
                                <p>Soll: {formatBetrag(monthly.sollbetrag)}</p>
                                <p>Ist: {formatBetrag(monthly.zahlungen)}</p>
                                <p className={`font-medium ${
                                  monthly.differenz >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  Differenz: {formatBetrag(monthly.differenz)}
                                </p>
                              </div>
                            </div>
                            <Badge variant={
                              monthly.status === 'vollständig' ? 'default' : 
                              monthly.status === 'teilweise' ? 'secondary' : 
                              'destructive'
                            } className={
                              monthly.status === 'vollständig' ? 'bg-green-100 text-green-800' : 
                              monthly.status === 'teilweise' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }>
                              {monthly.status === 'vollständig' ? '✓ Vollständig' : 
                               monthly.status === 'teilweise' ? '◐ Teilweise' : 
                               '✗ Offen'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Keine Forderungen ab Juli 2025 gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Zahlungsliste */}
              <Card>
                <CardHeader>
                  <CardTitle>Alle Zahlungen</CardTitle>
                </CardHeader>
                <CardContent>
                  {zahlungen && zahlungen.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {zahlungen.map((zahlung) => (
                        <div key={zahlung.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{formatBetrag(Number(zahlung.betrag))}</p>
                              <p className="text-sm text-gray-600">
                                {zahlung.buchungsdatum ? formatDatum(zahlung.buchungsdatum) : 'N/A'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {zahlung.verwendungszweck || 'Kein Verwendungszweck'}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {zahlung.kategorie || 'Sonstige'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Keine Zahlungen gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dokumente" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Dokumente ({dokumente?.length || 0})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dokumente && dokumente.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {dokumente.map((dokument) => (
                        <div key={dokument.id} className="p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold">{dokument.titel || 'Unbenanntes Dokument'}</p>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                <span>{dokument.dateityp || 'N/A'}</span>
                                <span>{dokument.hochgeladen_am ? formatDatum(dokument.hochgeladen_am) : 'N/A'}</span>
                                {dokument.groesse_bytes && (
                                  <span>{Math.round(dokument.groesse_bytes / 1024)} KB</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                von: {dokument.erstellt_von || 'Unbekannt'}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">
                                {dokument.kategorie || 'Sonstige'}
                              </Badge>
                              <Download className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Keine Dokumente gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};