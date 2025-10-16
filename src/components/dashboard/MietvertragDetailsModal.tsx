import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, AlertCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CreateForderungModal } from "./CreateForderungModal";
import { MietvertragOverviewTab } from "./mietvertrag-details/MietvertragOverviewTab";
import { MietvertragDocumentsTab } from "./mietvertrag-details/MietvertragDocumentsTab";
import { TerminationDialog } from "./termination/TerminationDialog";
import { MahnungErstellungModal } from "./MahnungErstellungModal";

interface MietvertragDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: any;
  immobilie?: any;
  highlightContract?: boolean;
}

export default function MietvertragDetailsModal({ 
  isOpen, 
  onClose, 
  vertragId, 
  einheit, 
  immobilie,
  highlightContract = false
}: MietvertragDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Global edit mode state
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  
  // Simplified state management (legacy - kept for backwards compatibility)
  const [editingKaution, setEditingKaution] = useState<'soll' | 'ist' | null>(null);
  const [editingMietvertrag, setEditingMietvertrag] = useState<'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum' | null>(null);
  const [editingMeter, setEditingMeter] = useState<string | null>(null);
  const [editingMeterNumber, setEditingMeterNumber] = useState<string | null>(null);
  const [showCreateForderungModal, setShowCreateForderungModal] = useState(false);
  const [showTerminationDialog, setShowTerminationDialog] = useState(false);
  const [showMahnungModal, setShowMahnungModal] = useState(false);
  
  // Set up real-time subscriptions for instant updates when this modal is open
  useEffect(() => {
    if (!isOpen || !vertragId) return;

    const channel = supabase
      .channel(`mietvertrag-details-${vertragId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mietforderungen',
          filter: `mietvertrag_id=eq.${vertragId}`
        },
        (payload) => {
          console.log('Contract forderungen changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] });
          queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zahlungen',
          filter: `mietvertrag_id=eq.${vertragId}`
        },
        (payload) => {
          console.log('Contract zahlungen changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] });
          queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mietvertrag',
          filter: `id=eq.${vertragId}`
        },
        (payload) => {
          console.log('Contract details changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, vertragId, queryClient]);

  // Utility functions
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

  // Data fetching
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

  const handleEditMietvertrag = async (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | 'start_datum', value: string) => {
    try {
      // Handle date field (start_datum)
      if (field === 'start_datum') {
        // Import and use overlap validation
        const { checkContractOverlap } = await import('@/utils/contractOverlapValidation');
        
        const overlapCheck = await checkContractOverlap(
          vertrag.einheit_id,
          value,
          vertrag.ende_datum,
          vertragId
        );

        if (overlapCheck.hasOverlap) {
          // Show warning to user
          const confirmed = window.confirm(
            `${overlapCheck.warningMessage}\n\nMöchten Sie das Startdatum trotzdem ändern?`
          );
          
          if (!confirmed) {
            setEditingMietvertrag(null);
            return;
          }
        }

        const { error } = await supabase
          .from('mietvertrag')
          .update({ start_datum: value })
          .eq('id', vertragId);

        if (error) throw error;

        toast({
          title: "Startdatum aktualisiert",
          description: overlapCheck.hasOverlap 
            ? "Startdatum wurde geändert. Bitte beachten Sie die Überschneidung mit anderen Verträgen."
            : "Startdatum wurde erfolgreich aktualisiert.",
        });

        setEditingMietvertrag(null);
        await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
        return;
      }

      // Handle text fields separately
      if (field === 'neue_anschrift') {
        const { error } = await supabase
          .from('mietvertrag')
          .update({ [field]: value.trim() })
          .eq('id', vertragId);

        if (error) throw error;

        toast({
          title: "Aktualisiert",
          description: "Neue Anschrift wurde erfolgreich aktualisiert.",
        });

        setEditingMietvertrag(null);
        await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
        return;
      }

      // Handle numeric fields (kaltmiete, betriebskosten, ruecklastschrift_gebuehr)
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie einen gültigen Betrag ein.",
          variant: "destructive",
        });
        return;
      }

      const oldKaltmiete = Number(vertrag?.kaltmiete || 0);
      const oldBetriebskosten = Number(vertrag?.betriebskosten || 0);
      
      const updateData: any = { [field]: numericValue };
      
      // Check if this is a rent increase (not for ruecklastschrift_gebuehr)
      const isIncrease = field !== 'ruecklastschrift_gebuehr' && 
                        ((field === 'kaltmiete' && numericValue > oldKaltmiete) || 
                         (field === 'betriebskosten' && numericValue > oldBetriebskosten));
      
      if (isIncrease) {
        updateData.letzte_mieterhoehung_am = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('mietvertrag')
        .update(updateData)
        .eq('id', vertragId);

      if (error) throw error;

      if (isIncrease) {
        toast({
          title: "Mieterhöhung dokumentiert",
          description: `${field === 'kaltmiete' ? 'Kaltmiete' : 'Betriebskosten'} wurde erhöht und Datum der letzten Mieterhöhung wurde automatisch gesetzt.`,
        });
      } else {
        const fieldName = field === 'kaltmiete' ? 'Kaltmiete' : 
                         field === 'betriebskosten' ? 'Betriebskosten' : 
                         'Rücklastschrift-Gebühr';
        toast({
          title: "Aktualisiert",
          description: `${fieldName} wurde erfolgreich aktualisiert.`,
        });
      }

      setEditingMietvertrag(null);
      await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });

    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      const fieldName = field === 'kaltmiete' ? 'Kaltmiete' : 
                       field === 'betriebskosten' ? 'Betriebskosten' : 
                       field === 'neue_anschrift' ? 'Neue Anschrift' :
                       'Rücklastschrift-Gebühr';
      toast({
        title: "Fehler",
        description: `${fieldName} konnte nicht aktualisiert werden.`,
        variant: "destructive",
      });
    }
  };

  const handleEditKaution = async (field: 'soll' | 'ist', value: string) => {
    try {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie einen gültigen Betrag ein.",
          variant: "destructive",
        });
        return;
      }

      const updateData = field === 'soll' 
        ? { kaution_betrag: numericValue }
        : { kaution_ist: numericValue };

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

  const handleEditMeter = async (field: string, value: string) => {
    try {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie einen gültigen Zählerstand ein.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('mietvertrag')
        .update({ [field]: numericValue })
        .eq('id', vertragId);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: "Zählerstand wurde erfolgreich aktualisiert.",
      });

      setEditingMeter(null);
      await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });

    } catch (error) {
      console.error('Fehler beim Aktualisieren des Zählerstands:', error);
      toast({
        title: "Fehler",
        description: "Zählerstand konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleEditMeterNumber = async (field: string, value: string) => {
    try {
      if (!einheit?.id) {
        toast({
          title: "Fehler",
          description: "Einheit nicht gefunden.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('einheiten')
        .update({ [field]: value })
        .eq('id', einheit.id);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: "Zählernummer wurde erfolgreich aktualisiert.",
      });

      setEditingMeterNumber(null);
      await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });

    } catch (error) {
      console.error('Fehler beim Aktualisieren der Zählernummer:', error);
      toast({
        title: "Fehler",
        description: "Zählernummer konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleTerminationSuccess = () => {
    setShowTerminationDialog(false);
    queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
    queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
    toast({
      title: "Kündigung erfolgreich",
      description: "Der Mietvertrag wurde erfolgreich gekündigt.",
    });
  };

  // Global edit mode handlers
  const handleStartGlobalEdit = () => {
    // Initialize edited values with current data
    const initialValues: Record<string, any> = {
      kaltmiete: vertrag?.kaltmiete || 0,
      betriebskosten: vertrag?.betriebskosten || 0,
      ruecklastschrift_gebuehr: vertrag?.ruecklastschrift_gebuehr || 7.50,
      neue_anschrift: vertrag?.neue_anschrift || '',
      kaution_betrag: vertrag?.kaution_betrag || 0,
      kaution_ist: vertrag?.kaution_ist || 0,
      kaltwasser_einzug: vertrag?.kaltwasser_einzug || 0,
      warmwasser_einzug: vertrag?.warmwasser_einzug || 0,
      strom_einzug: vertrag?.strom_einzug || 0,
      gas_einzug: vertrag?.gas_einzug || 0,
      kaltwasser_auszug: vertrag?.kaltwasser_auszug || 0,
      warmwasser_auszug: vertrag?.warmwasser_auszug || 0,
      strom_auszug: vertrag?.strom_auszug || 0,
      gas_auszug: vertrag?.gas_auszug || 0,
    };
    
    // Add einheit meter numbers if available
    if (einheit) {
      initialValues.kaltwasser_zaehler = einheit.kaltwasser_zaehler || '';
      initialValues.warmwasser_zaehler = einheit.warmwasser_zaehler || '';
      initialValues.strom_zaehler = einheit.strom_zaehler || '';
      initialValues.gas_zaehler = einheit.gas_zaehler || '';
    }
    
    // Add mieter data
    if (mieter) {
      mieter.forEach((m: any) => {
        initialValues[`mieter_${m.id}_vorname`] = m.vorname || '';
        initialValues[`mieter_${m.id}_nachname`] = m.nachname || '';
        initialValues[`mieter_${m.id}_hauptmail`] = m.hauptmail || '';
        initialValues[`mieter_${m.id}_telnr`] = m.telnr || '';
      });
    }
    
    setEditedValues(initialValues);
    setIsGlobalEditMode(true);
  };

  const handleCancelGlobalEdit = () => {
    setEditedValues({});
    setIsGlobalEditMode(false);
  };

  const handleSaveGlobalEdit = async () => {
    try {
      // Prepare mietvertrag updates
      const mietvertragUpdates: any = {};
      const mietvertragFields = [
        'kaltmiete', 'betriebskosten', 'ruecklastschrift_gebuehr', 'neue_anschrift',
        'kaution_betrag', 'kaution_ist',
        'kaltwasser_einzug', 'warmwasser_einzug', 'strom_einzug', 'gas_einzug',
        'kaltwasser_auszug', 'warmwasser_auszug', 'strom_auszug', 'gas_auszug'
      ];
      
      mietvertragFields.forEach(field => {
        if (editedValues[field] !== undefined) {
          mietvertragUpdates[field] = editedValues[field];
        }
      });

      // Check if rent increased
      const oldKaltmiete = Number(vertrag?.kaltmiete || 0);
      const oldBetriebskosten = Number(vertrag?.betriebskosten || 0);
      const newKaltmiete = Number(editedValues.kaltmiete || 0);
      const newBetriebskosten = Number(editedValues.betriebskosten || 0);
      
      if (newKaltmiete > oldKaltmiete || newBetriebskosten > oldBetriebskosten) {
        mietvertragUpdates.letzte_mieterhoehung_am = new Date().toISOString().split('T')[0];
      }

      // Update mietvertrag
      if (Object.keys(mietvertragUpdates).length > 0) {
        const { error: mietvertragError } = await supabase
          .from('mietvertrag')
          .update(mietvertragUpdates)
          .eq('id', vertragId);

        if (mietvertragError) throw mietvertragError;
      }

      // Update einheit meter numbers if changed
      if (einheit) {
        const einheitUpdates: any = {};
        const einheitFields = ['kaltwasser_zaehler', 'warmwasser_zaehler', 'strom_zaehler', 'gas_zaehler'];
        
        einheitFields.forEach(field => {
          if (editedValues[field] !== undefined) {
            einheitUpdates[field] = editedValues[field];
          }
        });

        if (Object.keys(einheitUpdates).length > 0) {
          const { error: einheitError } = await supabase
            .from('einheiten')
            .update(einheitUpdates)
            .eq('id', einheit.id);

          if (einheitError) throw einheitError;
        }
      }

      // Update mieter data
      if (mieter) {
        for (const m of mieter) {
          const mieterUpdates: any = {};
          
          if (editedValues[`mieter_${m.id}_vorname`] !== undefined) {
            mieterUpdates.vorname = editedValues[`mieter_${m.id}_vorname`];
          }
          if (editedValues[`mieter_${m.id}_nachname`] !== undefined) {
            mieterUpdates.nachname = editedValues[`mieter_${m.id}_nachname`];
          }
          if (editedValues[`mieter_${m.id}_hauptmail`] !== undefined) {
            mieterUpdates.hauptmail = editedValues[`mieter_${m.id}_hauptmail`];
          }
          if (editedValues[`mieter_${m.id}_telnr`] !== undefined) {
            mieterUpdates.telnr = editedValues[`mieter_${m.id}_telnr`];
          }

          if (Object.keys(mieterUpdates).length > 0) {
            const { error: mieterError } = await supabase
              .from('mieter')
              .update(mieterUpdates)
              .eq('id', m.id);

            if (mieterError) throw mieterError;
          }
        }
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
      await queryClient.invalidateQueries({ queryKey: ['mietvertrag-mieter-detail', vertragId] });
      await queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });

      toast({
        title: "Erfolgreich gespeichert",
        description: "Alle Änderungen wurden übernommen.",
      });

      setIsGlobalEditMode(false);
      setEditedValues({});

    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEditedValue = (key: string, value: any) => {
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Loading state
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

  // Not found state
  if (!vertrag) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="text-center p-8">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Mietvertrag nicht gefunden</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] h-[95vh] md:h-auto overflow-hidden flex flex-col p-4 md:p-6">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2 text-lg md:text-xl">
              <Building2 className="h-4 w-4 md:h-5 md:w-5" />
              <span>Mietvertrag Details</span>
            </DialogTitle>
            <div className="flex gap-2">
              {!isGlobalEditMode ? (
                <Button onClick={handleStartGlobalEdit} variant="outline" size="sm">
                  Bearbeiten
                </Button>
              ) : (
                <>
                  <Button onClick={handleSaveGlobalEdit} size="sm">
                    Speichern
                  </Button>
                  <Button onClick={handleCancelGlobalEdit} variant="outline" size="sm">
                    Abbrechen
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-4 md:-mx-6 px-4 md:px-6">
          <Tabs defaultValue="uebersicht" className="space-y-2 md:space-y-4">
            <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-background">
              <TabsTrigger value="uebersicht" className="text-xs md:text-sm">Übersicht</TabsTrigger>
              <TabsTrigger value="dokumente" className="text-xs md:text-sm">Dokumente</TabsTrigger>
            </TabsList>

            <TabsContent value="uebersicht" className="space-y-4">
              <MietvertragOverviewTab
                vertrag={vertrag}
                mieter={mieter || []}
                forderungen={forderungen || []}
                zahlungen={zahlungen || []}
                immobilie={immobilie}
                einheit={einheit}
                isGlobalEditMode={isGlobalEditMode}
                editedValues={editedValues}
                onUpdateEditedValue={handleUpdateEditedValue}
                editingMietvertrag={editingMietvertrag}
                editingKaution={editingKaution}
                onEditMietvertrag={handleEditMietvertrag}
                onStartEdit={(field) => setEditingMietvertrag(field)}
                onCancelEdit={() => setEditingMietvertrag(null)}
                onEditKaution={handleEditKaution}
                onStartEditKaution={setEditingKaution}
                onCancelEditKaution={() => setEditingKaution(null)}
                editingMeter={editingMeter}
                editingMeterNumber={editingMeterNumber}
                onEditMeter={handleEditMeter}
                onStartEditMeter={setEditingMeter}
                onCancelEditMeter={() => setEditingMeter(null)}
                onEditMeterNumber={handleEditMeterNumber}
                onStartEditMeterNumber={setEditingMeterNumber}
                onCancelEditMeterNumber={() => setEditingMeterNumber(null)}
                onCreateForderung={() => setShowCreateForderungModal(true)}
                allMietvertraege={allMietvertraege}
                vertragId={vertragId}
                formatDatum={formatDatum}
                formatBetrag={formatBetrag}
              />
            </TabsContent>

            <TabsContent value="dokumente" className="space-y-4">
              <MietvertragDocumentsTab
                dokumente={dokumente || []}
                formatDatum={formatDatum}
                onDocumentsChange={() => {
                  // Refresh documents query when categories are changed
                  queryClient.invalidateQueries({ 
                    queryKey: ['mietvertrag-dokumente', vertragId] 
                  });
                }}
              />
            </TabsContent>
          </Tabs>

          {/* Action Buttons for Active Contracts */}
          {vertrag?.status === 'aktiv' && (
            <div className="pt-4 border-t border-border space-y-3">
              <Button
                variant="default"
                onClick={() => setShowMahnungModal(true)}
                className="w-full"
              >
                Mahnung erstellen
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowTerminationDialog(true)}
                className="w-full"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Mietvertrag kündigen
              </Button>
            </div>
          )}
        </div>

        {/* Create Forderung Modal */}
        <CreateForderungModal
          isOpen={showCreateForderungModal}
          onClose={() => setShowCreateForderungModal(false)}
          mietvertragId={vertragId}
          currentKaltmiete={Number(vertrag?.kaltmiete || 0)}
          currentBetriebskosten={Number(vertrag?.betriebskosten || 0)}
        />

        {/* Termination Dialog */}
        <TerminationDialog
          isOpen={showTerminationDialog}
          onClose={() => setShowTerminationDialog(false)}
          vertragId={vertragId}
          einheit={einheit}
          immobilie={immobilie}
          onTerminationSuccess={handleTerminationSuccess}
        />

        {/* Mahnung Modal */}
        <MahnungErstellungModal
          isOpen={showMahnungModal}
          onClose={() => {
            setShowMahnungModal(false);
            queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', vertragId] });
            queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
          }}
          contractData={vertrag ? {
            mietvertrag_id: vertragId,
            current_kaltmiete: Number(vertrag.kaltmiete || 0),
            current_betriebskosten: Number(vertrag.betriebskosten || 0),
            letzte_mieterhoehung_am: vertrag.letzte_mieterhoehung_am,
            start_datum: vertrag.start_datum,
            einheit_id: einheit?.id,
            immobilie_id: immobilie?.id,
            immobilie_name: immobilie?.name,
            immobilie_adresse: immobilie?.adresse,
            mahnstufe: vertrag.mahnstufe || 0,
            mieter: mieter as any[]
          } : null}
          offeneForderungen={(forderungen || [])
            .filter(f => {
              // Filter for unpaid forderungen by checking if payment exists for this month
              const hasSufficientPayment = (zahlungen || []).some(z => 
                z.zugeordneter_monat === f.sollmonat && 
                Math.abs(Number(z.betrag) - Number(f.sollbetrag)) < 50 // 50€ tolerance
              );
              return !hasSufficientPayment;
            })
            .map(f => ({
              id: f.id,
              sollmonat: f.sollmonat,
              sollbetrag: Number(f.sollbetrag),
              ist_faellig: f.ist_faellig || false
            }))
          }
        />
      </DialogContent>
    </Dialog>
  );
}