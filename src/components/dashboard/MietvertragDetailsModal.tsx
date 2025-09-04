import { useState, useMemo, useCallback, useRef } from "react";
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
  Send,
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
    
    console.log('🔧 EDIT PAYMENT - Start Editing:', { 
      zahlungId, 
      field, 
      currentValue,
      zugeordneterMonat: zahlung?.zugeordneter_monat,
      buchungsdatum: zahlung?.buchungsdatum,
      mietvertragId: zahlung?.mietvertrag_id
    });
    
    setEditingPayment({ zahlungId, field });
    if (field === 'mietvertrag') {
      // Für mietvertrag nehmen wir die aktuelle mietvertrag_id
      setEditPaymentValue(zahlung?.mietvertrag_id || '');
    } else if (field === 'monat') {
      // Für Monat nehmen wir den zugeordneter_monat oder fallback zum buchungsdatum
      const monthValue = zahlung?.zugeordneter_monat || zahlung?.buchungsdatum?.slice(0, 7) || '';
      console.log('🔧 EDIT PAYMENT - Setting month value:', monthValue);
      setEditPaymentValue(monthValue);
    } else {
      setEditPaymentValue(currentValue || '');
    }
  };

  const handleSavePaymentField = async (customValue?: string) => {
    if (!editingPayment) return;
    
    const valueToSave = customValue !== undefined ? customValue : editPaymentValue;
    
    const zahlung = zahlungen?.find(z => z.id === editingPayment.zahlungId);
    
    console.log('💾 SAVE PAYMENT - Speichere Zahlung:', {
      zahlungId: editingPayment.zahlungId,
      field: editingPayment.field,
      newValue: valueToSave,
      originalZugeordneterMonat: zahlung?.zugeordneter_monat,
      originalBuchungsdatum: zahlung?.buchungsdatum,
      originalValue: zahlung?.[editingPayment.field === 'monat' ? 'zugeordneter_monat' : editingPayment.field]
    });
    
    try {
      let updateData: any = {};
      
      if (editingPayment.field === 'kategorie') {
        updateData.kategorie = valueToSave as any;
      } else if (editingPayment.field === 'monat') {
        updateData.zugeordneter_monat = valueToSave;
        console.log('💾 SAVE PAYMENT - Updating zugeordneter_monat to:', valueToSave);
      } else if (editingPayment.field === 'mietvertrag') {
        updateData.mietvertrag_id = valueToSave;
      }

      console.log('💾 SAVE PAYMENT - Final update data:', updateData);

      const { error, data } = await supabase
        .from('zahlungen')
        .update(updateData)
        .eq('id', editingPayment.zahlungId)
        .select();

      if (error) {
        console.error('🚨 SAVE PAYMENT - Supabase Fehler:', error);
        throw error;
      }

      console.log('✅ SAVE PAYMENT - Update erfolgreich:', data);

      toast({
        title: "Aktualisiert",
        description: `${editingPayment.field === 'kategorie' ? 'Kategorie' : 
                        editingPayment.field === 'monat' ? 'Zugeordneter Monat' : 
                        'Mietvertrag'} wurde erfolgreich aktualisiert.`,
      });

      setEditingPayment(null);
      setEditPaymentValue('');
      
      // Invalidiere alle relevanten Queries für sofortige UI-Aktualisierung
      console.log('🔄 SAVE PAYMENT - Invalidiere Queries für vertragId:', vertragId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['zahlungen-by-vertrag', vertragId] }),  
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-details', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['rueckstaende'] }),
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);
      
      // Force refetch für sofortige Aktualisierung
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.refetchQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);
      
      console.log('✅ SAVE PAYMENT - Timeline sollte jetzt aktualisiert werden');
      
    } catch (error) {
      console.error('🚨 SAVE PAYMENT - Fehler beim Aktualisieren:', error);
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

  // Filtere und sortiere Mietverträge für die Auswahl
  const getFilteredMietvertraege = () => {
    if (!alleMietvertraege) return [];
    
    return alleMietvertraege.filter(mv => {
      if (!mietvertragSearchTerm) return true;
      
      const searchLower = mietvertragSearchTerm.toLowerCase();
      const objektName = mv.einheit?.immobilie?.name?.toLowerCase() || '';
      const einheitNr = mv.einheit?.zaehler?.toString() || '';
      const einheitIdNr = mv.einheit?.id?.slice(-2) || '';
      const mieterName = mv.mietvertrag_mieter?.[0]?.mieter ? 
        `${mv.mietvertrag_mieter[0].mieter.vorname} ${mv.mietvertrag_mieter[0].mieter.nachname}`.toLowerCase() : '';
      
      return objektName.includes(searchLower) || 
             einheitNr.includes(searchLower) || 
             einheitIdNr.includes(searchLower) ||
             mieterName.includes(searchLower);
    });
  };

  const handleEditForderungField = (forderungId: string, field: 'betrag' | 'monat', currentValue: string) => {
    setEditingForderung({ forderungId, field });
    setEditForderungValue(currentValue || '');
  };

  const handleSaveForderungField = async () => {
    if (!editingForderung) return;
    
    try {
      let updateData: any = {};
      
      if (editingForderung.field === 'betrag') {
        updateData.sollbetrag = parseFloat(editForderungValue);
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
        description: `${editingForderung.field === 'betrag' ? 'Forderungsbetrag' : 'Forderungsmonat'} wurde erfolgreich aktualisiert.`,
      });

      setEditingForderung(null);
      setEditForderungValue('');
      
      // Refresh nur die relevanten Queries
      queryClient.invalidateQueries({ queryKey: ['forderungen-detail', vertragId] });
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: `${editingForderung.field === 'betrag' ? 'Forderungsbetrag' : 'Forderungsmonat'} konnte nicht aktualisiert werden.`,
        variant: "destructive",
      });
    }
  };

  const handleCancelForderungEdit = () => {
    setEditingForderung(null);
    setEditForderungValue('');
  };

  // Kaution editing functions
  const handleEditKaution = (type: 'soll' | 'ist') => {
    setEditingKaution(type);
    const currentValue = type === 'soll' ? (vertrag?.kaution_betrag || 0) : (vertrag?.kaution_ist || 0);
    setKautionValue(currentValue.toString());
  };

  const handleSaveKaution = async () => {
    if (!editingKaution || !vertrag) return;
    
    const numValue = parseFloat(kautionValue) || 0;
    const field = editingKaution === 'soll' ? 'kaution_betrag' : 'kaution_ist';
    
    try {
      const { error } = await supabase
        .from('mietvertrag')
        .update({ [field]: numValue })
        .eq('id', vertrag.id);
      
      if (error) throw error;
      
      toast({
        title: "Gespeichert",
        description: `Kaution ${editingKaution === 'soll' ? 'SOLL' : 'IST'} wurde erfolgreich aktualisiert.`,
      });
      
      setEditingKaution(null);
      setKautionValue("");
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
      
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler",
        description: "Kaution konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCancelKautionEdit = () => {
    setEditingKaution(null);
    setKautionValue("");
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

      // Refresh die Forderungen
      queryClient.invalidateQueries({ queryKey: ['forderungen-detail', vertragId] });
    } catch (error) {
      console.error('Fehler beim Löschen der Forderung:', error);
      toast({
        title: "Fehler",
        description: "Die Forderung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleSendMahnungFromModal = async () => {
    if (!vertrag) return;
    
    setIsLoadingSendMahnung(true);
    
    try {
      const newMahnstufe = Math.min((vertrag.mahnstufe || 0) + 1, 3);
      
      const { error } = await supabase
        .from('mietvertrag')
        .update({ 
          mahnstufe: newMahnstufe,
          letzte_mahnung_am: new Date().toISOString(),
          naechste_mahnung_am: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', vertragId);

      if (error) throw error;

      toast({
        title: "Mahnung verschickt",
        description: `Mahnstufe wurde auf ${newMahnstufe} erhöht.`,
      });

      setShowMahnungModal(false);
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
      
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

  // Hole alle Mietverträge für die Zuordnung
  const { data: alleMietvertraege } = useQuery({
    queryKey: ['alle-mietvertraege'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          einheit:einheit_id (
            id,
            zaehler,
            immobilie:immobilie_id (
              name,
              adresse
            )
          ),
          mietvertrag_mieter!inner (
            mieter:mieter_id (
              id,
              vorname,
              nachname
            )
          )
        `)
        .eq('status', 'aktiv')
        .order('id');
      
      if (error) throw error;
      
      // Sortiere nach Immobilienname und dann nach Einheitennummer
      const sorted = (data || []).sort((a, b) => {
        const aObjekt = a.einheit?.immobilie?.name || '';
        const bObjekt = b.einheit?.immobilie?.name || '';
        const aEinheit = Number(a.einheit?.zaehler) || 0;
        const bEinheit = Number(b.einheit?.zaehler) || 0;
        
        if (aObjekt !== bObjekt) {
          return aObjekt.localeCompare(bObjekt, 'de', { numeric: true });
        }
        return aEinheit - bEinheit;
      });
      
      return sorted;
    },
    enabled: isOpen
  });

  // Hole alle Forderungen
  const { data: forderungen } = useQuery({
    queryKey: ['forderungen-detail', vertragId],
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

  // Calculate processed payments using useMemo for performance - simplified without shift logic
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
      console.log('🎯 DRAG DROP - Moving payment:', { zahlungId, targetMonth });
      
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
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.refetchQueries({ queryKey: ['mietforderungen', vertragId] }),
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
  const { processedZahlungen, relevanteForderungen } = useMemo(() => {
    if (!forderungen || !zahlungen || !vertrag) return { processedZahlungen: [], relevanteForderungen: [] };
    
    const heute = new Date();
    const istLastschrift = vertrag.lastschrift || false;
    
    // Bestimme Startdatum: später von Jan 2025 oder Mietvertragsbeginn
    const mietvertragStart = vertrag.start_datum ? new Date(vertrag.start_datum) : new Date('2025-01-01');
    const startDatum = mietvertragStart > new Date('2025-01-01') ? mietvertragStart : new Date('2025-01-01');
    
    // Filtere Forderungen ab Startdatum
    const relevanteForderungen = forderungen.filter(f => {
      if (!f.sollmonat) return false;
      const forderungsDatum = new Date(f.sollmonat + '-01');
      return forderungsDatum >= startDatum;
    });
    
    // Vereinfachte Vorauszahlungs-Logik basierend auf zugeordneter_monat aus DB
    const processVorauszahlungen = (zahlungen: any[], forderungen: any[]) => {
      // Sammle alle Forderungsmonate
      const forderungsmonate = new Set(forderungen.map(f => f.sollmonat).filter(Boolean));
      
      // Verarbeite Vorauszahlungen - verschiebe zu nächstem Forderungsmonat wenn kein passender existiert
      const verarbeiteteZahlungen = zahlungen.map(zahlung => {
        // Verwende zugeordneter_monat aus DB, fallback zu berechneter Wert
        const zugeordneterMonat = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7);
        
        if (!zugeordneterMonat || forderungsmonate.has(zugeordneterMonat)) {
          return zahlung; // Keine Verschiebung notwendig
        }
        
        // Finde den nächsten Monat mit Forderung
        const naechsterForderungsmonat = Array.from(forderungsmonate)
          .filter(fm => fm > zugeordneterMonat)
          .sort()[0];
        
        if (naechsterForderungsmonat) {
          return {
            ...zahlung,
            zugeordneter_monat: naechsterForderungsmonat,
            _verschoben_von: zugeordneterMonat // Für Debugging
          };
        }
        
        return zahlung;
      });
      
      return verarbeiteteZahlungen;
    };

    // Filtere Zahlungen ab Startdatum und nach Kategorie
    const relevanteZahlungen = zahlungen.filter(z => {
      if (!z.buchungsdatum) return false;
      
      // Zeitraum-Filter
      const zahlungsDatum = new Date(z.buchungsdatum);
      if (zahlungsDatum < startDatum) return false;
      
      // Kategorie-Filter - auch Mietkaution einschließen
      return z.kategorie === 'Miete' || 
             z.kategorie === 'Mietkaution' ||
             z.kategorie === null || 
             (z.betrag > 0 && z.kategorie !== 'Nichtmiete' && String(z.kategorie) !== 'Ignorieren');
    });

    // Wende Vorauszahlungs-Intelligenz an
    const processedZahlungen = processVorauszahlungen(relevanteZahlungen, relevanteForderungen);
    
    return { processedZahlungen, relevanteForderungen };
  }, [forderungen, zahlungen, vertrag]);

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

  // IDENTISCHE BERECHNUNG WIE IN useFehlendeMietzahlungen
  const calculateRueckstand = () => {
    if (!forderungen || !zahlungen || !vertrag) return { gesamtForderungen: 0, gesamtZahlungen: 0 };
    
    const heute = new Date();
    const istLastschrift = vertrag.lastschrift || false;
    
    // Bestimme Startdatum: später von Jan 2025 oder Mietvertragsbeginn
    const mietvertragStart = vertrag.start_datum ? new Date(vertrag.start_datum) : new Date('2025-01-01');
    const startDatum = mietvertragStart > new Date('2025-01-01') ? mietvertragStart : new Date('2025-01-01');
    
    // Alle Forderungen ab Startdatum (für Anzeige)
    const alleForderungenAbStart = forderungen.filter(f => {
      if (!f.sollmonat) return false;
      const forderungsDatum = new Date(f.sollmonat + '-01');
      return forderungsDatum >= startDatum;
    });
    
    // Nur fällige Forderungen für Rückstandsberechnung
    const relevanteForderungen = alleForderungenAbStart.filter(f => f.ist_faellig === true);
    
  // Intelligente Vorauszahlungs-Logik
  const processVorauszahlungen = (zahlungen: any[], forderungen: any[]) => {
    // Erst: Verschiebe Zahlungen die 2-3 Tage vor Monatsbeginn stattfinden zum nächsten Monat
    const zahlungenMitMonatsverschiebung = zahlungen.map(zahlung => {
      if (!zahlung.buchungsdatum) return zahlung;
      
      const zahlungsDatum = new Date(zahlung.buchungsdatum);
      const tag = zahlungsDatum.getDate();
      
      // Wenn Zahlung am 28., 29., 30., oder 31. des Monats -> verschiebe zum nächsten Monat
      if (tag >= 28) {
        const naechsterMonat = new Date(zahlungsDatum);
        naechsterMonat.setMonth(naechsterMonat.getMonth() + 1);
        naechsterMonat.setDate(1); // 1. des nächsten Monats
        
        return {
          ...zahlung,
          buchungsdatum: naechsterMonat.toISOString().slice(0, 10),
          _verschoben_monatsende: true // Für Debugging
        };
      }
      
      return zahlung;
    });

    // Gruppiere Zahlungen nach Monaten (mit bereits verschobenen Zahlungen)
    const zahlungenByMonth = new Map<string, any[]>();
    zahlungenMitMonatsverschiebung.forEach(z => {
      if (!z.buchungsdatum) return;
      const zahlungsmonat = z.buchungsdatum.slice(0, 7); // YYYY-MM
      if (!zahlungenByMonth.has(zahlungsmonat)) {
        zahlungenByMonth.set(zahlungsmonat, []);
      }
      zahlungenByMonth.get(zahlungsmonat)!.push(z);
    });

    // Sammle alle Forderungsmonate
    const forderungsmonate = new Set(forderungen.map(f => f.sollmonat).filter(Boolean));
    
    // Verarbeite Vorauszahlungen (verwende bereits monatsweise verschobene Zahlungen)
    const verarbeiteteZahlungen = [...zahlungenMitMonatsverschiebung];
    
    zahlungenByMonth.forEach((monthZahlungen, zahlungsmonat) => {
      // Wenn es für diesen Monat keine Forderung gibt
      if (!forderungsmonate.has(zahlungsmonat)) {
        // Finde den nächsten Monat mit Forderung
        const naechsterForderungsmonat = Array.from(forderungsmonate)
          .filter(fm => fm > zahlungsmonat)
          .sort()[0];
        
        if (naechsterForderungsmonat) {
          // Verschiebe alle Zahlungen dieses Monats zum nächsten Forderungsmonat
          monthZahlungen.forEach(zahlung => {
            const zahlungsIndex = verarbeiteteZahlungen.findIndex(z => z.id === zahlung.id);
            if (zahlungsIndex !== -1) {
              // Erstelle neue Buchungsdatum im Zielmonat (1. des Monats)
              const neuesDatum = naechsterForderungsmonat + '-01';
              verarbeiteteZahlungen[zahlungsIndex] = {
                ...zahlung,
                buchungsdatum: neuesDatum,
                _verschoben_von: zahlungsmonat // Für Debugging
              };
            }
          });
        }
      }
    });
    
    return verarbeiteteZahlungen;
  };

  const handleSendMahnungFromModal = async () => {
    if (!vertrag) return;
    setIsLoadingSendMahnung(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mahnung', {
        body: { mietvertragId: vertrag.id, mahnstufe: Math.max(vertrag.mahnstufe || 0, 1), vertragData: vertrag, forderungen: forderungen || [] }
      });
      if (error) throw error;
      toast({ title: "Mahnung versendet", description: "Mahnung wurde erfolgreich versendet." });
    } catch (error) {
      toast({ title: "Fehler", description: "Mahnung konnte nicht versendet werden.", variant: "destructive" });
    } finally {
      setIsLoadingSendMahnung(false); setShowMahnungModal(false);
    }
  };

    // Filtere Zahlungen ab Startdatum und nach Kategorie (IDENTISCH zu useFehlendeMietzahlungen)
    const relevanteZahlungen = zahlungen.filter(z => {
      if (!z.buchungsdatum) return false;
      
      // Zeitraum-Filter
      const zahlungsDatum = new Date(z.buchungsdatum);
      if (zahlungsDatum < startDatum) return false;
      
      // EXAKT IDENTISCHE Kategorie-Filter wie im Hook - auch Mietkaution einschließen
      return z.kategorie === 'Miete' || 
             z.kategorie === 'Mietkaution' ||
             z.kategorie === null || 
             (z.betrag > 0 && z.kategorie !== 'Nichtmiete' && String(z.kategorie) !== 'Ignorieren');
    });

    // Wende Vorauszahlungs-Intelligenz an
    const verarbeiteteZahlungen = processVorauszahlungen(relevanteZahlungen, relevanteForderungen);

    console.log(`Modal Debug für ${vertragId}:`, {
      alleZahlungenFuerVertrag: zahlungen.length, // Bereits nach mietvertrag_id gefiltert
      relevanteZahlungen: relevanteZahlungen.length,
      startDatum: startDatum.toISOString(),
      zahlungenDetails: relevanteZahlungen.map(z => ({
        betrag: z.betrag,
        kategorie: z.kategorie,
        buchungsdatum: z.buchungsdatum
      }))
    });
    
    // Berechne Gesamtforderungen
    const gesamtForderungen = relevanteForderungen.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0);
    
    // Berechne Gesamtzahlungen mit 6-Tage-Wartezeit bei Lastschrift
    let gesamtZahlungen = 0;
    for (const zahlung of verarbeiteteZahlungen) {
      let zahlungGueltig = true;
      
      if (istLastschrift) {
        const zahlungMitWartezeit = new Date(zahlung.buchungsdatum);
        zahlungMitWartezeit.setDate(zahlungMitWartezeit.getDate() + 6);
        
        if (heute < zahlungMitWartezeit) {
          zahlungGueltig = false; // Zahlung noch in 6-Tage-Wartezeit
        }
      }
      
      if (zahlungGueltig) {
        gesamtZahlungen += (Number(zahlung.betrag) || 0);
      }
    }
    
    return { 
      gesamtForderungen: alleForderungenAbStart.reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0), // Alle Forderungen für Anzeige
      gesamtZahlungen,
      // Fälligkeitsinformationen basierend auf allen Forderungen ab Startdatum
      faelligeForderungen: alleForderungenAbStart.filter(f => f.ist_faellig === true),
      nichtFaelligeForderungen: alleForderungenAbStart.filter(f => f.ist_faellig !== true),
      faelligeForderungenBetrag: alleForderungenAbStart.filter(f => f.ist_faellig === true).reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0),
      nichtFaelligeForderungenBetrag: alleForderungenAbStart.filter(f => f.ist_faellig !== true).reduce((sum, f) => sum + (Number(f.sollbetrag) || 0), 0),
      rueckstand: gesamtForderungen - gesamtZahlungen // Nur fällige Forderungen minus Zahlungen
    };
  };

  const { 
    gesamtForderungen, 
    gesamtZahlungen, 
    faelligeForderungen, 
    nichtFaelligeForderungen, 
    faelligeForderungenBetrag, 
    nichtFaelligeForderungenBetrag,
    rueckstand 
  } = calculateRueckstand();
  const sollMiete = vertrag ? (Number(vertrag.kaltmiete) || 0) + (Number(vertrag.betriebskosten) || 0) : 0;

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
      
      // Finde Zahlungen für diesen Monat
      const monthZahlungen = zahlungen.filter(z => {
        if (!z.buchungsdatum) return false;
        
        const zahlungMonat = z.buchungsdatum.slice(0, 7); // YYYY-MM
        return zahlungMonat === monthKey;
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
                    Einheit {vertrag?.einheit_id ? vertrag.einheit_id.slice(-2) : 'N/A'}
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

              {/* Erweiterte Details - Collapsible */}
              <Collapsible open={showDetailsExpanded} onOpenChange={setShowDetailsExpanded}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="text-sm font-medium text-gray-700">Weitere Details</span>
                  <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${showDetailsExpanded ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                    {einheit?.qm && (
                      <div className="flex items-center space-x-2">
                        <Square className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-600">Quadratmeter</p>
                          <p className="font-semibold">{einheit.qm} m²</p>
                        </div>
                      </div>
                    )}
                    
                    {einheit?.zaehler && (
                      <div className="flex items-center space-x-2">
                        <Hash className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-600">Zählernummer</p>
                          <p className="font-semibold font-mono">{einheit.zaehler}</p>
                        </div>
                      </div>
                    )}
                    
                    {einheit?.etage && (
                      <div>
                        <p className="text-sm text-gray-600">Etage</p>
                        <p className="font-semibold">{einheit.etage}</p>
                      </div>
                    )}
                    
                    {einheit?.einheitentyp && (
                      <div>
                        <p className="text-sm text-gray-600">Einheitentyp</p>
                        <p className="font-semibold capitalize">{einheit.einheitentyp}</p>
                      </div>
                    )}
                    
                    {vertrag?.einheit_id && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-600">Einheit ID (vollständig)</p>
                        <p className="font-mono text-xs text-gray-700 break-all bg-white p-2 rounded border">
                          {vertrag.einheit_id}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
                          onClick={() => setShowMahnungModal(true)}
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
                  
                   {/* Rückstand für gesamten Zeitraum */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Gesamtrückstand</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-blue-600">Forderungen (ab Jan 2025)</p>
                        <p className="font-bold text-lg text-blue-800">{formatBetrag(gesamtForderungen)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-600">Eingegangene Zahlungen</p>
                        <p className="font-bold text-lg text-green-700">{formatBetrag(gesamtZahlungen)}</p>
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
                          {nichtFaelligeForderungen && nichtFaelligeForderungen.length > 0 && (
                            <span className="text-orange-600 text-sm ml-1 font-normal">
                              ({formatBetrag(nichtFaelligeForderungenBetrag)} offen)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Kaution section - simplified editing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <p className="text-sm text-gray-600">Kaution SOLL (Vertrag)</p>
                      {editingKaution === 'soll' ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={kautionValue}
                            onChange={(e) => setKautionValue(e.target.value)}
                            onKeyDown={handleKautionKeyPress}
                            className="font-semibold text-lg text-blue-600"
                            autoFocus
                          />
                          <Button size="sm" onClick={handleSaveKaution}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelKautionEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="font-semibold text-lg text-blue-600 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-transparent hover:border-blue-200"
                          onClick={() => handleEditKaution('soll')}
                        >
                          {formatBetrag(vertrag?.kaution_betrag || 0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kaution IST (Zahlungen)</p>
                      {editingKaution === 'ist' ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={kautionValue}
                            onChange={(e) => setKautionValue(e.target.value)}
                            onKeyDown={handleKautionKeyPress}
                            className="font-semibold text-lg text-green-600"
                            autoFocus
                          />
                          <Button size="sm" onClick={handleSaveKaution}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelKautionEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="font-semibold text-lg text-green-600 cursor-pointer hover:bg-green-50 px-2 py-1 rounded border-2 border-transparent hover:border-green-200"
                          onClick={() => handleEditKaution('ist')}
                        >
                          {formatBetrag(vertrag?.kaution_ist || 0)}
                        </div>
                      )}
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
                     <div className="space-y-8">
                       {/* Timeline Section */}
                       <div className="relative py-6">
                        {(() => {
                           // Use processed payments that include month-end shifts and prepayment logic
                           const timelineZahlungen = processedZahlungen;
                          
                          // Group data by months for better display
                          const monthlyData = new Map();
                          
                          // Add Forderungen to monthly data (only months with Forderungen)
                          if (forderungen) {
                            forderungen.forEach(forderung => {
                              const month = forderung.sollmonat;
                              if (!monthlyData.has(month)) {
                                monthlyData.set(month, { forderung: null, zahlungen: [] });
                              }
                              monthlyData.get(month).forderung = forderung;
                            });
                          }
                          
                          // Add processed payments ONLY to months that already have a Forderung
                          timelineZahlungen.forEach(zahlung => {
                            // Use zugeordneter_monat from DB, fallback to calculated month from buchungsdatum
                            const assignedMonth = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7);
                            
                            // Only add payment if this month already has a Forderung
                            if (assignedMonth && monthlyData.has(assignedMonth)) {
                              monthlyData.get(assignedMonth).zahlungen.push(zahlung);
                            }
                          });
                          
                          // Filter months to only include those within contract period
                          const contractStart = vertrag?.start_datum ? new Date(vertrag.start_datum) : null;
                          const contractEnd = vertrag?.ende_datum ? new Date(vertrag.ende_datum) : null;
                          
                          // Remove months outside contract period
                          for (const [month] of monthlyData) {
                            const monthDate = new Date(month + '-01');
                            
                            // Check if month is before contract start
                            if (contractStart && monthDate < contractStart) {
                              monthlyData.delete(month);
                              continue;
                            }
                            
                            // Check if month is after contract end
                            if (contractEnd && monthDate > contractEnd) {
                              monthlyData.delete(month);
                              continue;
                            }
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
                             <div className="relative px-8 py-8">
                               {/* Central Timeline - Elegant thin line */}
                               <div className="absolute left-1/2 top-0 w-0.5 bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400 h-full transform -translate-x-0.5 z-0 opacity-60"></div>
                               
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
                                   <div 
                                     key={month} 
                                     className="relative mb-20 min-h-[180px] animate-fade-in"
                                     onDragOver={handleDragOver}
                                     onDrop={(e) => handleDrop(e, month)}
                                   >
                                    {/* Enhanced Month marker on timeline */}
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
                                       {/* Left side - Forderungen (Full width) */}
                                       <div className="pr-10">
                                         {forderung ? (
                                           <div className="w-full animate-scale-in">
                                             <div className="w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 hover-scale group relative">
                                               <Button
                                                 onClick={() => handleDeleteForderung(forderung.id)}
                                                 variant="ghost"
                                                 size="sm"
                                                 className="absolute top-2 left-2 h-6 w-6 p-0 hover:bg-red-300 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                 title="Forderung löschen"
                                               >
                                                 <Trash2 className="h-3 w-3 text-red-600" />
                                               </Button>
                                               <div className="flex justify-between items-start">
                                                 <div className="flex-1 text-right">
                                                   <div className="flex items-center justify-end mb-2">
                                                     <div className="bg-red-100 rounded-full p-1.5 mr-2">
                                                       <span className="text-red-600 text-xs">📋</span>
                                                     </div>
                                                     <p className="font-semibold text-red-600 text-sm">
                                                       Forderung
                                                     </p>
                                                   </div>
                                                   
                                                   {/* Betrag mit Edit-Funktionalität */}
                                                   {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'betrag' ? (
                                                     <div className="flex justify-end items-center space-x-2 mb-1">
                                                       <Input 
                                                         type="number"
                                                         step="0.01"
                                                         value={editForderungValue}
                                                         onChange={(e) => setEditForderungValue(e.target.value)}
                                                         className="h-8 text-right w-32"
                                                       />
                                                       <Button onClick={handleSaveForderungField} size="sm" className="h-8 px-2">
                                                         <Check className="h-3 w-3" />
                                                       </Button>
                                                       <Button onClick={handleCancelForderungEdit} size="sm" variant="outline" className="h-8 px-2">
                                                         <X className="h-3 w-3" />
                                                       </Button>
                                                     </div>
                                                   ) : (
                                                      <div className="flex justify-end items-center space-x-2 mb-1">
                                                        <p className="text-xl font-bold text-red-700">
                                                          {formatBetrag(Number(forderung.sollbetrag))}
                                                        </p>
                                                        <Button
                                                          onClick={() => handleEditForderungField(forderung.id, 'betrag', forderung.sollbetrag.toString())}
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 w-6 p-0 hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                                          title="Betrag bearbeiten"
                                                        >
                                                          <Edit2 className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    )}
                                                    
                                                    {/* Fälligkeitsstatus - nur bei nicht fälligen Forderungen */}
                                                    {forderung.ist_faellig === false && (
                                                      <div className="flex justify-end mb-2">
                                                        <FaelligkeitsIndicator forderung={{
                                                          ist_faellig: forderung.ist_faellig || false,
                                                          faelligkeitsdatum: forderung.faelligkeitsdatum || '',
                                                          faellig_seit: forderung.faellig_seit || '',
                                                          sollmonat: forderung.sollmonat
                                                        }} />
                                                      </div>
                                                    )}
                                                    
                                                    {/* Monat mit Edit-Funktionalität */}
                                                   {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'monat' ? (
                                                     <div className="flex justify-end items-center space-x-2">
                                                       <input 
                                                         type="month"
                                                         value={editForderungValue}
                                                         onChange={(e) => setEditForderungValue(e.target.value)}
                                                         className="h-8 text-xs w-32 px-2 border rounded text-right"
                                                       />
                                                       <Button onClick={handleSaveForderungField} size="sm" className="h-8 px-2">
                                                         <Check className="h-3 w-3" />
                                                       </Button>
                                                       <Button onClick={handleCancelForderungEdit} size="sm" variant="outline" className="h-8 px-2">
                                                         <X className="h-3 w-3" />
                                                       </Button>
                                                     </div>
                                                   ) : (
                                                      <div className="flex justify-end items-center space-x-2">
                                                        <p className="text-xs text-red-500 font-medium">
                                                          Monat: {forderung.sollmonat}
                                                        </p>
                                                        <Button
                                                          onClick={() => handleEditForderungField(forderung.id, 'monat', forderung.sollmonat)}
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 w-6 p-0 hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                                          title="Monat bearbeiten"
                                                        >
                                                          <Calendar className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                   )}
                                                 </div>
                                               </div>
                                             </div>
                                           </div>
                                         ) : (
                                           <div className="text-gray-400 text-sm italic font-medium text-right">
                                             Keine Forderung
                                           </div>
                                         )}
                                       </div>
                                     
                                      {/* Right side - Zahlungen (Full width) */}
                                      <div className="pl-10">
                                        {zahlungen.length > 0 ? (
                                          <div className="space-y-3">
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
                                                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-300 hover-scale animate-fade-in cursor-move"
                                                    style={{ animationDelay: `${zahlungIndex * 100}ms` }}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, zahlung.id)}
                                                    onDragEnd={handleDragEnd}
                                                  >
                                                   <div className="flex justify-between items-start mb-2">
                                                     <div className="flex-1">
                                                        <div className="flex items-center mb-1">
                                                           <div className={`${
                                                             zahlung.kategorie === 'Mietkaution' ? 'bg-purple-100' : 'bg-green-100'
                                                           } rounded-full p-1.5 mr-2`}>
                                                             <span className={`${
                                                               zahlung.kategorie === 'Mietkaution' ? 'text-purple-600' : 'text-green-600'
                                                             } text-xs`}>
                                                               {zahlung.kategorie === 'Mietkaution' ? '🏠' : '💰'}
                                                             </span>
                                                           </div>
                                                           <p className={`font-semibold ${
                                                             zahlung.kategorie === 'Mietkaution' ? 'text-purple-600' : 'text-green-600'
                                                           } text-sm`}>
                                                             {zahlung.kategorie === 'Mietkaution' ? 'Kaution' : 'Zahlung'}
                                                           </p>
                                                        </div>
                         <p className={`text-xl font-bold ${
                           zahlung.kategorie === 'Mietkaution' ? 'text-purple-700' : 'text-green-700'
                         } mb-1`}>
                           {formatBetrag(Number(zahlung.betrag))}
                         </p>
                         <p className={`text-xs ${
                           zahlung.kategorie === 'Mietkaution' ? 'text-purple-500' : 'text-green-500'
                         } mb-1 font-medium`}>
                           {formatDatum(zahlung.buchungsdatum)}
                         </p>
                                                       
                                                       {zahlung.verwendungszweck && (
                                                         <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border break-words">
                                                           {zahlung.verwendungszweck}
                                                         </p>
                                                       )}
                                                    </div>
                                                    
                                                    {/* Edit controls */}
                                                    <div className="flex flex-col space-y-1 ml-3">
                                                      {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'kategorie' ? (
                                                        <div className="flex flex-col space-y-1">
                                                          <Select value={editPaymentValue} onValueChange={setEditPaymentValue}>
                                                            <SelectTrigger className="h-6 text-xs w-20">
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
                                                             <Button onClick={() => handleSavePaymentField()} size="sm" className="h-5 px-1.5">
                                                              <Check className="h-2.5 w-2.5" />
                                                            </Button>
                                                            <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-5 px-1.5">
                                                              <X className="h-2.5 w-2.5" />
                                                            </Button>
                                                          </div>
                                                        </div>
                                                         ) : editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'monat' ? (
                                                           <div className="flex flex-col space-y-1">
                                                             <Select 
                                                               value={editPaymentValue} 
                                                                 onValueChange={async (value) => {
                                                                   setEditPaymentValue(value);
                                                                   // Direkt speichern mit dem neuen Wert
                                                                   if (editingPayment) {
                                                                     await handleSavePaymentField(value);
                                                                   }
                                                                 }}
                                                             >
                                                               <SelectTrigger className="h-6 text-xs w-28 px-1">
                                                                 <SelectValue placeholder="Monat wählen" />
                                                               </SelectTrigger>
                                                                <SelectContent>
                                                                  {/* Nur Monate während der Vertragslaufzeit */}
                                                                  {(() => {
                                                                    const months = [];
                                                                    if (!vertrag?.start_datum) return months;
                                                                    
                                                                    const contractStart = new Date(vertrag.start_datum);
                                                                    const contractEnd = vertrag.ende_datum ? new Date(vertrag.ende_datum) : new Date();
                                                                    const current = new Date(contractStart.getFullYear(), contractStart.getMonth(), 1);
                                                                    
                                                                    while (current <= contractEnd) {
                                                                      const monthValue = current.toISOString().slice(0, 7);
                                                                      const monthLabel = current.toLocaleDateString('de-DE', { 
                                                                        month: 'long', 
                                                                        year: 'numeric' 
                                                                      });
                                                                      months.push(
                                                                        <SelectItem key={monthValue} value={monthValue}>
                                                                          {monthLabel}
                                                                        </SelectItem>
                                                                      );
                                                                      current.setMonth(current.getMonth() + 1);
                                                                    }
                                                                    return months;
                                                                  })()}
                                                                </SelectContent>
                                                             </Select>
                                                             <div className="flex space-x-1">
                                                               <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-5 px-1.5">
                                                                 <X className="h-2.5 w-2.5" />
                                                               </Button>
                                                             </div>
                                                           </div>
                                                        ) : editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'mietvertrag' ? (
                                                          <div className="flex flex-col space-y-1">
                                                            <Select value={editPaymentValue} onValueChange={setEditPaymentValue}>
                                                              <SelectTrigger className="h-6 text-xs w-40">
                                                                <SelectValue placeholder="Mietvertrag" />
                                                              </SelectTrigger>
                                                              <SelectContent className="bg-background border shadow-md z-50 max-h-60 overflow-y-auto">
                                                                <div className="px-2 py-1 border-b">
                                                                  <input
                                                                    type="text"
                                                                    placeholder="Suchen..."
                                                                    value={mietvertragSearchTerm}
                                                                    onChange={(e) => setMietvertragSearchTerm(e.target.value)}
                                                                    className="w-full h-6 px-2 text-xs border rounded focus:outline-none"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                  />
                                                                </div>
                                                                {getFilteredMietvertraege()?.map((mv) => {
                                                                  const mieter = mv.mietvertrag_mieter?.[0]?.mieter;
                                                                  const mieterName = mieter ? `${mieter.vorname} ${mieter.nachname}` : 'Kein Mieter';
                                                                  return (
                                                                     <SelectItem key={mv.id} value={mv.id}>
                                                                        <div className="text-xs py-1">
                                                                          <div className="font-medium">{mv.einheit?.immobilie?.name} - Einheit {mv.einheit?.zaehler} (Nr. {mv.einheit?.id?.slice(-2)})</div>
                                                                          <div className="text-gray-500">{mieterName}</div>
                                                                        </div>
                                                                     </SelectItem>
                                                                  );
                                                                })}
                                                              </SelectContent>
                                                            </Select>
                                                           <div className="flex space-x-1">
                                                             <Button onClick={() => handleSavePaymentField()} size="sm" className="h-5 px-1.5">
                                                               <Check className="h-2.5 w-2.5" />
                                                             </Button>
                                                             <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-5 px-1.5">
                                                               <X className="h-2.5 w-2.5" />
                                                             </Button>
                                                           </div>
                                                         </div>
                                                       ) : (
                                                        <div className="flex flex-col items-end space-y-1">
                                                          <Badge variant="outline" className="text-xs font-medium">
                                                            {zahlung.kategorie || 'Sonstige'}
                                                          </Badge>
                                                          <div className="flex space-x-1">
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
                                                                   console.log('🎯 Timeline Monat-Edit geklickt für Zahlung:', {
                                                                     zahlungId: zahlung.id,
                                                                     currentMonth: zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || ''
                                                                   });
                                                                   const current_Month = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || '';
                                                                   handleEditPaymentField(zahlung.id, 'monat', current_Month);
                                                                 }}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 w-5 p-0 hover:bg-blue-200"
                                                                title="Monat zuordnen"
                                                              >
                                                                <Calendar className="h-2.5 w-2.5" />
                                                              </Button>
                                                              <Button
                                                                onClick={() => handleEditPaymentField(zahlung.id, 'mietvertrag', '')}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 w-5 p-0 hover:bg-orange-200"
                                                                title="Mietvertrag zuordnen"
                                                              >
                                                                <ArrowRightLeft className="h-2.5 w-2.5" />
                                                              </Button>
                                                          </div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div className="text-gray-400 text-sm italic font-medium">
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
                                <p className="text-sm text-gray-500 break-words">
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
                                      <Button onClick={() => handleSavePaymentField()} size="sm" className="h-8 px-3">
                                       <Check className="h-4 w-4" />
                                     </Button>
                                     <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-8 px-3">
                                       <X className="h-4 w-4" />
                                     </Button>
                                   </div>
                                   ) : editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'monat' ? (
                                     <div className="flex items-center space-x-2">
                                        <Select 
                                          value={editPaymentValue} 
                                           onValueChange={async (value) => {
                                             setEditPaymentValue(value);
                                             // Direkt speichern mit dem neuen Wert
                                             if (editingPayment) {
                                               await handleSavePaymentField(value);
                                             }
                                           }}
                                       >
                                         <SelectTrigger className="h-8 text-sm w-40 px-2">
                                           <SelectValue placeholder="Monat wählen" />
                                         </SelectTrigger>
                                          <SelectContent>
                                            {/* Nur Monate während der Vertragslaufzeit */}
                                            {(() => {
                                              const months = [];
                                              if (!vertrag?.start_datum) return months;
                                              
                                              const contractStart = new Date(vertrag.start_datum);
                                              const contractEnd = vertrag.ende_datum ? new Date(vertrag.ende_datum) : new Date();
                                              const current = new Date(contractStart.getFullYear(), contractStart.getMonth(), 1);
                                              
                                              while (current <= contractEnd) {
                                                const monthValue = current.toISOString().slice(0, 7);
                                                const monthLabel = current.toLocaleDateString('de-DE', { 
                                                  month: 'long', 
                                                  year: 'numeric' 
                                                });
                                                months.push(
                                                  <SelectItem key={monthValue} value={monthValue}>
                                                    {monthLabel}
                                                  </SelectItem>
                                                );
                                                current.setMonth(current.getMonth() + 1);
                                              }
                                              return months;
                                            })()}
                                          </SelectContent>
                                       </Select>
                                       <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-8 px-3">
                                         <X className="h-4 w-4" />
                                       </Button>
                                     </div>
                                  ) : editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'mietvertrag' ? (
                                    <div className="flex items-center space-x-2">
                                      <Select value={editPaymentValue} onValueChange={setEditPaymentValue}>
                                        <SelectTrigger className="h-8 text-sm w-64">
                                          <SelectValue placeholder="Mietvertrag auswählen" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border shadow-md z-50 max-h-60 overflow-y-auto">
                                          <div className="px-3 py-2 border-b">
                                            <input
                                              type="text"
                                              placeholder="Objekt, Einheit oder Mieter suchen..."
                                              value={mietvertragSearchTerm}
                                              onChange={(e) => setMietvertragSearchTerm(e.target.value)}
                                              className="w-full h-8 px-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                          {getFilteredMietvertraege()?.map((mv) => {
                                            const mieter = mv.mietvertrag_mieter?.[0]?.mieter;
                                            const mieterName = mieter ? `${mieter.vorname} ${mieter.nachname}` : 'Kein Mieter';
                                            return (
                                               <SelectItem key={mv.id} value={mv.id}>
                                                  <div className="text-sm py-1">
                                                    <div className="font-medium">{mv.einheit?.immobilie?.name} - Einheit {mv.einheit?.zaehler} (Nr. {mv.einheit?.id?.slice(-2)})</div>
                                                    <div className="text-gray-500">{mieterName}</div>
                                                  </div>
                                               </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                     <Button onClick={() => handleSavePaymentField()} size="sm" className="h-8 px-3">
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
                                       title="Kategorie bearbeiten"
                                     >
                                       <Edit2 className="h-4 w-4" />
                                     </Button>
                                      <Button
                                        onClick={() => {
                                          const wasShifted = (zahlung as any)._verschoben_von || (zahlung as any)._verschoben_monatsende;
                                          const hasCustomMonth = zahlung.zugeordneter_monat && zahlung.zugeordneter_monat !== zahlung.buchungsdatum?.slice(0, 7);
                                          console.log('🎯 Liste Monat-Edit geklickt für Zahlung:', {
                                            zahlungId: zahlung.id,
                                            wasShifted,
                                            hasCustomMonth,
                                            isBlueMarked: wasShifted || hasCustomMonth,
                                            currentMonth: zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || ''
                                          });
                                          const currentMonth = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || '';
                                          handleEditPaymentField(zahlung.id, 'monat', currentMonth);
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Monat zuordnen"
                                      >
                                        <Calendar className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        onClick={() => handleEditPaymentField(zahlung.id, 'mietvertrag', '')}
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Mietvertrag zuordnen"
                                      >
                                        <ArrowRightLeft className="h-4 w-4" />
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
                           <p className="text-gray-600 text-lg">Keine Zahlungen oder Forderungen gefunden</p>
                         </div>
                         )}
                       </div>
                     </div>
                   ) : (
                     /* List View */
                     <div className="space-y-4">
                       {zahlungen && zahlungen.length > 0 ? (
                         zahlungen.map((zahlung, index) => (
                           <div key={zahlung.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group">
                             <div className="flex justify-between items-start">
                               <div className="flex-1">
                                 <div className="flex items-center mb-2">
                                   <Badge variant="outline" className="text-xs font-medium">
                                     {zahlung.kategorie || 'Sonstige'}
                                   </Badge>
                                 </div>
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
                                    {editingPayment?.zahlungId === zahlung.id && editingPayment?.field === 'kategorie' ? (
                                      <div className="flex items-center space-x-2">
                                        <Select value={editPaymentValue} onValueChange={setEditPaymentValue}>
                                          <SelectTrigger className="h-8 text-sm w-32">
                                            <SelectValue placeholder="Kategorie" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Miete">Miete</SelectItem>
                                            <SelectItem value="Nebenkosten">Nebenkosten</SelectItem>
                                            <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                            <SelectItem value="Nachzahlung">Nachzahlung</SelectItem>
                                            <SelectItem value="Rückzahlung">Rückzahlung</SelectItem>
                                            <SelectItem value="Sonstige">Sonstige</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Button onClick={() => handleSavePaymentField()} size="sm" className="h-8 px-3">
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-8 px-3">
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
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
                                      </>
                                    )}
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