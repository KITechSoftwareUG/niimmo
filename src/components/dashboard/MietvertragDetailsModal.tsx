import { useState, useMemo } from "react";
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
  Hash,
  ArrowRightLeft,
  Trash2
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MahnungVorschauModal } from "./MahnungVorschauModal";

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
  const [showMahnungModal, setShowMahnungModal] = useState(false);
  const [isLoadingSendMahnung, setIsLoadingSendMahnung] = useState(false);
  const [editingKaution, setEditingKaution] = useState<'soll' | 'ist' | null>(null);
  const [kautionValue, setKautionValue] = useState<string>("");

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

  const handleEditPaymentField = (zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag', currentValue: string) => {
    const zahlung = zahlungen?.find(z => z.id === zahlungId);

    setEditingPayment({ zahlungId, field });
    if (field === 'mietvertrag') {
      setEditPaymentValue(zahlung?.mietvertrag_id || '');
    } else if (field === 'monat') {
      const monthValue = zahlung?.zugeordneter_monat || zahlung?.buchungsdatum?.slice(0, 7) || '';
      setEditPaymentValue(monthValue);
    } else {
      setEditPaymentValue(currentValue || '');
    }
  };

  const handleSavePaymentField = async (customValue?: string) => {
    if (!editingPayment) return;

    const valueToSave = customValue !== undefined ? customValue : editPaymentValue;

    try {
      let updateData: any = {};

      if (editingPayment.field === 'kategorie') {
        updateData.kategorie = valueToSave as any;
      } else if (editingPayment.field === 'monat') {
        updateData.zugeordneter_monat = valueToSave;
      } else if (editingPayment.field === 'mietvertrag') {
        updateData.mietvertrag_id = valueToSave;
      }

      const { error, data } = await supabase
        .from('zahlungen')
        .update(updateData)
        .eq('id', editingPayment.zahlungId)
        .select();

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: `${editingPayment.field === 'kategorie' ? 'Kategorie' :
          editingPayment.field === 'monat' ? 'Zugeordneter Monat' :
            'Mietvertrag'} wurde erfolgreich aktualisiert.`,
      });

      setEditingPayment(null);
      setEditPaymentValue('');

      // Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-details', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);

    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: `${editingPayment.field === 'kategorie' ? 'Kategorie' :
          editingPayment.field === 'monat' ? 'Zugeordneter Monat' :
            'Mietvertrag'} konnte nicht aktualisiert werden.`,
        variant: "destructive",
      });
    }
  };

  const handleCancelPaymentEdit = () => {
    setEditingPayment(null);
    setEditPaymentValue('');
    setMietvertragSearchTerm('');
  };

  const handleEditKaution = async (field: 'soll' | 'ist', value: string) => {
    try {
      const updateData = field === 'soll' 
        ? { kaution_betrag: parseFloat(value) }
        : { kaution_ist: parseFloat(value) };

      const { error } = await supabase
        .from('mietvertrag')
        .update(updateData)
        .eq('id', vertragId);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: `Kaution ${field === 'soll' ? 'Soll' : 'Ist'} wurde erfolgreich aktualisiert.`,
      });

      setEditingKaution(null);
      setKautionValue('');

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });

    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: "Kaution konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteForderung = async (forderungId: string) => {
    try {
      const { error } = await supabase
        .from('mietforderungen')
        .delete()
        .eq('id', forderungId);

      if (error) throw error;

      toast({
        title: "Gelöscht",
        description: "Forderung wurde erfolgreich gelöscht.",
      });

      // Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
      ]);

    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleEditForderung = (forderungId: string, field: 'betrag' | 'monat', currentValue: string) => {
    setEditingForderung({ forderungId, field });
    setEditForderungValue(currentValue);
  };

  const handleSaveForderung = async (newValue: string) => {
    if (!editingForderung) return;

    try {
      const updateData: any = {};
      if (editingForderung.field === 'betrag') {
        updateData.sollbetrag = parseFloat(newValue) || 0;
      }

      const { error } = await supabase
        .from('mietforderungen')
        .update(updateData)
        .eq('id', editingForderung.forderungId);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Forderung wurde erfolgreich aktualisiert.",
        duration: 3000,
      });

      // Invalidate queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
      ]);

      setEditingForderung(null);
      setEditForderungValue("");
    } catch (error) {
      console.error('Error updating forderung:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht aktualisiert werden.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleCancelForderungEdit = () => {
    setEditingForderung(null);
    setEditForderungValue("");
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

  const { data: forderungen } = useQuery({
    queryKey: ['mietforderungen', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietforderungen')
        .select('*, ist_faellig, faelligkeitsdatum, faellig_seit')
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

  const { data: allMietvertraege } = useQuery({
    queryKey: ['all-mietvertraege'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          einheit_id,
          einheiten (
            immobilie_id,
            immobilien (
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
        `);

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen
  });

  // Drag and drop handlers
  const [draggedPayment, setDraggedPayment] = useState<string | null>(null);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, zahlungId: string) => {
    setDraggedPayment(zahlungId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', zahlungId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, targetMonth: string) => {
    event.preventDefault();
    const zahlungId = event.dataTransfer.getData('text/plain');

    if (!zahlungId || !targetMonth) return;

    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ zugeordneter_monat: targetMonth })
        .eq('id', zahlungId);

      if (error) throw error;

      toast({
        title: "Zahlung verschoben",
        description: `Zahlung wurde zu ${new Date(targetMonth + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} verschoben.`,
      });

      // Refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);

    } catch (error) {
      console.error('Error moving payment:', error);
      toast({
        title: "Fehler",
        description: "Zahlung konnte nicht verschoben werden.",
        variant: "destructive",
      });
    }

    setDraggedPayment(null);
  };

  const handleDragEnd = () => {
    setDraggedPayment(null);
  };

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

  if (vertragLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Lade Mietvertragsdaten...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!vertrag) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="text-center p-8">
            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Mietvertrag nicht gefunden</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Mietvertrag Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs defaultValue="uebersicht" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
              <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
            </TabsList>

            <TabsContent value="uebersicht" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Mietvertrag Informationen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Laufzeit</p>
                        <p className="text-lg">{vertrag.start_datum ? formatDatum(vertrag.start_datum) : 'N/A'} - {vertrag.ende_datum ? formatDatum(vertrag.ende_datum) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Status</p>
                        <Badge variant={vertrag.status === 'aktiv' ? 'default' : 'secondary'}>
                          {vertrag.status}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Kaltmiete</p>
                        <p className="text-lg font-semibold">{formatBetrag(Number(vertrag.kaltmiete))}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Betriebskosten</p>
                        <p className="text-lg">{formatBetrag(Number(vertrag.betriebskosten))}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Mieter Informationen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {mieter && mieter.length > 0 ? (
                      <div className="space-y-4">
                        {mieter.map((m: any) => (
                          <div key={m.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
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
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600">Keine Mieter gefunden</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Kaution Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Euro className="h-5 w-5" />
                    <span>Kaution Übersicht</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-blue-600">Kaution Soll</p>
                          {editingKaution === 'soll' ? (
                            <div className="flex items-center space-x-2 mt-1">
                              <Input
                                type="number"
                                value={kautionValue}
                                onChange={(e) => setKautionValue(e.target.value)}
                                className="w-32 h-8"
                                placeholder="Betrag"
                              />
                              <Button
                                onClick={() => handleEditKaution('soll', kautionValue)}
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingKaution(null);
                                  setKautionValue('');
                                }}
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 mt-1">
                              <p className="text-lg font-semibold text-blue-800">
                                {formatBetrag(Number(vertrag.kaution_betrag || 0))}
                              </p>
                              <Button
                                onClick={() => {
                                  setEditingKaution('soll');
                                  setKautionValue(String(vertrag.kaution_betrag || 0));
                                }}
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-green-600">Kaution Ist</p>
                          {editingKaution === 'ist' ? (
                            <div className="flex items-center space-x-2 mt-1">
                              <Input
                                type="number"
                                value={kautionValue}
                                onChange={(e) => setKautionValue(e.target.value)}
                                className="w-32 h-8"
                                placeholder="Betrag"
                              />
                              <Button
                                onClick={() => handleEditKaution('ist', kautionValue)}
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingKaution(null);
                                  setKautionValue('');
                                }}
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 mt-1">
                              <p className="text-lg font-semibold text-green-800">
                                {formatBetrag(Number(vertrag.kaution_ist || 0))}
                              </p>
                              <Button
                                onClick={() => {
                                  setEditingKaution('ist');
                                  setKautionValue(String(vertrag.kaution_ist || 0));
                                }}
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
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
                    <div className="space-y-8">
                      {/* Timeline Section */}
                      <div className="relative py-6">
                        {(() => {
                          // Filter out Mietkaution from timeline - they go to separate section
                          const timelineZahlungen = (zahlungen || []).filter(z => z.kategorie !== 'Mietkaution');

                          // Group data by months for better display
                          const monthlyData = new Map();

                          // Add ALL months with Forderungen
                          if (forderungen) {
                            forderungen.forEach(forderung => {
                              const month = forderung.sollmonat;
                              if (!monthlyData.has(month)) {
                                monthlyData.set(month, { forderung: null, zahlungen: [] });
                              }
                              monthlyData.get(month).forderung = forderung;
                            });
                          }

                          // Add ALL non-Kaution payments and create months for them if they don't exist
                          timelineZahlungen.forEach(zahlung => {
                            // Use zugeordneter_monat from DB, fallback to calculated month from buchungsdatum
                            const assignedMonth = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7);

                            if (assignedMonth) {
                              // Create month entry if it doesn't exist
                              if (!monthlyData.has(assignedMonth)) {
                                monthlyData.set(assignedMonth, { forderung: null, zahlungen: [] });
                              }
                              monthlyData.get(assignedMonth).zahlungen.push(zahlung);
                            }
                          });

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
                            <div className="relative px-8 py-8">
                              {/* Central Timeline */}
                              <div className="absolute left-1/2 top-0 w-0.5 bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400 h-full transform -translate-x-0.5 z-0 opacity-60"></div>

                              {sortedMonths.map((month, index) => {
                                const data = monthlyData.get(month);
                                const monthDate = new Date(month + '-01');
                                const forderung = data.forderung;
                                const zahlungen = data.zahlungen;

                                return (
                                  <div
                                    key={month}
                                    className="relative mb-20 min-h-[180px] animate-fade-in"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, month)}
                                  >
                                    {/* Month marker */}
                                    <div className="absolute left-1/2 w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full border-3 border-white shadow-lg transform -translate-x-1/2 z-20">
                                      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                        <div className="bg-white shadow-md rounded-lg px-4 py-2 border border-gray-100">
                                          <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                            {monthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-20 pt-16">
                                       {/* Left side - Forderungen */}
                                       <div className="pr-10">
                                         {forderung ? (
                                           <div className="w-full">
                                             <div className="w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm group relative">
                                               {/* Delete icon in top left */}
                                               <Button
                                                 onClick={() => handleDeleteForderung(forderung.id)}
                                                 variant="ghost"
                                                 size="sm"
                                                 className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                 title="Forderung löschen"
                                               >
                                                 <Trash2 className="h-3 w-3" />
                                               </Button>
                                               
                                               <div className="flex justify-center items-center flex-col text-center pt-2">
                                                 <div className="flex items-center justify-center mb-2">
                                                   <div className="bg-red-100 rounded-full p-1.5 mr-2">
                                                     <span className="text-red-600 text-xs">📋</span>
                                                   </div>
                                                   <p className="font-semibold text-red-600 text-sm">Forderung</p>
                                                 </div>
                                                 
                                                 {/* Editable amount */}
                                                 {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'betrag' ? (
                                                   <div className="flex items-center space-x-2">
                                                     <Input
                                                       type="number"
                                                       value={editForderungValue}
                                                       onChange={(e) => setEditForderungValue(e.target.value)}
                                                       className="w-24 h-8 text-center"
                                                       step="0.01"
                                                     />
                                                     <Button onClick={() => handleSaveForderung(editForderungValue)} size="sm" className="h-6 text-xs">
                                                       ✓
                                                     </Button>
                                                     <Button onClick={handleCancelForderungEdit} size="sm" variant="outline" className="h-6 text-xs">
                                                       ✕
                                                     </Button>
                                                   </div>
                                                 ) : (
                                                   <p 
                                                     className="text-xl font-bold text-red-700 mb-1 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                                                     onClick={() => handleEditForderung(forderung.id, 'betrag', forderung.sollbetrag.toString())}
                                                   >
                                                     {formatBetrag(Number(forderung.sollbetrag))}
                                                   </p>
                                                 )}
                                               </div>
                                             </div>
                                           </div>
                                         ) : (
                                           <div className="w-full p-4 text-center text-gray-500">
                                             <p className="text-sm italic">Keine Forderung</p>
                                           </div>
                                         )}
                                       </div>

                                      {/* Right side - Zahlungen */}
                                      <div className="pl-10">
                                        {zahlungen.length > 0 ? (
                                          <div className="space-y-3">
                                            {zahlungen.map((zahlung) => (
                                              <div
                                                key={zahlung.id}
                                                className="w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm cursor-move"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, zahlung.id)}
                                                onDragEnd={handleDragEnd}
                                              >
                                                <div className="flex justify-between items-start">
                                                  <div className="flex-1">
                                                    <div className="flex items-center mb-2">
                                                      <div className="bg-green-100 rounded-full p-1.5 mr-2">
                                                        <span className="text-green-600 text-xs">💰</span>
                                                      </div>
                                                      <p className="font-semibold text-green-600 text-sm">Zahlung</p>
                                                    </div>

                                                    <p className="text-xl font-bold text-green-700 mb-1">
                                                      {formatBetrag(Number(zahlung.betrag))}
                                                    </p>

                                                    <p className="text-sm text-gray-600 mb-1">
                                                      {formatDatum(zahlung.buchungsdatum)}
                                                    </p>

                                                    {zahlung.verwendungszweck && (
                                                      <p className="text-xs text-gray-500 mb-2">
                                                        {zahlung.verwendungszweck}
                                                      </p>
                                                    )}

                                                    <div className="flex items-center space-x-2">
                                                      {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'kategorie' ? (
                                                        <div className="flex items-center space-x-1">
                                                          <Select
                                                            value={editPaymentValue}
                                                            onValueChange={setEditPaymentValue}
                                                          >
                                                            <SelectTrigger className="w-32 h-6 text-xs">
                                                              <SelectValue placeholder="Kategorie" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              <SelectItem value="Miete">Miete</SelectItem>
                                                              <SelectItem value="Nebenkosten">Nebenkosten</SelectItem>
                                                              <SelectItem value="Kaution">Kaution</SelectItem>
                                                              <SelectItem value="Sonstige">Sonstige</SelectItem>
                                                            </SelectContent>
                                                          </Select>
                                                          <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                                            <Check className="h-3 w-3" />
                                                          </Button>
                                                          <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                                            <X className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center space-x-1">
                                                          <Badge variant="outline" className="text-sm">
                                                            {zahlung.kategorie || 'Sonstige'}
                                                          </Badge>
                                                          <Button
                                                            onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                                          >
                                                            <Edit2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Month Edit */}
                                                    <div className="mt-2">
                                                      {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'monat' ? (
                                                        <div className="flex items-center space-x-1">
                                                          <Input
                                                            type="month"
                                                            value={editPaymentValue}
                                                            onChange={(e) => setEditPaymentValue(e.target.value)}
                                                            className="w-32 h-6 text-xs"
                                                          />
                                                          <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                                            <Check className="h-3 w-3" />
                                                          </Button>
                                                          <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                                            <X className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center space-x-1">
                                                          <Badge variant="secondary" className="text-xs">
                                                            {zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || 'Unzugeordnet'}
                                                          </Badge>
                                                          <Button
                                                            onClick={() => handleEditPaymentField(zahlung.id, 'monat', zahlung.zugeordneter_monat || '')}
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                                          >
                                                            <Calendar className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Mietvertrag Edit */}
                                                    <div className="mt-2">
                                                      {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'mietvertrag' ? (
                                                        <div className="space-y-2">
                                                          <Input
                                                            placeholder="Suche Mietvertrag..."
                                                            value={mietvertragSearchTerm}
                                                            onChange={(e) => setMietvertragSearchTerm(e.target.value)}
                                                            className="w-full h-6 text-xs"
                                                          />
                                                          <div className="max-h-32 overflow-y-auto space-y-1">
                                                            {allMietvertraege?.slice(0, 10).map(mv => {
                                                              const mieterNames = mv.mietvertrag_mieter?.map(mm => `${mm.mieter?.vorname} ${mm.mieter?.nachname}`).join(', ') || 'Keine Mieter';
                                                              const einheitId = mv.einheit_id?.slice(-2) || 'XX';
                                                              return (
                                                                <button
                                                                  key={mv.id}
                                                                  onClick={() => handleSavePaymentField(mv.id)}
                                                                  className="w-full text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded"
                                                                >
                                                                  <div className="font-medium">{mv.einheiten?.immobilien?.name} - Einheit {einheitId}</div>
                                                                  <div className="text-gray-600">{mv.einheiten?.immobilien?.adresse}</div>
                                                                  <div className="text-blue-600 mt-1">{mieterNames}</div>
                                                                </button>
                                                              );
                                                            })}
                                                          </div>
                                                          <div className="flex items-center space-x-1">
                                                            <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 text-xs">
                                                              Abbrechen
                                                            </Button>
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center space-x-1">
                                                          <Badge variant="outline" className="text-xs">
                                                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                                                            Objekt
                                                          </Badge>
                                                          <Button
                                                            onClick={() => handleEditPaymentField(zahlung.id, 'mietvertrag', zahlung.mietvertrag_id || '')}
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                                          >
                                                            <Edit2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="w-full p-4 text-center text-gray-500">
                                            <p className="text-sm italic">Keine Zahlungen</p>
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
                    </div>
                  ) : (
                    /* List View */
                    <div className="space-y-4">
                      {(() => {
                        // Filter out Mietkaution from list view too - they appear in separate section
                        const listZahlungen = (zahlungen || []).filter(z => z.kategorie !== 'Mietkaution');

                        return listZahlungen.length > 0 ? (
                          listZahlungen.map((zahlung) => (
                            <div key={zahlung.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-lg font-semibold text-gray-900">
                                    {zahlung.betrag?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {formatDatum(zahlung.buchungsdatum)}
                                  </p>
                                  {zahlung.verwendungszweck && (
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                      {zahlung.verwendungszweck}
                                    </p>
                                  )}
                                  <div className="flex items-center mt-2 space-x-4">
                                    {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'kategorie' ? (
                                      <div className="flex items-center space-x-1">
                                        <Select
                                          value={editPaymentValue}
                                          onValueChange={setEditPaymentValue}
                                        >
                                          <SelectTrigger className="w-32 h-6 text-xs">
                                            <SelectValue placeholder="Kategorie" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Miete">Miete</SelectItem>
                                            <SelectItem value="Nebenkosten">Nebenkosten</SelectItem>
                                            <SelectItem value="Kaution">Kaution</SelectItem>
                                            <SelectItem value="Sonstige">Sonstige</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                          <Check className="h-3 w-3" />
                                        </Button>
                                        <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-1">
                                        <Badge variant="outline" className="text-xs font-medium">
                                          {zahlung.kategorie || 'Sonstige'}
                                        </Badge>
                                        <Button
                                          onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}

                                    {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'monat' ? (
                                      <div className="flex items-center space-x-1">
                                        <Input
                                          type="month"
                                          value={editPaymentValue}
                                          onChange={(e) => setEditPaymentValue(e.target.value)}
                                          className="w-32 h-6 text-xs"
                                        />
                                        <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                          <Check className="h-3 w-3" />
                                        </Button>
                                        <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-1">
                                        <Badge variant="secondary" className="text-xs">
                                          {zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || 'Unzugeordnet'}
                                        </Badge>
                                        <Button
                                          onClick={() => handleEditPaymentField(zahlung.id, 'monat', zahlung.zugeordneter_monat || '')}
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                        >
                                          <Calendar className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-12">
                            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">Keine Zahlungen gefunden</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Kaution Section - at the bottom */}
                  {(() => {
                    const kautionZahlungen = zahlungen?.filter(z =>
                      z.mietvertrag_id === vertragId && z.kategorie === 'Mietkaution'
                    ) || [];

                    if (kautionZahlungen.length === 0) return null;

                    return (
                      <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <div className="bg-purple-100 rounded-full p-2 mr-3">
                            <span className="text-purple-600 text-lg">🏠</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-purple-800">Mietkaution</h3>
                            <p className="text-sm text-purple-600">Gezahlt bei Mietbeginn</p>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          {kautionZahlungen.map((zahlung) => (
                            <div
                              key={zahlung.id}
                              className="bg-white border border-purple-200 rounded-lg p-4 shadow-sm group"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-bold text-xl text-purple-700">
                                    {zahlung.betrag?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                  </p>
                                  <p className="text-sm text-purple-600">
                                    {formatDatum(zahlung.buchungsdatum)}
                                  </p>
                                  {zahlung.verwendungszweck && (
                                    <p className="text-xs text-purple-500 mt-1">
                                      {zahlung.verwendungszweck}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right flex items-center space-x-2">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    Kaution
                                  </span>
                                  <Button
                                    onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                    title="Kategorie ändern"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
}