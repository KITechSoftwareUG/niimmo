import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MahnstufeIndicator } from "./MahnstufeIndicator";
import { FaelligkeitsIndicator } from "./FaelligkeitsIndicator";
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
  Edit2,
  Save,
  X,
  Check,
  Trash,
  Send,
  Calculator,
  MapPin,
  Home,
  User,
  Banknote,
  Clock,
  Eye,
  EyeOff
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
  const [editingPayment, setEditingPayment] = useState<{zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag'} | null>(null);
  const [showDetailsExpanded, setShowDetailsExpanded] = useState(false);
  const [editPaymentValue, setEditPaymentValue] = useState<string>("");
  const [mietvertragSearchTerm, setMietvertragSearchTerm] = useState<string>("");
  const [editingForderung, setEditingForderung] = useState<{forderungId: string, field: 'betrag' | 'monat'} | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-mieter-detail'] });

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

  const handleSavePaymentField = async () => {
    if (!editingPayment) return;

    try {
      let updateData: any = {};

      if (editingPayment.field === 'kategorie') {
        updateData.kategorie = editPaymentValue;
      } else if (editingPayment.field === 'monat') {
        updateData.zugeordneter_monat = editPaymentValue;
      } else if (editingPayment.field === 'mietvertrag') {
        updateData.mietvertrag_id = editPaymentValue;
      }

      const { error } = await supabase
        .from('zahlungen')
        .update(updateData)
        .eq('id', editingPayment.zahlungId);

      if (error) {
        console.error('Supabase Fehler:', error);
        throw error;
      }

      toast({
        title: "Aktualisiert",
        description: `${editingPayment.field === 'kategorie' ? 'Kategorie' : 
                        editingPayment.field === 'monat' ? 'Zugeordneter Monat' : 
                        'Mietvertrag'} wurde erfolgreich aktualisiert.`,
      });

      setEditingPayment(null);
      setEditPaymentValue('');
      
      queryClient.invalidateQueries({ 
        queryKey: ['zahlungen-detail', vertragId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['rueckstaende'] 
      });

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
  };

  const getFilteredMietvertraege = () => {
    if (!alleMietvertraege) return [];
    
    return alleMietvertraege.filter(mv => {
      if (!mietvertragSearchTerm) return true;
      
      const searchTerm = mietvertragSearchTerm.toLowerCase();
      // Note: Based on schema, einheiten doesn't have direct relations to immobilien/mieter
      // This would need to be adjusted based on actual data structure
      return true; // Simplified for now
    });
  };

  const handleEditForderungField = (forderungId: string, field: 'betrag' | 'monat', currentValue: string) => {
    setEditingForderung({ forderungId, field });
    setEditForderungValue(currentValue);
  };

  const handleSaveForderungField = async () => {
    if (!editingForderung) return;

    try {
      let updateData: any = {};
      if (editingForderung.field === 'betrag') {
        updateData.sollbetrag = parseFloat(editForderungValue) || 0;
      } else if (editingForderung.field === 'monat') {
        updateData.sollmonat = editForderungValue;
      }

      const { error } = await supabase
        .from('mietforderungen')
        .update(updateData)
        .eq('id', editingForderung.forderungId);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: `${editingForderung.field === 'betrag' ? 'Betrag' : 'Monat'} wurde erfolgreich aktualisiert.`,
      });

      setEditingForderung(null);
      setEditForderungValue('');
      queryClient.invalidateQueries({ queryKey: ['forderungen-detail'] });

    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCancelForderungEdit = () => {
    setEditingForderung(null);
    setEditForderungValue('');
  };

  const handleEditKaution = (type: 'soll' | 'ist') => {
    setEditingKaution(type);
    const currentValue = type === 'soll' ? (vertrag?.kaution_betrag || 0) : (vertrag?.kaution_ist || 0);
    setKautionValue(currentValue.toString());
  };

  const handleSaveKaution = async () => {
    if (!editingKaution || !vertrag) return;

    const fieldName = editingKaution === 'soll' ? 'kaution_betrag' : 'kaution_ist';
    const numericValue = parseFloat(kautionValue) || 0;

    try {
      const { error } = await supabase
        .from('mietvertrag')
        .update({ [fieldName]: numericValue })
        .eq('id', vertrag.id);

      if (error) throw error;
      
      toast({
        title: "Gespeichert",
        description: `Kaution ${editingKaution === 'soll' ? 'Soll' : 'Ist'} wurde aktualisiert.`,
      });

      setEditingKaution(null);
      setKautionValue('');
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail'] });

    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler",
        description: "Kaution konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCancelKautionEdit = () => {
    setEditingKaution(null);
    setKautionValue('');
  };

  const handleKautionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveKaution();
    } else if (e.key === 'Escape') {
      handleCancelKautionEdit();
    }
  };

  const handleDeleteForderung = async (forderungId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Forderung löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mietforderungen')
        .delete()
        .eq('id', forderungId);

      if (error) throw error;

      toast({
        title: "Forderung gelöscht",
        description: "Die Forderung wurde erfolgreich gelöscht.",
      });

      queryClient.invalidateQueries({ queryKey: ['forderungen-detail'] });

    } catch (error) {
      console.error('Fehler beim Löschen der Forderung:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleSendMahnungFromModal = async () => {
    if (!vertrag) return;
    
    setIsLoadingSendMahnung(true);
    try {
      const newMahnstufe = (vertrag.mahnstufe || 0) + 1;
      const { error } = await supabase
        .from('mietvertrag')
        .update({ 
          mahnstufe: newMahnstufe,
          letzte_mahnung: new Date().toISOString()
        })
        .eq('id', vertrag.id);

      if (error) throw error;

      toast({
        title: "Mahnung verschickt",
        description: `Mahnung der Stufe ${newMahnstufe} wurde erfolgreich verschickt.`,
      });

      setShowMahnungModal(false);
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail'] });

    } catch (error) {
      console.error('Fehler beim Versenden der Mahnung:', error);
      toast({
        title: "Fehler",
        description: "Mahnung konnte nicht verschickt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSendMahnung(false);
    }
  };

  const { data: vertrag, isLoading: vertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select('*')
        .eq('id', vertragId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vertragId && isOpen,
  });

  const { data: mieter } = useQuery({
    queryKey: ['mietvertrag-mieter-detail', vertragId],
    queryFn: async () => {
      if (!vertragId) return [];

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
      return data?.map(item => item.mieter).filter(Boolean) || [];
    },
    enabled: !!vertragId && isOpen,
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
    enabled: !!vertragId && isOpen,
  });

  const { data: alleMietvertraege } = useQuery({
    queryKey: ['alle-mietvertraege'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          einheit_id
        `);

      if (error) throw error;
      
      const sorted = (data || []).sort((a, b) => {
        // Simple sorting by ID for now since we don't have the full relations
        return a.id.localeCompare(b.id);
      });

      return sorted;
    },
    enabled: isOpen,
  });

  const { data: forderungen } = useQuery({
    queryKey: ['forderungen-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietforderungen')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('sollmonat', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!vertragId && isOpen,
  });

  const { data: dokumente } = useQuery({
    queryKey: ['dokumente-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('erstellt_am', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!vertragId && isOpen,
  });

  const handleUpdateMahnstufe = async (newMahnstufe: number) => {
    if (!vertrag) return;

    try {
      const { error } = await supabase
        .from('mietvertrag')
        .update({ 
          mahnstufe: newMahnstufe,
          letzte_mahnung: new Date().toISOString()
        })
        .eq('id', vertrag.id);

      if (error) throw error;

      toast({
        title: "Mahnstufe aktualisiert",
        description: `Mahnstufe wurde auf ${newMahnstufe} gesetzt.`,
      });

      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail'] });
      queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });

    } catch (error) {
      console.error('Fehler beim Aktualisieren der Mahnstufe:', error);
      toast({
        title: "Fehler",
        description: "Mahnstufe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCheckMahnstufen = async () => {
    try {
      const { error } = await supabase.functions.invoke('check-mahnstufen');

      if (error) throw error;

      toast({
        title: "Mahnstufen-Prüfung abgeschlossen",
        description: "Alle Mahnstufen wurden überprüft und aktualisiert.",
      });

      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail'] });

    } catch (error) {
      console.error('Fehler bei der Mahnstufen-Prüfung:', error);
      toast({
        title: "Fehler",
        description: "Mahnstufen-Prüfung konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    }
  };

  const formatBetrag = (betrag: number) => {
    if (betrag === undefined || betrag === null) return "0,00 €";
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  const formatDatum = (datum: string) => {
    if (!datum) return "-";
    return new Date(datum).toLocaleDateString('de-DE');
  };

  const handleDownloadDocument = async (dokument: any) => {
    try {
      if (!dokument.pfad) {
        toast({
          title: "Fehler",
          description: "Kein Dateipfad verfügbar.",
          variant: "destructive",
        });
        return;
      }

      const bucketName = dokument.pfad.startsWith('mietvertraege/') ? 'mietvertraege' : 
                        dokument.pfad.startsWith('mahnungen/') ? 'mahnungen' : 'dokumente';
      
      const fileName = dokument.pfad.split('/').pop() || dokument.dateiname;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = dokument.dateiname || fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: `${dokument.dateiname} wurde heruntergeladen.`,
      });

    } catch (error) {
      console.error('Download-Fehler:', error);
      toast({
        title: "Download-Fehler",
        description: "Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const calculateRueckstand = useCallback(() => {
    if (!forderungen || !zahlungen || !vertrag) {
      return {
        gesamtForderungen: 0,
        gesamtZahlungen: 0,
        rueckstand: 0
      };
    }

    const startDatum = new Date(vertrag.start_datum);
    const jetzt = new Date();

    const relevanteForderungen = forderungen.filter(f => {
      const sollDatum = new Date(f.sollmonat + '-01');
      return sollDatum >= startDatum && sollDatum <= jetzt;
    });

    const relevanteZahlungen = zahlungen.filter(z => {
      if (!z.buchungsdatum) return false;
      const zahlungsDatum = new Date(z.buchungsdatum);
      if (zahlungsDatum < startDatum) return false;

      return z.kategorie === 'Miete' || 
             z.kategorie === 'Mietkaution' ||
             z.kategorie === null || 
             (z.betrag > 0 && z.kategorie !== 'Nichtmiete' && String(z.kategorie) !== 'Ignorieren');
    });

    const gesamtForderungen = relevanteForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
    const gesamtZahlungen = relevanteZahlungen.reduce((sum, z) => sum + (Number(z.betrag) || 0), 0);

    return {
      gesamtForderungen,
      gesamtZahlungen,
      rueckstand: gesamtForderungen - gesamtZahlungen
    };
  }, [forderungen, zahlungen, vertrag]);

  const { 
    gesamtForderungen, 
    gesamtZahlungen, 
    rueckstand
  } = calculateRueckstand();

  const sollMiete = vertrag ? (Number(vertrag.kaltmiete) || 0) + (Number(vertrag.betriebskosten) || 0) : 0;

  const generateMonthlyComparison = () => {
    if (!forderungen || !zahlungen || !vertrag) return [];
    
    const monthlyData = [];
    
    for (const forderung of forderungen) {
      const monthKey = forderung.sollmonat;

      const existingMonth = monthlyData.find(m => m.monat === monthKey);
      if (existingMonth) {
        existingMonth.soll += Number(forderung.sollbetrag) || 0;
        continue;
      }
      
      const monthPayments = zahlungen.filter(zahlung => {
        const zugeordneterMonat = zahlung.zugeordneter_monat;
        const buchungsmonat = zahlung.buchungsdatum ? zahlung.buchungsdatum.slice(0, 7) : null;
        
        return (zugeordneterMonat === monthKey) || 
               (!zugeordneterMonat && buchungsmonat === monthKey);
      });

      const istBetrag = monthPayments
        .filter(z => z.kategorie === 'Miete' || z.kategorie === 'Mietkaution' || z.kategorie === null)
        .reduce((sum, zahlung) => sum + (Number(zahlung.betrag) || 0), 0);

      monthlyData.push({
        monat: monthKey,
        soll: Number(forderung.sollbetrag) || 0,
        ist: istBetrag,
        differenz: (Number(forderung.sollbetrag) || 0) - istBetrag,
        zahlungen: monthPayments
      });
    }

    return monthlyData.sort((a, b) => b.monat.localeCompare(a.monat));
  };

  const monthlyComparison = generateMonthlyComparison();

  const getAvailableYears = useMemo(() => {
    const years = new Set<number>();
    
    forderungen?.forEach(f => {
      if (f.sollmonat) {
        const year = parseInt(f.sollmonat.split('-')[0]);
        years.add(year);
      }
    });

    zahlungen?.forEach(z => {
      if (z.buchungsdatum) {
        const year = new Date(z.buchungsdatum).getFullYear();
        years.add(year);
      }
    });

    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    years.add(currentYear - 1);
    years.add(currentYear + 1);

    return Array.from(years).sort((a, b) => b - a);
  }, [forderungen, zahlungen]);

  const getAvailableMonths = useMemo(() => {
    const months = new Set<{ value: string, label: string }>();
    
    const currentYear = parseInt(selectedYear);
    for (let month = 1; month <= 12; month++) {
      const monthNum = parseInt(month.toString());
      months.add({
        value: monthNum.toString(),
        label: new Date(currentYear, monthNum - 1).toLocaleDateString('de-DE', { month: 'long' })
      });
    }

    return Array.from(months).sort((a, b) => parseInt(a.value) - parseInt(b.value));
  }, [selectedYear]);

  const filteredMonthlyData = useMemo(() => {
    return monthlyComparison.filter(month => {
      if (!month.monat) return false;
      
      const [year, monthNum] = month.monat.split('-');
      
      if (selectedYear !== "alle" && year !== selectedYear) return false;
      if (selectedMonth !== "alle" && monthNum !== selectedMonth.padStart(2, '0')) return false;
      
      return true;
    });
  }, [monthlyComparison, selectedYear, selectedMonth]);

  if (vertragLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <AlertCircle className="h-8 w-8 text-red-500 mr-2" />
            <span>Vertrag nicht gefunden</span>
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
            <span>Mietvertrag Details</span>
            <Badge variant={rueckstand > 0 ? "destructive" : "default"}>
              {immobilie?.name} - Einheit {einheit?.nummer}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
              <TabsTrigger value="payments">Zahlungen</TabsTrigger>
              <TabsTrigger value="demands">Forderungen</TabsTrigger>
              <TabsTrigger value="documents">Dokumente</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>Immobilie & Einheit</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Immobilie</p>
                      <p className="font-medium">{immobilie?.name || "Nicht verfügbar"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Adresse</p>
                      <p className="font-medium">
                        {immobilie?.adresse || "Nicht verfügbar"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Einheit</p>
                      <p className="font-medium">Nummer {einheit?.nummer || "Nicht verfügbar"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Größe</p>
                      <p className="font-medium">{einheit?.groesse || "Nicht verfügbar"} m²</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Mieter</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {mieter && mieter.length > 0 ? (
                      mieter.map((m, index) => (
                        <div key={m.id} className="border-b pb-3 last:border-b-0">
                          <p className="font-medium">{m.vorname} {m.nachname}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Mail className="h-4 w-4 text-gray-400" />
                            {editingField?.mieterId === m.id && editingField?.field === 'hauptmail' ? (
                              <div className="flex items-center space-x-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-6 text-sm flex-1"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') handleSaveField();
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={handleSaveField}
                                  className="h-6 px-2"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  className="h-6 px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span className="text-sm">{m.hauptmail || "Keine E-Mail"}</span>
                                <button
                                  onClick={() => handleEditField(m.id, 'hauptmail', m.hauptmail || '')}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title="E-Mail bearbeiten"
                                >
                                  <Edit2 className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                </button>
                                {m.hauptmail && (
                                  <button
                                    onClick={() => copyToClipboard(m.hauptmail, 'E-Mail-Adresse')}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="E-Mail kopieren"
                                  >
                                    <Copy className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {editingField?.mieterId === m.id && editingField?.field === 'telnr' ? (
                              <div className="flex items-center space-x-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-6 text-sm flex-1"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') handleSaveField();
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={handleSaveField}
                                  className="h-6 px-2"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  className="h-6 px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span className="text-sm">{m.telnr || "Keine Telefonnummer"}</span>
                                <button
                                  onClick={() => handleEditField(m.id, 'telnr', m.telnr || '')}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title="Telefonnummer bearbeiten"
                                >
                                  <Edit2 className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                </button>
                                {m.telnr && (
                                  <button
                                    onClick={() => copyToClipboard(m.telnr, 'Telefonnummer')}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="Telefonnummer kopieren"
                                  >
                                    <Copy className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          {m.geburtsdatum && (
                            <p className="text-xs text-gray-500 mt-1">
                              Geburt: {formatDatum(m.geburtsdatum)}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">Keine Mieter gefunden</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Vertragsdaten</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Vertragsbeginn</p>
                      <p className="font-medium">{formatDatum(vertrag.start_datum)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Vertragsende</p>
                      <p className="font-medium">{vertrag.ende_datum ? formatDatum(vertrag.ende_datum) : "Unbefristet"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kaltmiete</p>
                      <p className="font-medium">{formatBetrag(vertrag.kaltmiete)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Betriebskosten</p>
                      <p className="font-medium">{formatBetrag(vertrag.betriebskosten)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Gesamtmiete</p>
                      <p className="font-bold text-lg">{formatBetrag(sollMiete)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calculator className="h-4 w-4" />
                      <span>Finanzübersicht</span>
                      <MahnstufeIndicator stufe={vertrag.mahnstufe || 0} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Gesamtforderungen</p>
                        <p className="font-bold text-lg">{formatBetrag(gesamtForderungen)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Gesamtzahlungen</p>
                        <p className="font-bold text-lg text-green-600">{formatBetrag(gesamtZahlungen)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Rückstand</p>
                      <p className={`font-bold text-xl ${
                        rueckstand > 0 
                          ? 'text-red-600' 
                          : rueckstand < 0 
                            ? 'text-green-600' 
                            : 'text-gray-600'
                      }`}>
                        {formatBetrag(rueckstand)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-full">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Banknote className="h-4 w-4" />
                        <span>Kaution</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDetailsExpanded(!showDetailsExpanded)}
                      >
                        {showDetailsExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div 
                        className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleEditKaution('soll')}
                      >
                        <div className="flex items-center justify-between">
                          <Input
                            value={kautionValue}
                            onChange={(e) => setKautionValue(e.target.value)}
                            onKeyPress={handleKautionKeyPress}
                            className="h-8 text-sm"
                            placeholder="Kaution Soll eingeben..."
                          />
                          <Button
                            onClick={handleSaveKaution}
                            className="ml-2 h-8 px-3"
                            size="sm"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>

                        <div 
                          className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => handleEditKaution('ist')}
                        >
                          <Input
                            value={kautionValue}
                            onChange={(e) => setKautionValue(e.target.value)}
                            onKeyPress={handleKautionKeyPress}
                            className="h-8 text-sm"
                            placeholder="Kaution Ist eingeben..."
                          />
                          <Button
                            onClick={handleSaveKaution}
                            className="ml-2 h-8 px-3"
                            size="sm"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {showDetailsExpanded && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span>Mahnwesen</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center space-x-4">
                              <MahnstufeIndicator stufe={vertrag.mahnstufe || 0} />
                              <div className="flex space-x-2">
                                {[0, 1, 2, 3].map((stufe) => (
                                  <Button
                                    key={stufe}
                                    variant={vertrag.mahnstufe === stufe ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleUpdateMahnstufe(stufe)}
                                  >
                                    {stufe === 0 ? "Keine" : `Stufe ${stufe}`}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            
                            {vertrag.letzte_mahnung_am && (
                              <div>
                                <p className="text-sm text-gray-600">Letzte Mahnung</p>
                                <p className="font-medium">{formatDatum(vertrag.letzte_mahnung_am)}</p>
                              </div>
                            )}

                            <div className="flex space-x-2">
                              <Button
                                onClick={() => setShowMahnungModal(true)}
                                variant="outline"
                                size="sm"
                                disabled={rueckstand <= 0}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Mahnung versenden
                              </Button>
                              
                              <Button
                                onClick={handleCheckMahnstufen}
                                variant="outline"
                                size="sm"
                              >
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Mahnstufen prüfen
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Zahlungsübersicht</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Jahr" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alle">Alle Jahre</SelectItem>
                          {getAvailableYears.map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Monat" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alle">Alle Monate</SelectItem>
                          {getAvailableMonths.map(month => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode(viewMode === 'timeline' ? 'list' : 'timeline')}
                      >
                        {viewMode === 'timeline' ? 'Liste' : 'Timeline'}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewMode === 'timeline' ? (
                    <div className="space-y-4">
                      {filteredMonthlyData.length > 0 ? (
                        filteredMonthlyData.map((monthData) => (
                          <Collapsible key={monthData.monat}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="flex items-center space-x-4">
                                  <Badge className={
                                    monthData.differenz === 0 
                                      ? 'bg-green-100 text-green-800 border-green-300' 
                                      : monthData.differenz > 0 
                                      ? 'bg-red-100 text-red-800 border-red-300' 
                                      : 'bg-blue-100 text-blue-800 border-blue-300'
                                  }>
                                    {new Date(monthData.monat + '-01').toLocaleDateString('de-DE', { 
                                      month: 'long', 
                                      year: 'numeric' 
                                    })}
                                  </Badge>
                                  <span className="font-medium">
                                    Soll: {formatBetrag(monthData.soll)} | Ist: {formatBetrag(monthData.ist)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-4">
                                                         <FaelligkeitsIndicator forderung={{
                                                            ist_faellig: false,
                                                            faelligkeitsdatum: monthData.monat + '-10',
                                                            sollmonat: monthData.monat
                                                          }} />
                                  <span className={`font-bold ${
                                    monthData.differenz === 0 
                                      ? 'text-green-600' 
                                      : monthData.differenz > 0 
                                      ? 'text-red-600' 
                                      : 'text-blue-600'
                                  }`}>
                                    {monthData.differenz === 0 
                                      ? 'Ausgeglichen' 
                                      : monthData.differenz > 0 
                                      ? `Fehlbetrag: ${formatBetrag(monthData.differenz)}` 
                                      : `Überschuss: ${formatBetrag(Math.abs(monthData.differenz))}`
                                    }
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-4">
                              <div className="space-y-2 mt-2">
                                <h4 className="font-medium text-sm text-gray-600 mb-2">Zahlungen in diesem Monat:</h4>
                                {monthData.zahlungen.length > 0 ? (
                                  monthData.zahlungen.map((zahlung) => (
                                    <div key={zahlung.id} className="flex items-center justify-between p-3 border rounded bg-gray-50 group">
                                      <div className="flex items-center space-x-3">
                                        <span className="font-medium">{formatBetrag(zahlung.betrag)}</span>
                                        <span className="text-sm text-gray-600">
                                          {formatDatum(zahlung.buchungsdatum)}
                                        </span>
                                        <div className="flex items-center space-x-1">
                                          {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'kategorie' ? (
                                            <div className="flex items-center space-x-1">
                                              <Select 
                                                value={editPaymentValue} 
                                                onValueChange={setEditPaymentValue}
                                              >
                                                <SelectTrigger className="w-32 h-6 text-xs">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="Miete">Miete</SelectItem>
                                                  <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                                  <SelectItem value="Nichtmiete">Nichtmiete</SelectItem>
                                                  <SelectItem value="Ignorieren">Ignorieren</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              <Button
                                                size="sm"
                                                onClick={handleSavePaymentField}
                                                className="h-6 px-2"
                                              >
                                                <Check className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelPaymentEdit}
                                                className="h-6 px-2"
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <>
                                              <Badge variant="outline" className="text-xs">
                                                {zahlung.kategorie || 'Nicht kategorisiert'}
                                              </Badge>
                                              <Button
                                                onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 hover:bg-green-200"
                                                title="Kategorie bearbeiten"
                                              >
                                                <Edit2 className="h-2.5 w-2.5" />
                                              </Button>
                                              <Button
                                                onClick={() => {
                                                  const current_Month = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || '';
                                                  handleEditPaymentField(zahlung.id, 'monat', current_Month);
                                                }}
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 hover:bg-blue-200"
                                                title="Monat bearbeiten"
                                              >
                                                <Calendar className="h-2.5 w-2.5" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'monat' && (
                                        <div className="flex items-center space-x-1">
                                          <input 
                                            type="month" 
                                            value={editPaymentValue}
                                            onChange={(e) => setEditPaymentValue(e.target.value)}
                                            className="h-6 text-xs border rounded px-2"
                                          />
                                          <Button
                                            size="sm"
                                            onClick={handleSavePaymentField}
                                            className="h-6 px-2"
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleCancelPaymentEdit}
                                            className="h-6 px-2"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-500 italic">Keine Zahlungen in diesem Monat</p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">Keine Daten für den ausgewählten Zeitraum</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-4 p-3 bg-gray-50 rounded text-sm font-medium text-gray-600">
                        <div>Datum</div>
                        <div>Betrag</div>
                        <div>Kategorie</div>
                        <div>Zugeordnet zu</div>
                        <div>Mietvertrag</div>
                        <div>Aktionen</div>
                      </div>
                      
                      {zahlungen && zahlungen.length > 0 ? (
                        zahlungen
                          .filter(zahlung => {
                            if (!zahlung.buchungsdatum) return false;
                            const zahlungsDatum = new Date(zahlung.buchungsdatum);
                            const year = zahlungsDatum.getFullYear().toString();
                            const month = (zahlungsDatum.getMonth() + 1).toString();
                            
                            if (selectedYear !== "alle" && year !== selectedYear) return false;
                            if (selectedMonth !== "alle" && month !== selectedMonth) return false;
                            
                            return true;
                          })
                          .map((zahlung) => (
                            <div key={zahlung.id} className="grid grid-cols-6 gap-4 p-3 border rounded group hover:bg-gray-50">
                              <div className="text-sm">
                                {formatDatum(zahlung.buchungsdatum)}
                              </div>
                              
                              <div className="font-medium">
                                {formatBetrag(zahlung.betrag)}
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'kategorie' ? (
                                  <div className="flex items-center space-x-1">
                                    <Select 
                                      value={editPaymentValue} 
                                      onValueChange={setEditPaymentValue}
                                    >
                                      <SelectTrigger className="w-32 h-6 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Miete">Miete</SelectItem>
                                        <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                        <SelectItem value="Nichtmiete">Nichtmiete</SelectItem>
                                        <SelectItem value="Ignorieren">Ignorieren</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      onClick={handleSavePaymentField}
                                      className="h-6 px-2"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelPaymentEdit}
                                      className="h-6 px-2"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <Badge variant="outline" className="text-xs">
                                      {zahlung.kategorie || 'Nicht kategorisiert'}
                                    </Badge>
                                    <Button
                                      onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                      variant="ghost"
                                      size="sm"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Kategorie bearbeiten"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'monat' ? (
                                  <div className="flex items-center space-x-1">
                                    <input 
                                      type="month" 
                                      value={editPaymentValue}
                                      onChange={(e) => setEditPaymentValue(e.target.value)}
                                      className="h-6 text-xs border rounded px-2"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={handleSavePaymentField}
                                      className="h-6 px-2"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelPaymentEdit}
                                      className="h-6 px-2"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <span className="text-sm">
                                      {zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || ''}
                                    </span>
                                    <Button
                                      onClick={() => {
                                        const currentMonth = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || '';
                                        handleEditPaymentField(zahlung.id, 'monat', currentMonth);
                                      }}
                                     variant="ghost"
                                      size="sm"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Monat bearbeiten"
                                    >
                                      <Calendar className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'mietvertrag' ? (
                                  <div className="flex items-center space-x-1 flex-1">
                                    <Input
                                      value={mietvertragSearchTerm}
                                      onChange={(e) => setMietvertragSearchTerm(e.target.value)}
                                      placeholder="Suchen..."
                                      className="h-6 text-xs flex-1"
                                    />
                                    <Select 
                                      value={editPaymentValue} 
                                      onValueChange={setEditPaymentValue}
                                    >
                                      <SelectTrigger className="w-48 h-6 text-xs">
                                        <SelectValue placeholder="Mietvertrag auswählen" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getFilteredMietvertraege().map(mv => (
                                          <SelectItem key={mv.id} value={mv.id}>
                                            Mietvertrag {mv.id.substring(0, 8)}...
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      onClick={handleSavePaymentField}
                                      className="h-6 px-2"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelPaymentEdit}
                                      className="h-6 px-2"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs text-gray-600">
                                      {zahlung.mietvertrag_id === vertragId ? 'Aktueller Vertrag' : 'Anderer Vertrag'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-sm text-gray-600">
                                {zahlung.verwendungszweck && zahlung.verwendungszweck.length > 30
                                  ? `${zahlung.verwendungszweck.substring(0, 30)}...`
                                  : zahlung.verwendungszweck || "Kein Verwendungszweck"
                                }
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">Keine Zahlungen gefunden</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="demands" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Euro className="h-4 w-4" />
                    <span>Forderungen</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {forderungen && forderungen.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-5 gap-4 p-3 bg-gray-50 rounded text-sm font-medium text-gray-600">
                        <div>Monat</div>
                        <div>Betrag</div>
                        <div>Fälligkeitsstatus</div>
                        <div>Erstellt am</div>
                        <div>Aktionen</div>
                      </div>
                      
                      {forderungen.map((forderung) => (
                        <div key={forderung.id} className="grid grid-cols-5 gap-4 p-3 border rounded group hover:bg-gray-50">
                          <div className="flex items-center space-x-2">
                            {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'monat' ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="month"
                                  value={editForderungValue}
                                  onChange={(e) => setEditForderungValue(e.target.value)}
                                  className="h-6 text-xs border rounded px-2"
                                />
                                <Button
                                  size="sm"
                                  onClick={handleSaveForderungField}
                                  className="h-6 px-2"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelForderungEdit}
                                  className="h-6 px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm font-medium">
                                  {new Date(forderung.sollmonat + '-01').toLocaleDateString('de-DE', { 
                                    month: 'long', 
                                    year: 'numeric' 
                                  })}
                                </span>
                                <Button
                                  onClick={() => handleEditForderungField(forderung.id, 'monat', forderung.sollmonat)}
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Monat bearbeiten"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'betrag' ? (
                              <div className="flex items-center space-x-1">
                                <Input
                                  type="number"
                                  value={editForderungValue}
                                  onChange={(e) => setEditForderungValue(e.target.value)}
                                  className="h-6 text-xs w-24"
                                  step="0.01"
                                />
                                <Button
                                  size="sm"
                                  onClick={handleSaveForderungField}
                                  className="h-6 px-2"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelForderungEdit}
                                  className="h-6 px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {formatBetrag(forderung.sollbetrag)}
                                </span>
                                <Button
                                  onClick={() => handleEditForderungField(forderung.id, 'betrag', forderung.sollbetrag.toString())}
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Betrag bearbeiten"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                          
                          <div>
                            <FaelligkeitsIndicator forderung={forderung} />
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            {formatDatum(forderung.erzeugt_am)}
                          </div>
                          
                          <div>
                            <Button
                              onClick={() => handleDeleteForderung(forderung.id)}
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Forderung löschen"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Euro className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Keine Forderungen gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Dokumente</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dokumente && dokumente.length > 0 ? (
                    <div className="space-y-3">
                      {dokumente.map((dokument) => (
                        <div key={dokument.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-5 w-5 text-gray-400" />
                              <div>
                                <p className="font-medium">{dokument.titel}</p>
                                <p className="text-sm text-gray-600">
                                  Hochgeladen am {formatDatum(dokument.hochgeladen_am)}
                                </p>
                              </div>
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
      
      {/* Mahnung Vorschau Modal */}
      <MahnungVorschauModal
        isOpen={showMahnungModal}
        onClose={() => setShowMahnungModal(false)}
        onConfirm={handleSendMahnungFromModal}
        vertragData={vertrag}
        mieterData={mieter || []}
        forderungen={forderungen || []}
        currentMahnstufe={vertrag?.mahnstufe || 0}
        immobilieData={immobilie}
        isLoading={isLoadingSendMahnung}
      />
    </Dialog>
  );
};

export default MietvertragDetailsModal;