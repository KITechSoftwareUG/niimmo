import { useState, useMemo, useEffect } from "react";
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
import { FaelligkeitsIndicator } from "./FaelligkeitsIndicator";
import {
  Euro,
  Calendar,
  FileText,
  Building2,
  Users,
  Download,
  AlertCircle,
  Copy,
  Phone,
  Mail,
  Edit2,
  Check,
  X,
  ChevronDown,
  Square,
  Plus,
  ArrowRightLeft,
  Trash2,
  Gauge
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CreateForderungModal } from "./CreateForderungModal";
import { MietvertragInfo } from "./MietvertragInfo";
import { calculateMietvertragRueckstand } from "@/utils/rueckstandsberechnung";

interface MietvertragDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: any;
  immobilie?: any;
}

export default function MietvertragDetailsModal({
  isOpen,
  onClose,
  vertragId,
  einheit,
  immobilie
}: MietvertragDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [selectedMonth, setSelectedMonth] = useState<string>("alle");
  const [editingField, setEditingField] = useState<{ mieterId: string, field: 'hauptmail' | 'telnr' } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingPayment, setEditingPayment] = useState<{ zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag' } | null>(null);
  const [showDetailsExpanded, setShowDetailsExpanded] = useState(false);
  const [editPaymentValue, setEditPaymentValue] = useState<string>("");
  const [mietvertragSearchTerm, setMietvertragSearchTerm] = useState<string>("");
  const [editingForderung, setEditingForderung] = useState<{ forderungId: string, field: 'betrag' | 'monat' } | null>(null);
  const [editForderungValue, setEditForderungValue] = useState<string>("");
  const [editingKaution, setEditingKaution] = useState<'soll' | 'ist' | null>(null);
  const [kautionValue, setKautionValue] = useState<string>("");
  const [editingMietvertrag, setEditingMietvertrag] = useState<'kaltmiete' | 'betriebskosten' | null>(null);
  const [mietvertragValue, setMietvertragValue] = useState<string>("");
  const [showCreateForderungModal, setShowCreateForderungModal] = useState(false);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isOpen || !vertragId) return;

    const channel = supabase
      .channel(`mietvertrag-details-${vertragId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mietforderungen',
        filter: `mietvertrag_id=eq.${vertragId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] });
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
        queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'zahlungen',
        filter: `mietvertrag_id=eq.${vertragId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] });
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
        queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mietvertrag',
        filter: `id=eq.${vertragId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
        queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, vertragId, queryClient]);

  // Utility functions
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

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  const formatDatum = (datum: string) => {
    if (!datum) return 'N/A';
    return new Date(datum).toLocaleDateString('de-DE');
  };

  const getShortId = (id: string) => {
    return id.slice(-8);
  };

  // Data queries
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

  const { data: forderungen } = useQuery({
    queryKey: ['mietforderungen', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietforderungen')
        .select('*, ist_faellig, faelligkeitsdatum, faellig_seit')
        .eq('mietvertrag_id', vertragId)
        .order('monat', { ascending: false });

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

  // Calculate rent arrears
  const rueckstandsInfo = useMemo(() => {
    if (!forderungen || !zahlungen || !vertrag) return null;
    
    return calculateMietvertragRueckstand(
      vertrag,
      forderungen,
      zahlungen
    );
  }, [vertrag, forderungen, zahlungen]);

  if (vertragLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Lade Vertragsdaten...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!vertrag) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="text-center py-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Vertrag nicht gefunden</h3>
            <p className="text-gray-600">Der angeforderte Mietvertrag konnte nicht geladen werden.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Mietvertrag Details - {getShortId(vertrag.id)}</span>
            <MahnstufeIndicator stufe={vertrag.mahnstufe} />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="uebersicht" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
            <TabsTrigger value="zaehlerstaende">Zählerstände</TabsTrigger>
            <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
          </TabsList>

          {/* Übersicht Tab - Merged with Payment History */}
          <TabsContent value="uebersicht" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contract Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Vertragsinformationen</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Status</p>
                      <Badge variant={vertrag.status === 'aktiv' ? 'default' : 'secondary'}>
                        {vertrag.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Start</p>
                      <p className="text-sm">{formatDatum(vertrag.start_datum)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ende</p>
                      <p className="text-sm">{vertrag.ende_datum ? formatDatum(vertrag.ende_datum) : 'Unbefristet'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Kaltmiete</p>
                      <p className="text-sm font-bold text-blue-600">{formatBetrag(Number(vertrag.kaltmiete || 0))}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Betriebskosten</p>
                      <p className="text-sm font-bold text-orange-600">{formatBetrag(Number(vertrag.betriebskosten || 0))}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Gesamtmiete</p>
                      <p className="text-sm font-bold text-green-600">
                        {formatBetrag(Number(vertrag.kaltmiete || 0) + Number(vertrag.betriebskosten || 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tenant Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Mieter</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mieter && mieter.length > 0 ? (
                    <div className="space-y-4">
                      {mieter.map((m: any) => (
                        <div key={m.id} className="p-4 border rounded-lg">
                          <p className="font-semibold">{m.vorname} {m.nachname}</p>
                          <div className="text-sm text-gray-600 space-y-1 mt-2">
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4" />
                              <span>{m.hauptmail || 'Keine E-Mail'}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4" />
                              <span>{m.telnr || 'Keine Telefonnummer'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">Keine Mieter gefunden</p>
                  )}
                </CardContent>
              </Card>

              {/* Property Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5" />
                    <span>Immobilie & Einheit</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {immobilie && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Immobilie</p>
                      <p className="font-semibold">{immobilie.name}</p>
                      <p className="text-sm text-gray-600">{immobilie.strasse}, {immobilie.plz} {immobilie.stadt}</p>
                    </div>
                  )}
                  {einheit && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Einheit</p>
                      <p className="font-semibold">{einheit.einheitentyp} - {einheit.id?.slice(-2) || 'N/A'}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <span>Stockwerk: {einheit.stockwerk || 'N/A'}</span>
                        <span>Fläche: {einheit.flaeche || 'N/A'} m²</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Euro className="h-5 w-5" />
                    <span>Finanzübersicht</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rueckstandsInfo && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-600">Gesamtforderungen</p>
                        <p className="text-lg font-bold text-blue-800">
                          {formatBetrag(rueckstandsInfo.gesamtForderungen)}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-600">Gesamtzahlungen</p>
                        <p className="text-lg font-bold text-green-800">
                          {formatBetrag(rueckstandsInfo.gesamtZahlungen)}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${rueckstandsInfo.rueckstand > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-medium ${rueckstandsInfo.rueckstand > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          Rückstand
                        </p>
                        <p className={`text-lg font-bold ${rueckstandsInfo.rueckstand > 0 ? 'text-red-800' : 'text-gray-800'}`}>
                          {formatBetrag(rueckstandsInfo.rueckstand)}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Kaution</p>
                        <p className="text-lg font-bold text-gray-800">
                          {formatBetrag(Number(vertrag.kaution_ist || 0))} / {formatBetrag(Number(vertrag.kaution_betrag || 0))}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  <span>Zahlungshistorie</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {zahlungen && zahlungen.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {zahlungen.map((zahlung) => (
                      <div key={zahlung.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-semibold">{formatBetrag(zahlung.betrag)}</p>
                          <p className="text-sm text-gray-600">{formatDatum(zahlung.buchungsdatum)}</p>
                          <p className="text-xs text-gray-500">{zahlung.kategorie}</p>
                        </div>
                        <Badge variant="outline">{zahlung.zugeordneter_monat || 'Nicht zugeordnet'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Euro className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Keine Zahlungen gefunden</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zählerstände Tab */}
          <TabsContent value="zaehlerstaende" className="space-y-4">
            <MietvertragInfo 
              vertrag={vertrag}
              einheit={einheit}
              immobilie={immobilie}
            />
          </TabsContent>

          {/* Dokumente Tab */}
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
                  <div className="space-y-3">
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
                            <Button
                              onClick={async () => {
                                if (!dokument.pfad) {
                                  toast({
                                    title: "Fehler",
                                    description: "Dateipfad nicht gefunden.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                try {
                                  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                                    .from('dokumente')
                                    .createSignedUrl(dokument.pfad, 60);
                                  if (signedUrlError) throw signedUrlError;

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
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
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

        {/* Create Forderung Modal */}
        <CreateForderungModal
          isOpen={showCreateForderungModal}
          onClose={() => setShowCreateForderungModal(false)}
          mietvertragId={vertragId}
          currentKaltmiete={vertrag?.kaltmiete || 0}
          currentBetriebskosten={vertrag?.betriebskosten || 0}
        />
      </DialogContent>
    </Dialog>
  );
}