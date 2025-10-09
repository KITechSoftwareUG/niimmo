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
  
  // Simplified state management
  const [editingKaution, setEditingKaution] = useState<'soll' | 'ist' | null>(null);
  const [editingMietvertrag, setEditingMietvertrag] = useState<'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr' | null>(null);
  const [editingMeter, setEditingMeter] = useState<string | null>(null);
  const [editingMeterNumber, setEditingMeterNumber] = useState<string | null>(null);
  const [showCreateForderungModal, setShowCreateForderungModal] = useState(false);
  const [showTerminationDialog, setShowTerminationDialog] = useState(false);
  
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

  // Event handlers
  const handleEditMietvertrag = async (field: 'kaltmiete' | 'betriebskosten' | 'neue_anschrift' | 'ruecklastschrift_gebuehr', value: string) => {
    try {
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
              <MietvertragOverviewTab
                vertrag={vertrag}
                mieter={mieter || []}
                forderungen={forderungen || []}
                zahlungen={zahlungen || []}
                immobilie={immobilie}
                einheit={einheit}
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
                onClick={async () => {
                  try {
                    const payload = {
                      mahnung: true,
                      mietvertrag_id: vertragId,
                      current_kaltmiete: Number(vertrag?.kaltmiete || 0),
                      current_betriebskosten: Number(vertrag?.betriebskosten || 0),
                      letzte_mieterhoehung_am: vertrag?.letzte_mieterhoehung_am,
                      start_datum: vertrag?.start_datum,
                      einheit_id: einheit?.id,
                      immobilie_id: immobilie?.id,
                      immobilie_name: immobilie?.name,
                      immobilie_adresse: immobilie?.adresse,
                      mieter: mieter || []
                    };
                    
                    console.log('📤 Sende Mahnung an Webhook:', payload);
                    const webhookUrl = 'https://k01-2025-u36730.vm.elestio.app/webhook/6fb34c33-670a-499b-ad45-6067ad7b5920';
                    
                    const response = await fetch(webhookUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(payload)
                    });
                    
                    console.log('📥 Response Status:', response.status);
                    const responseText = await response.text();
                    console.log('📥 Response Body:', responseText);
                    
                    if (response.ok) {
                      toast({
                        title: "Mahnung erstellt",
                        description: "Die Mahnung wurde erfolgreich erstellt.",
                      });
                    } else {
                      toast({
                        title: "Fehler",
                        description: `Fehler beim Erstellen der Mahnung (Status: ${response.status})`,
                        variant: "destructive",
                      });
                    }
                  } catch (err) {
                    console.error('❌ Fehler beim Senden:', err);
                    toast({
                      title: "Fehler",
                      description: 'Fehler beim Senden der Anfrage',
                      variant: "destructive",
                    });
                  }
                }}
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
      </DialogContent>
    </Dialog>
  );
}