import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Send,
  Edit2,
  Check,
  X
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
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [selectedMonth, setSelectedMonth] = useState<string>("alle");
  const [editingField, setEditingField] = useState<{mieterId: string, field: 'hauptmail' | 'telnr'} | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingPayment, setEditingPayment] = useState<{zahlungId: string, field: 'kategorie'} | null>(null);
  const [editPaymentValue, setEditPaymentValue] = useState<string>("");

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

  const handleEditField = (mieterId: string, field: 'hauptmail' | 'telnr', currentValue: string) => {
    setEditingField({ mieterId, field });
    setEditValue(currentValue || '');
  };

  const handleSaveField = async () => {
    if (!editingField) return;
    
    try {
      const { error } = await supabase
        .from('mieter')
        .update({ [editingField.field]: editValue })
        .eq('id', editingField.mieterId);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: `${editingField.field === 'hauptmail' ? 'E-Mail-Adresse' : 'Telefonnummer'} wurde erfolgreich aktualisiert.`,
      });

      setEditingField(null);
      setEditValue('');
      
      // Refetch mieter data
      window.location.reload();
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: "Daten konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleEditPaymentField = (zahlungId: string, field: 'kategorie', currentValue: string) => {
    setEditingPayment({ zahlungId, field });
    setEditPaymentValue(currentValue || '');
  };

  const handleSavePaymentField = async () => {
    if (!editingPayment) return;
    
    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ kategorie: editPaymentValue as any })
        .eq('id', editingPayment.zahlungId);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: "Kategorie wurde erfolgreich aktualisiert.",
      });

      setEditingPayment(null);
      setEditPaymentValue('');
      
      // Refresh nur die relevanten Queries statt komplette Seite
      queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] });
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: "Kategorie konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCancelPaymentEdit = () => {
    setEditingPayment(null);
    setEditPaymentValue('');
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
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
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
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Mietvertrag nicht gefunden</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Der angeforderte Mietvertrag konnte nicht gefunden werden.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Mietvertrag Details</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
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
                          {/* E-Mail-Adresse - immer anzeigen */}
                          <div className="flex items-center justify-between group">
                            <div className="flex items-center space-x-2 flex-1">
                              <Mail className="h-4 w-4 text-gray-500" />
                              {editingField?.mieterId === m.id && editingField?.field === 'hauptmail' ? (
                                <div className="flex items-center space-x-2 flex-1">
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="E-Mail-Adresse eingeben"
                                    type="email"
                                  />
                                  <Button onClick={handleSaveField} size="sm" className="h-8 px-2">
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button onClick={handleCancelEdit} size="sm" variant="outline" className="h-8 px-2">
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-600 flex-1">
                                  {m.hauptmail || <span className="text-gray-400 italic">Keine E-Mail-Adresse</span>}
                                </span>
                              )}
                            </div>
                            {!(editingField?.mieterId === m.id && editingField?.field === 'hauptmail') && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditField(m.id, 'hauptmail', m.hauptmail || '');
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                  title="E-Mail-Adresse bearbeiten"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                {m.hauptmail && (
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
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Telefonnummer - immer anzeigen */}
                          <div className="flex items-center justify-between group">
                            <div className="flex items-center space-x-2 flex-1">
                              <Phone className="h-4 w-4 text-gray-500" />
                              {editingField?.mieterId === m.id && editingField?.field === 'telnr' ? (
                                <div className="flex items-center space-x-2 flex-1">
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Telefonnummer eingeben"
                                    type="tel"
                                  />
                                  <Button onClick={handleSaveField} size="sm" className="h-8 px-2">
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button onClick={handleCancelEdit} size="sm" variant="outline" className="h-8 px-2">
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-600 flex-1">
                                  {m.telnr || <span className="text-gray-400 italic">Keine Telefonnummer</span>}
                                </span>
                              )}
                            </div>
                            {!(editingField?.mieterId === m.id && editingField?.field === 'telnr') && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditField(m.id, 'telnr', m.telnr || '');
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                  title="Telefonnummer bearbeiten"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                {m.telnr && (
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
                                )}
                              </div>
                            )}
                          </div>
                          
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
                  
                  {/* Mahnstufen-Verwaltung kompakt */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium">Mahnstufe:</span>
                        <MahnstufeIndicator stufe={vertrag?.mahnstufe || 0} />
                      </div>
                      
                      <div className="flex items-center space-x-2">
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
                                  mahnstufe: Math.max(vertrag.mahnstufe || 0, 1), // Mindestens Stufe 1
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
                                description: `Mahnung wurde erfolgreich versendet.`,
                              });

                              // Mahnstufe erhöhen falls nötig
                              if ((vertrag.mahnstufe || 0) === 0) {
                                await handleMahnstufeChange(1);
                              }
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
                          variant="destructive"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Mahnung verschicken
                        </Button>
                      </div>
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
                      <p className="font-semibold text-lg">{formatBetrag((() => {
                        const kautionZahlungen = zahlungen?.filter(zahlung => zahlung.kategorie === 'Mietkaution') || [];
                        const kautionAusZahlungen = kautionZahlungen.reduce((sum, zahlung) => sum + (zahlung.betrag || 0), 0);
                        
                        // Verwende Kaution aus Zahlungen wenn vorhanden, sonst kaution_betrag wenn != 0
                        if (kautionZahlungen.length > 0) {
                          return kautionAusZahlungen;
                        } else if (vertrag?.kaution_betrag && vertrag.kaution_betrag !== 0) {
                          return vertrag.kaution_betrag;
                        }
                        return 0;
                      })())}</p>
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
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {monthlyComparison.map((monthly) => (
                        <div key={monthly.monat} className="p-2 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">
                                {new Date(monthly.monat + '-01').toLocaleDateString('de-DE', { 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <div className="text-xs text-gray-600 space-y-0.5">
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Zahlungen & Forderungen ({selectedYear})</CardTitle>
                    <div className="flex items-center space-x-2">
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
                    /* Enhanced Central Timeline View */
                    <div className="relative max-h-[40rem] overflow-y-auto py-6">
                      {(() => {
                        // Group data by months for better display
                        const monthlyData = new Map();
                        
                        // Add Forderungen to monthly data
                        if (forderungen) {
                          forderungen.forEach(forderung => {
                            const month = forderung.sollmonat;
                            if (!monthlyData.has(month)) {
                              monthlyData.set(month, { forderung: null, zahlungen: [] });
                            }
                            monthlyData.get(month).forderung = forderung;
                          });
                        }
                        
                        // Add Zahlungen to monthly data
                        if (zahlungen) {
                          zahlungen.forEach(zahlung => {
                            const zahlungsDatum = new Date(zahlung.buchungsdatum);
                            const month = zahlungsDatum.getFullYear() + '-' + String(zahlungsDatum.getMonth() + 1).padStart(2, '0');
                            
                            if (!monthlyData.has(month)) {
                              monthlyData.set(month, { forderung: null, zahlungen: [] });
                            }
                            monthlyData.get(month).zahlungen.push(zahlung);
                          });
                        }
                        
                        // Sort months chronologically (newest first)
                        const sortedMonths = Array.from(monthlyData.keys()).sort().reverse();
                        
                        if (sortedMonths.length === 0) {
                          return (
                            <div className="text-center py-12">
                              <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600 text-lg">Keine Zahlungen oder Forderungen gefunden</p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="relative px-4">
                            {/* Central Timeline - Enhanced */}
                            <div className="absolute left-1/2 top-0 w-1 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500 h-full transform -translate-x-0.5 z-0 shadow-lg"></div>
                            
                            {sortedMonths.map((month, index) => {
                              const data = monthlyData.get(month);
                              const monthDate = new Date(month + '-01');
                              const forderung = data.forderung;
                              const zahlungen = data.zahlungen;
                              
                              // Calculate due date for forderung
                              let faelligkeitsDatum = null;
                              let toleranzEnde = null;
                              if (forderung) {
                                const forderungsDatum = new Date(forderung.sollmonat + '-01');
                                faelligkeitsDatum = new Date(forderungsDatum.getFullYear(), forderungsDatum.getMonth() + 1, 1);
                                toleranzEnde = new Date(faelligkeitsDatum);
                                toleranzEnde.setDate(toleranzEnde.getDate() + 7);
                              }
                              
                              return (
                                <div key={month} className="relative mb-12 min-h-[140px] animate-fade-in">
                                  {/* Enhanced Month marker on timeline */}
                                  <div className="absolute left-1/2 w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full border-4 border-white shadow-xl transform -translate-x-1/2 z-20">
                                    <div className="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                      <div className="bg-white shadow-lg rounded-full px-4 py-2 border border-gray-200">
                                        <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                          {monthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-12 pt-16">
                                    {/* Left side - Forderungen (Enhanced) */}
                                    <div className="text-right pr-6">
                                      {forderung ? (
                                        <div className="inline-block animate-scale-in">
                                          <div className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 max-w-sm hover-scale">
                                            <div className="text-right">
                                              <div className="flex items-center justify-end mb-3">
                                                <div className="bg-red-500 rounded-full p-2 mr-2">
                                                  <span className="text-white text-sm">📋</span>
                                                </div>
                                                <p className="font-bold text-red-800 text-lg">
                                                  Forderung
                                                </p>
                                              </div>
                                              <p className="text-2xl font-black text-red-900 mb-2">
                                                {formatBetrag(Number(forderung.sollbetrag))}
                                              </p>
                                              <p className="text-sm text-red-700 mb-3 font-medium">
                                                Monat: {forderung.sollmonat}
                                              </p>
                                              
                                              {/* Enhanced Toleranzbereich */}
                                              <div className="mt-3 p-3 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-lg text-left">
                                                <div className="flex items-center">
                                                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                                  <p className="text-sm text-green-800 font-semibold">
                                                    7 Tage Toleranzbereich
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 text-lg italic font-medium">
                                          Keine Forderung
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Right side - Zahlungen (Enhanced) */}
                                    <div className="pl-6">
                                      {zahlungen.length > 0 ? (
                                        <div className="space-y-4">
                                          {zahlungen.map((zahlung, zahlungIndex) => {
                                            const zahlungsDatum = new Date(zahlung.buchungsdatum);
                                            let statusColor = 'green';
                                            let statusText = 'Pünktlich';
                                            let statusIcon = '✅';
                                            
                                            // Determine if payment is late
                                            if (forderung && faelligkeitsDatum) {
                                              const daysDiff = Math.ceil((zahlungsDatum.getTime() - faelligkeitsDatum.getTime()) / (1000 * 60 * 60 * 24));
                                              if (daysDiff > 7) {
                                                statusColor = 'red';
                                                statusText = `${daysDiff} Tage zu spät`;
                                                statusIcon = '❌';
                                              } else if (daysDiff > 0) {
                                                statusColor = 'orange';
                                                statusText = `${daysDiff} Tage nach Fälligkeit`;
                                                statusIcon = '⚠️';
                                              } else if (daysDiff < 0) {
                                                statusColor = 'blue';
                                                statusText = `${Math.abs(daysDiff)} Tage vor Fälligkeit`;
                                                statusIcon = '🚀';
                                              }
                                            }
                                            
                                            return (
                                              <div 
                                                key={zahlung.id} 
                                                className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 max-w-sm hover-scale animate-fade-in"
                                                style={{ animationDelay: `${zahlungIndex * 100}ms` }}
                                              >
                                                <div className="flex justify-between items-start mb-3">
                                                  <div className="flex-1">
                                                    <div className="flex items-center mb-2">
                                                      <div className="bg-green-500 rounded-full p-2 mr-2">
                                                        <span className="text-white text-sm">💰</span>
                                                      </div>
                                                      <p className="font-bold text-green-800 text-lg">
                                                        Zahlung
                                                      </p>
                                                    </div>
                                                    <p className="text-2xl font-black text-green-900 mb-2">
                                                      {formatBetrag(Number(zahlung.betrag))}
                                                    </p>
                                                    <p className="text-sm text-green-700 mb-2 font-medium">
                                                      {formatDatum(zahlung.buchungsdatum)}
                                                    </p>
                                                    
                                                    {/* Enhanced Status indicator */}
                                                    <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-bold shadow-md mb-2 ${
                                                      statusColor === 'green' ? 'bg-green-100 text-green-800 border border-green-300' :
                                                      statusColor === 'orange' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                                      statusColor === 'red' ? 'bg-red-100 text-red-800 border border-red-300' :
                                                      'bg-blue-100 text-blue-800 border border-blue-300'
                                                    }`}>
                                                      <span className="mr-2">{statusIcon}</span>
                                                      {statusText}
                                                    </div>
                                                    
                                                    {zahlung.verwendungszweck && (
                                                      <p className="text-sm text-green-600 bg-white p-2 rounded border border-green-200 truncate">
                                                        {zahlung.verwendungszweck}
                                                      </p>
                                                    )}
                                                  </div>
                                                  
                                                  {/* Enhanced Edit controls */}
                                                  <div className="flex flex-col space-y-2 ml-3">
                                                    {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'kategorie' ? (
                                                      <div className="flex flex-col space-y-2">
                                                        <Select value={editPaymentValue} onValueChange={setEditPaymentValue}>
                                                          <SelectTrigger className="h-8 text-xs w-24">
                                                            <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent className="bg-background border shadow-md z-50">
                                                            <SelectItem value="Miete">Miete</SelectItem>
                                                            <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                                            <SelectItem value="Nichtmiete">Nichtmiete</SelectItem>
                                                            <SelectItem value="Ignorieren">Ignorieren</SelectItem>
                                                          </SelectContent>
                                                        </Select>
                                                        <div className="flex space-x-1">
                                                          <Button onClick={handleSavePaymentField} size="sm" className="h-6 px-2">
                                                            <Check className="h-3 w-3" />
                                                          </Button>
                                                          <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 px-2">
                                                            <X className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="flex flex-col items-end space-y-2">
                                                        <Badge variant="outline" className="text-xs font-medium">
                                                          {zahlung.kategorie || 'Sonstige'}
                                                        </Badge>
                                                        <Button
                                                          onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 w-6 p-0 hover:bg-green-200"
                                                          title="Kategorie bearbeiten"
                                                        >
                                                          <Edit2 className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 text-lg italic font-medium">
                                          Keine Zahlungen
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* Classic List View */
                    <div className="space-y-4 max-h-[32rem] overflow-y-auto">
                      {zahlungen && zahlungen.length > 0 ? (
                        zahlungen.map((zahlung) => (
                          <div key={zahlung.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-lg">{formatBetrag(Number(zahlung.betrag))}</p>
                                <p className="text-sm text-gray-600">
                                  {zahlung.buchungsdatum ? formatDatum(zahlung.buchungsdatum) : 'N/A'}
                                </p>
                                <p className="text-sm text-gray-500 truncate max-w-xs">
                                  {zahlung.verwendungszweck || 'Kein Verwendungszweck'}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'kategorie' ? (
                                  <div className="flex items-center space-x-2">
                                    <Select value={editPaymentValue} onValueChange={setEditPaymentValue}>
                                      <SelectTrigger className="h-8 text-sm w-32">
                                        <SelectValue placeholder="Kategorie" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-background border shadow-md z-50">
                                        <SelectItem value="Miete">Miete</SelectItem>
                                        <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                        <SelectItem value="Nichtmiete">Nichtmiete</SelectItem>
                                        <SelectItem value="Ignorieren">Ignorieren</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button onClick={handleSavePaymentField} size="sm" className="h-8 px-3">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-8 px-3">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2 group">
                                    <Badge variant="outline" className="text-sm">
                                      {zahlung.kategorie || 'Sonstige'}
                                    </Badge>
                                    <Button
                                      onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                      variant="ghost"
                                      size="sm"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 text-lg">Keine Zahlungen gefunden</p>
                        </div>
                      )}
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