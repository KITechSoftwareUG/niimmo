import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MahnstufeIndicator } from "./MahnstufeIndicator";
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
  ChevronRight,
  AlertTriangle,
  Plus,
  Minus,
  Send
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
  const [selectedMonth, setSelectedMonth] = useState<string>("alle");

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

  // Mahnstufe-Funktionen
  const handleMahnstufeChange = async (newMahnstufe: number) => {
    if (!vertrag) return;
    
    try {
      const { error } = await supabase
        .from('mietvertrag')
        .update({ 
          mahnstufe: newMahnstufe,
          letzte_mahnung_am: new Date().toISOString(),
          naechste_mahnung_am: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 Tage später
        })
        .eq('id', vertragId);

      if (error) throw error;

      toast({
        title: "Mahnstufe aktualisiert",
        description: `Mahnstufe wurde auf ${newMahnstufe} gesetzt.`,
      });

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Mahnstufe:', error);
      toast({
        title: "Fehler",
        description: "Mahnstufe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  // Automatische Mahnstufen-Prüfung für alle Verträge
  const handleCheckMahnstufen = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-mahnstufen', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Mahnstufen-Prüfung abgeschlossen",
        description: `${data.results?.length || 0} Verträge wurden aktualisiert.`,
      });

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Fehler bei der Mahnstufen-Prüfung:', error);
      toast({
        title: "Fehler",
        description: "Mahnstufen-Prüfung konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    }
  };

  const getMahnstufeColor = (stufe: number) => {
    switch (stufe) {
      case 0: return 'bg-green-100 text-green-800 border-green-200';
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2: return 'bg-orange-100 text-orange-800 border-orange-200';
      case 3: return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMahnstufeText = (stufe: number) => {
    switch (stufe) {
      case 0: return 'Keine Mahnung';
      case 1: return '1. Mahnung';
      case 2: return '2. Mahnung';
      case 3: return '3. Mahnung';
      default: return 'Unbekannt';
    }
  };

  const handleDownloadDocument = async (dokument: any) => {
    if (!dokument.pfad) {
      toast({
        title: "Fehler",
        description: "Dateipfad nicht gefunden.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a signed URL for private bucket access
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(dokument.pfad, 60); // Valid for 60 seconds

      if (signedUrlError) throw signedUrlError;

      // Download using the signed URL
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dokument.titel || 'dokument';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: `${dokument.titel || 'Dokument'} wurde heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download-Fehler:', error);
      toast({
        title: "Download-Fehler",
        description: "Das Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const gesamtZahlungen = zahlungen?.reduce((sum, zahlung) => sum + (Number(zahlung.betrag) || 0), 0) || 0;
  const sollMiete = vertrag ? (Number(vertrag.kaltmiete) || 0) + (Number(vertrag.betriebskosten) || 0) : 0;
  const gesamtForderungen = forderungen?.reduce((sum, forderung) => sum + (Number(forderung.sollbetrag) || 0), 0) || 0;

  // Erstelle eine Liste der Monate basierend auf vorhandenen Forderungen
  const generateMonthlyComparison = () => {
    if (!forderungen || !zahlungen || !vertrag) return [];
    
    const monthlyData = [];
    
    // Gehe durch alle Forderungen und erstelle Einträge nur für Monate mit Forderungen
    for (const forderung of forderungen) {
      const monthKey = forderung.sollmonat; // YYYY-MM Format
      
      // Filtere nach ausgewähltem Jahr wenn gesetzt
      if (selectedYear && selectedYear !== "alle") {
        const forderungYear = monthKey.split('-')[0];
        if (forderungYear !== selectedYear) continue;
      }
      
      // Filtere nach ausgewähltem Monat wenn gesetzt
      if (selectedMonth && selectedMonth !== "alle") {
        const forderungMonth = monthKey.split('-')[1];
        if (forderungMonth !== selectedMonth.padStart(2, '0')) continue;
      }
      
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
      const sollbetrag = Number(forderung.sollbetrag || 0);
      
      monthlyData.push({
        monat: monthKey,
        sollbetrag,
        zahlungen: zahlungenSum,
        differenz: zahlungenSum - sollbetrag,
        status: zahlungenSum >= sollbetrag ? 'vollständig' : zahlungenSum > 0 ? 'teilweise' : 'offen'
      });
    }
    
    // Sortiere nach Monat (neueste zuerst)
    return monthlyData.sort((a, b) => b.monat.localeCompare(a.monat));
  };

  // Verfügbare Jahre basierend auf Forderungen
  const getAvailableYears = () => {
    if (!forderungen || forderungen.length === 0) return [];
    
    const years = new Set<string>();
    forderungen.forEach(f => {
      if (f.sollmonat) {
        const year = f.sollmonat.split('-')[0];
        years.add(year);
      }
    });
    
    return Array.from(years).sort();
  };

  // Verfügbare Monate für das ausgewählte Jahr basierend auf Forderungen
  const getAvailableMonths = () => {
    if (!forderungen || !selectedYear || selectedYear === "alle") return [];
    
    const months = new Set<{value: string, label: string}>();
    
    forderungen.forEach(f => {
      if (f.sollmonat && f.sollmonat.startsWith(selectedYear)) {
        const month = f.sollmonat.split('-')[1];
        const monthNum = parseInt(month);
        months.add({
          value: monthNum.toString(),
          label: new Date(parseInt(selectedYear), monthNum - 1, 1).toLocaleDateString('de-DE', { month: 'long' })
        });
      }
    });
    
    return Array.from(months).sort((a, b) => parseInt(a.value) - parseInt(b.value));
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
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Mietvertrag Details</span>
            </DialogTitle>
            
            {/* Mahnsystem */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCheckMahnstufen}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                title="Mahnstufen für alle Verträge prüfen"
              >
                Alle prüfen
              </button>
              
              <div className={`px-3 py-2 rounded-lg border-2 ${getMahnstufeColor(vertrag?.mahnstufe || 0)}`}>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-semibold">{getMahnstufeText(vertrag?.mahnstufe || 0)}</span>
                </div>
                {vertrag?.letzte_mahnung_am && (
                  <p className="text-xs mt-1">
                    Letzte Mahnung: {formatDatum(vertrag.letzte_mahnung_am)}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => handleMahnstufeChange(Math.min((vertrag?.mahnstufe || 0) + 1, 3))}
                  disabled={(vertrag?.mahnstufe || 0) >= 3}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Mahnstufe erhöhen"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleMahnstufeChange(Math.max((vertrag?.mahnstufe || 0) - 1, 0))}
                  disabled={(vertrag?.mahnstufe || 0) <= 0}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Mahnstufe verringern"
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
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

          {/* Mahnstufen-Bereich */}
          {vertrag && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span>Mahnstufen-Verwaltung</span>
                  </div>
                  {(vertrag.mahnstufe || 0) > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-destructive">
                        Aktuelle Mahnstufe: {vertrag.mahnstufe}
                      </span>
                      <MahnstufeIndicator stufe={vertrag.mahnstufe || 0} />
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-muted-foreground">Mahnstufe:</span>
                      <MahnstufeIndicator stufe={vertrag.mahnstufe || 0} />
                      <span className="font-medium">
                        {vertrag.mahnstufe === 0 ? 'Keine Mahnung' : 
                         vertrag.mahnstufe === 1 ? '1. Mahnung' :
                         vertrag.mahnstufe === 2 ? '2. Mahnung' :
                         vertrag.mahnstufe === 3 ? '3. Mahnung' : 'Unbekannt'}
                      </span>
                    </div>
                    {vertrag.letzte_mahnung_am && (
                      <p className="text-xs text-muted-foreground">
                        Letzte Mahnung: {formatDatum(vertrag.letzte_mahnung_am)}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {(vertrag.mahnstufe || 0) > 0 && (
                      <Button
                        onClick={async () => {
                          try {
                            // Hole offene Forderungen
                            const { data: forderungen } = await supabase
                              .from('mietforderungen')
                              .select('*')
                              .eq('mietvertrag_id', vertrag.id);

                            // Hole Mieter-Daten
                            const { data: mieterData } = await supabase
                              .from('mietvertrag_mieter')
                              .select(`
                                mieter:mieter_id (
                                  vorname,
                                  nachname,
                                  hauptmail
                                )
                              `)
                              .eq('mietvertrag_id', vertrag.id);

                            const { data, error } = await supabase.functions.invoke('send-mahnung', {
                              body: {
                                mietvertragId: vertrag.id,
                                mahnstufe: vertrag.mahnstufe,
                                vertragData: {
                                  ...vertrag,
                                  mieter: mieterData,
                                  einheit: einheit,
                                  immobilie: immobilie
                                },
                                forderungen: forderungen || []
                              }
                            });

                            if (error) throw error;

                            toast({
                              title: "Mahnung versendet",
                              description: `Mahnung Stufe ${vertrag.mahnstufe} wurde erfolgreich versendet.`,
                            });
                          } catch (error) {
                            console.error('Fehler beim Versenden der Mahnung:', error);
                            toast({
                              title: "Fehler",
                              description: "Mahnung konnte nicht versendet werden.",
                              variant: "destructive",
                            });
                          }
                        }}
                        size="sm"
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Mahnung verschicken
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleCheckMahnstufen}
                      size="sm"
                      variant="outline"
                    >
                      Mahnstufen prüfen
                    </Button>
                  </div>
                </div>
                
                {(vertrag.mahnstufe || 0) === 0 && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 flex items-center">
                      <span className="mr-2">✓</span>
                      Alle Zahlungen sind pünktlich - keine Mahnstufe aktiv
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                        <SelectContent className="bg-background border shadow-md z-50">
                          <SelectItem value="alle">Alle Jahre</SelectItem>
                          {getAvailableYears().map(year => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Monat auswählen */}
                      {selectedYear && selectedYear !== "alle" && (
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Monat" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md z-50">
                            <SelectItem value="alle">Alle Monate</SelectItem>
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
                              <button
                                onClick={() => handleDownloadDocument(dokument)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="Dokument herunterladen"
                              >
                                <Download className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                              </button>
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