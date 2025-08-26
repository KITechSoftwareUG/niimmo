import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, User, ArrowUpDown, ArrowUp, ArrowDown, Save, X, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import React from "react";

interface MietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrganizedPropertyGroup {
  immobilie: {
    id: string;
    name: string;
    adresse: string;
  };
  vertraege: any[];
}

interface EditingCell {
  vertragId: string;
  field: string;
  value: any;
}

export const MietUebersichtModal = ({ open, onOpenChange }: MietUebersichtModalProps) => {
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Editing state
  const [editingCells, setEditingCells] = useState<EditingCell[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorting icon component
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // Handle editing
  const startEditing = (vertragId: string, field: string, currentValue: any) => {
    if (!isEditing) setIsEditing(true);
    
    const existingIndex = editingCells.findIndex(
      cell => cell.vertragId === vertragId && cell.field === field
    );
    
    if (existingIndex >= 0) {
      // Already editing, do nothing
      return;
    }
    
    setEditingCells(prev => [
      ...prev,
      { vertragId, field, value: currentValue }
    ]);
  };

  const updateEditingValue = (vertragId: string, field: string, value: any) => {
    setEditingCells(prev =>
      prev.map(cell =>
        cell.vertragId === vertragId && cell.field === field
          ? { ...cell, value }
          : cell
      )
    );
  };

  const cancelEdit = (vertragId: string, field: string) => {
    setEditingCells(prev =>
      prev.filter(cell => !(cell.vertragId === vertragId && cell.field === field))
    );
    
    if (editingCells.length === 1) {
      setIsEditing(false);
    }
  };

  const cancelAllEdits = () => {
    setEditingCells([]);
    setIsEditing(false);
  };

  const getEditingValue = (vertragId: string, field: string) => {
    const cell = editingCells.find(
      cell => cell.vertragId === vertragId && cell.field === field
    );
    return cell?.value;
  };

  const isFieldEditing = (vertragId: string, field: string) => {
    return editingCells.some(
      cell => cell.vertragId === vertragId && cell.field === field
    );
  };
  // Save mutations
  const saveMietvertragMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('mietvertrag')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['miet-uebersicht'] });
      toast({ title: "Mietvertrag aktualisiert" });
    },
    onError: (error) => {
      toast({ 
        title: "Fehler beim Speichern", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const saveEinheitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('einheiten')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['miet-uebersicht'] });
      toast({ title: "Einheit aktualisiert" });
    },
    onError: (error) => {
      toast({ 
        title: "Fehler beim Speichern", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const saveMieterMutation = useMutation({
    mutationFn: async ({ vertragId, mieterName }: { vertragId: string; mieterName: string }) => {
      // First get existing tenant or create new one
      const [vorname, ...nachnameArray] = mieterName.split(' ');
      const nachname = nachnameArray.join(' ') || '';

      // Try to find existing tenant first
      const { data: existingMieter } = await supabase
        .from('mieter')
        .select('id')
        .eq('vorname', vorname)
        .eq('nachname', nachname)
        .single();

      let mieterId;
      
      if (existingMieter) {
        mieterId = existingMieter.id;
      } else {
        // Create new tenant
        const { data: newMieter, error: mieterError } = await supabase
          .from('mieter')
          .insert({ vorname, nachname })
          .select('id')
          .single();
        
        if (mieterError) throw mieterError;
        mieterId = newMieter.id;
      }

      // Remove existing tenant connections for this contract
      await supabase
        .from('mietvertrag_mieter')
        .delete()
        .eq('mietvertrag_id', vertragId);

      // Add new connection
      const { error: connectionError } = await supabase
        .from('mietvertrag_mieter')
        .insert({ mietvertrag_id: vertragId, mieter_id: mieterId });
      
      if (connectionError) throw connectionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['miet-uebersicht'] });
      queryClient.invalidateQueries({ queryKey: ['mieter-uebersicht'] });
      toast({ title: "Mieter aktualisiert" });
    },
    onError: (error) => {
      toast({ 
        title: "Fehler beim Speichern", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Save all changes
  const saveAllChanges = async () => {
    try {
      for (const cell of editingCells) {
          const { vertragId, field, value } = cell;
          
          // Find the contract for updates
          const vertrag = mietvertraegeData?.find(v => v.id === vertragId);
          if (!vertrag) continue;

          switch (field) {
            case 'mieter':
              await saveMieterMutation.mutateAsync({ vertragId, mieterName: value });
              break;
              
            case 'kaltmiete':
            case 'betriebskosten':
            case 'kaution':
            case 'startDatum':
            case 'letzteMieterhoehung':
              await saveMietvertragMutation.mutateAsync({
                id: vertragId,
                updates: {
                  [field === 'startDatum' ? 'start_datum' : 
                   field === 'kaution' ? 'kaution_betrag' :
                   field === 'letzteMieterhoehung' ? 'letzte_mieterhoehung_am' : field]: value
                }
              });
              break;
            
          case 'etage':
          case 'qm':
          case 'nutzung':
            await saveEinheitMutation.mutateAsync({
              id: vertrag.einheit_id,
              updates: {
                [field === 'nutzung' ? 'einheitentyp' : field]: value
              }
            });
            break;
        }
      }
      
      setEditingCells([]);
      setIsEditing(false);
      toast({ title: "Alle Änderungen gespeichert" });
      
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };
  const { data: mietvertraegeData, isLoading } = useQuery({
    queryKey: ['miet-uebersicht'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          kaltmiete,
          betriebskosten,
          status,
          start_datum,
          ende_datum,
          kuendigungsdatum,
          kaution_betrag,
          letzte_mieterhoehung_am,
          einheit_id,
          einheiten (
            id,
            etage,
            qm,
            einheitentyp,
            immobilie_id,
            immobilien (
              id,
              name,
              adresse
            )
          )
        `)
        .order('start_datum', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  // Hole Zahlungen für alle Mietverträge
  const { data: zahlungenData } = useQuery({
    queryKey: ['zahlungen-uebersicht'],
    queryFn: async () => {
      if (!mietvertraegeData) return [];
      
      const mietvertragIds = mietvertraegeData.map(mv => mv.id);
      
      const { data, error } = await supabase
        .from('zahlungen')
        .select('mietvertrag_id, betrag, buchungsdatum')
        .in('mietvertrag_id', mietvertragIds)
        .eq('kategorie', 'Miete');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!mietvertraegeData && open
  });

  // Hole Mieter für alle Mietverträge
  const { data: mieterData } = useQuery({
    queryKey: ['mieter-uebersicht'],
    queryFn: async () => {
      if (!mietvertraegeData) return [];
      
      const mietvertragIds = mietvertraegeData.map(mv => mv.id);
      
      const { data, error } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mietvertrag_id,
          mieter (
            id,
            vorname,
            nachname
          )
        `)
        .in('mietvertrag_id', mietvertragIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!mietvertraegeData && open
  });

  // Berechne Zahlungsstatistiken pro Mietvertrag
  const getZahlungenFuerVertrag = (mietvertragId: string) => {
    const heute = new Date();
    const aktuellerMonat = heute.getMonth();
    const aktuellesJahr = heute.getFullYear();
    
    const zahlungenFuerVertrag = zahlungenData?.filter(z => z.mietvertrag_id === mietvertragId) || [];
    
    // Zahlungen für aktuellen Monat
    const aktuelleMonatZahlungen = zahlungenFuerVertrag.filter(z => {
      const buchungsdatum = new Date(z.buchungsdatum);
      return buchungsdatum.getMonth() === aktuellerMonat && buchungsdatum.getFullYear() === aktuellesJahr;
    });
    
    const summeAktuellerMonat = aktuelleMonatZahlungen.reduce((sum, z) => sum + (z.betrag || 0), 0);
    const gesamtZahlungen = zahlungenFuerVertrag.reduce((sum, z) => sum + (z.betrag || 0), 0);
    
    return {
      aktuellerMonat: summeAktuellerMonat,
      gesamt: gesamtZahlungen,
      anzahlZahlungen: zahlungenFuerVertrag.length
    };
  };

  // Hole Mieternamen für Vertrag
  const getMieterNamen = (mietvertragId: string) => {
    const mieterFuerVertrag = mieterData?.filter(m => m.mietvertrag_id === mietvertragId) || [];
    return mieterFuerVertrag
      .map(m => `${m.mieter.vorname} ${m.mieter.nachname}`)
      .join(', ');
  };

  // Sortiere die Daten und organisiere sie nach Immobilien
  const organizedData = useMemo((): OrganizedPropertyGroup[] => {
    if (!mietvertraegeData) return [];

    // Filtere nur aktive Mietverträge
    const aktiveMietvertraege = mietvertraegeData.filter(vertrag => vertrag.status === 'aktiv');

    // Gruppiere nach Immobilien
    const groupedByProperty: Record<string, OrganizedPropertyGroup> = aktiveMietvertraege.reduce((acc, vertrag) => {
      const immobilieId = vertrag.einheiten?.immobilie_id;
      const immobilieName = vertrag.einheiten?.immobilien?.name || 'Unbekannte Immobilie';
      
      if (!acc[immobilieId]) {
        acc[immobilieId] = {
          immobilie: {
            id: immobilieId,
            name: immobilieName,
            adresse: vertrag.einheiten?.immobilien?.adresse || ''
          },
          vertraege: []
        };
      }
      
      acc[immobilieId].vertraege.push(vertrag);
      return acc;
    }, {} as Record<string, OrganizedPropertyGroup>);

    // Sortiere Verträge innerhalb jeder Immobilie basierend auf Einheits-ID-Struktur
    Object.values(groupedByProperty).forEach(group => {
      group.vertraege.sort((a, b) => {
        // Extrahiere die Einheits-ID basierend auf der beschriebenen Struktur
        const extractEinheitInfo = (id: string) => {
          const idStr = id.toString();
          // Letzten beiden Ziffern = Einheits-ID
          const einheitId = parseInt(idStr.slice(-2)) || 0;
          // Dritt- und viertletzte Ziffern = Immobilien-ID  
          const immobilienId = idStr.length >= 4 ? parseInt(idStr.slice(-4, -2)) || 0 : 0;
          return { einheitId, immobilienId };
        };

        const aInfo = extractEinheitInfo(a.einheiten?.id || '0');
        const bInfo = extractEinheitInfo(b.einheiten?.id || '0');
        
        // Primäre Sortierung: Immobilien-ID (aus der Einheits-ID extrahiert)
        if (aInfo.immobilienId !== bInfo.immobilienId) {
          return aInfo.immobilienId - bInfo.immobilienId;
        }
        
        // Sekundäre Sortierung: Einheits-ID (fortlaufend)
        if (aInfo.einheitId !== bInfo.einheitId) {
          return aInfo.einheitId - bInfo.einheitId;
        }
        
        // Tertiäre Sortierung: Mietbeginn (chronologisch)
        const aStartDate = a.start_datum ? new Date(a.start_datum) : new Date(0);
        const bStartDate = b.start_datum ? new Date(b.start_datum) : new Date(0);
        
        return aStartDate.getTime() - bStartDate.getTime();
      });
    });

    // Sortiere Immobilien alphabetisch nach Namen
    return Object.values(groupedByProperty).sort((a, b) => {
      return a.immobilie.name.localeCompare(b.immobilie.name, 'de', { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });
  }, [mietvertraegeData]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Mietübersicht wird geladen...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Mietübersicht - Alle Verträge</DialogTitle>
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
                  <Button 
                    onClick={saveAllChanges}
                    disabled={editingCells.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Speichern ({editingCells.length})
                  </Button>
                  <Button 
                    onClick={cancelAllEdits}
                    variant="outline"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </>
              )}
              {!isEditing && (
                <Button 
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('lfdNr')}
                >
                  <div className="flex items-center justify-center gap-1">
                    lfd. Nr
                    <SortIcon field="lfdNr" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('einheit')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Einh.
                    <SortIcon field="einheit" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('mieter')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Mieter
                    <SortIcon field="mieter" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('lage')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Lage
                    <SortIcon field="lage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('nutzung')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Nutzung
                    <SortIcon field="nutzung" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('flaeche')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Fläche
                    <SortIcon field="flaeche" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('preisProQm')}
                >
                  <div className="flex items-center justify-center gap-1">
                    €/m²
                    <SortIcon field="preisProQm" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('kaltmiete')}
                >
                  <div className="flex items-center justify-center gap-1">
                    KM
                    <SortIcon field="kaltmiete" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('betriebskosten')}
                >
                  <div className="flex items-center justify-center gap-1">
                    BKV
                    <SortIcon field="betriebskosten" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('gesamtmiete')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Gesamtmiete
                    <SortIcon field="gesamtmiete" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('mietbeginn')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Mietbeginn
                    <SortIcon field="mietbeginn" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('letzteMieterhoehung')}
                >
                  <div className="flex items-center justify-center gap-1">
                    letzte Mieterh.
                    <SortIcon field="letzteMieterhoehung" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('laufzeit')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Laufzeit
                    <SortIcon field="laufzeit" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('kaution')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Kaution
                    <SortIcon field="kaution" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('naechsteMietErhoehung')}
                >
                  <div className="flex items-center justify-center gap-1">
                    nächste mögl. Erhöh.
                    <SortIcon field="naechsteMietErhoehung" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center font-bold text-xs"
                >
                  Aktion
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizedData.map((propertyGroup, propertyIndex) => {
                let laufendeNummer = 1;
                
                return (
                  <React.Fragment key={propertyGroup.immobilie.id}>
                    {/* Property Header Row */}
                    <TableRow className="bg-blue-50 font-bold">
                      <TableCell colSpan={16} className="text-left font-bold text-sm">
                        Objekt {propertyIndex + 1} {propertyGroup.immobilie.name}
                      </TableCell>
                    </TableRow>
                    
                    {/* Unit Rows */}
                    {propertyGroup.vertraege.map((vertrag, index) => {
                      const mieterNamen = getMieterNamen(vertrag.id);
                      const gesamtmiete = (vertrag.kaltmiete || 0) + (vertrag.betriebskosten || 0);
                      const preisProQm = vertrag.einheiten?.qm ? (vertrag.kaltmiete || 0) / (vertrag.einheiten.qm || 1) : 0;
                      
                      return (
                        <TableRow key={vertrag.id} className="border-b">
                          {/* lfd. Nr */}
                          <TableCell className="text-center text-xs border-r">
                            {laufendeNummer++}
                          </TableCell>
                          
                          {/* Einh. */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.einheiten?.id || '-'}
                          </TableCell>
                          
                          {/* Mieter */}
                          <TableCell className="text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'mieter') ? (
                              <Input
                                value={getEditingValue(vertrag.id, 'mieter') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'mieter', e.target.value)}
                                className="h-6 text-xs"
                                onBlur={() => cancelEdit(vertrag.id, 'mieter')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'mieter', mieterNamen)}
                              >
                                {mieterNamen || '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Lage */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'etage') ? (
                              <Input
                                value={getEditingValue(vertrag.id, 'etage') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'etage', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'etage')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'etage', vertrag.einheiten?.etage)}
                              >
                                {vertrag.einheiten?.etage || '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Nutzung */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'nutzung') ? (
                              <Select
                                value={getEditingValue(vertrag.id, 'nutzung') || 'Wohnung'}
                                onValueChange={(value) => updateEditingValue(vertrag.id, 'nutzung', value)}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Wohnung">Wohnung</SelectItem>
                                  <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                                  <SelectItem value="Büro">Büro</SelectItem>
                                  <SelectItem value="Lager">Lager</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'nutzung', vertrag.einheiten?.einheitentyp)}
                              >
                                {vertrag.einheiten?.einheitentyp || 'Wohnung'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Fläche */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'qm') ? (
                              <Input
                                type="number"
                                value={getEditingValue(vertrag.id, 'qm') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'qm', parseFloat(e.target.value))}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'qm')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'qm', vertrag.einheiten?.qm)}
                              >
                                {vertrag.einheiten?.qm ? `${vertrag.einheiten.qm}m²` : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* €/m² */}
                          <TableCell className="text-center text-xs border-r">
                            {preisProQm > 0 ? `${preisProQm.toFixed(2)} €` : '-'}
                          </TableCell>
                          
                          {/* KM */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'kaltmiete') ? (
                              <Input
                                type="number"
                                value={getEditingValue(vertrag.id, 'kaltmiete') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'kaltmiete', parseFloat(e.target.value))}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'kaltmiete')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'kaltmiete', vertrag.kaltmiete)}
                              >
                                {(vertrag.kaltmiete || 0).toLocaleString()} €
                              </div>
                            )}
                          </TableCell>
                          
                          {/* BKV */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'betriebskosten') ? (
                              <Input
                                type="number"
                                value={getEditingValue(vertrag.id, 'betriebskosten') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'betriebskosten', parseFloat(e.target.value))}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'betriebskosten')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'betriebskosten', vertrag.betriebskosten)}
                              >
                                {(vertrag.betriebskosten || 0).toLocaleString()} €
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Gesamtmiete */}
                          <TableCell className="text-center text-xs font-medium border-r">
                            {gesamtmiete.toLocaleString()} €
                          </TableCell>
                          
                          {/* Mietbeginn */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'startDatum') ? (
                              <Input
                                type="date"
                                value={getEditingValue(vertrag.id, 'startDatum') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'startDatum', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'startDatum')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'startDatum', vertrag.start_datum)}
                              >
                                {vertrag.start_datum ? new Date(vertrag.start_datum).toLocaleDateString('de-DE') : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* letzte Mieterh. */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'letzteMieterhoehung') ? (
                              <Input
                                type="date"
                                value={getEditingValue(vertrag.id, 'letzteMieterhoehung') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'letzteMieterhoehung', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'letzteMieterhoehung')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'letzteMieterhoehung', vertrag.letzte_mieterhoehung_am)}
                              >
                                {vertrag.letzte_mieterhoehung_am ? new Date(vertrag.letzte_mieterhoehung_am).toLocaleDateString('de-DE') : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Laufzeit */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.status === 'gekuendigt' && vertrag.kuendigungsdatum 
                              ? new Date(vertrag.kuendigungsdatum).toLocaleDateString('de-DE')
                              : vertrag.ende_datum 
                                ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE')
                                : 'unbefristet'
                            }
                          </TableCell>
                          
                          {/* Kaution */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'kaution') ? (
                              <Input
                                type="number"
                                value={getEditingValue(vertrag.id, 'kaution') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'kaution', parseFloat(e.target.value))}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'kaution')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'kaution', vertrag.kaution_betrag)}
                              >
                                {vertrag.kaution_betrag ? `${vertrag.kaution_betrag.toLocaleString()} €` : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* nächste mögl. Erhöh. */}
                          <TableCell className="text-center text-xs border-r">
                            {(() => {
                              const startDatum = vertrag.start_datum ? new Date(vertrag.start_datum) : null;
                              const letzteMieterhoehung = vertrag.letzte_mieterhoehung_am ? new Date(vertrag.letzte_mieterhoehung_am) : null;
                              
                              if (!startDatum) return '-';
                              
                              // Verwende das spätere Datum (Einzug oder letzte Mieterhöhung)
                              const referenzDatum = letzteMieterhoehung && letzteMieterhoehung > startDatum ? letzteMieterhoehung : startDatum;
                              
                              // Frühest mögliche Erhöhung: 15 Monate nach Referenzdatum
                              const naechsteMoeglicheErhoehung = new Date(referenzDatum);
                              naechsteMoeglicheErhoehung.setMonth(naechsteMoeglicheErhoehung.getMonth() + 15);
                              
                              const heute = new Date();
                              
                              if (naechsteMoeglicheErhoehung <= heute) {
                                return (
                                  <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                                    jetzt möglich
                                  </Badge>
                                );
                              } else {
                                return naechsteMoeglicheErhoehung.toLocaleDateString('de-DE');
                              }
                            })()}
                          </TableCell>
                          
                          {/* Aktion */}
                          <TableCell className="text-center text-xs">
                            {(() => {
                              const startDatum = vertrag.start_datum ? new Date(vertrag.start_datum) : null;
                              const letzteMieterhoehung = vertrag.letzte_mieterhoehung_am ? new Date(vertrag.letzte_mieterhoehung_am) : null;
                              
                              if (!startDatum) return null;
                              
                              const referenzDatum = letzteMieterhoehung && letzteMieterhoehung > startDatum ? letzteMieterhoehung : startDatum;
                              const naechsteMoeglicheErhoehung = new Date(referenzDatum);
                              naechsteMoeglicheErhoehung.setMonth(naechsteMoeglicheErhoehung.getMonth() + 15);
                              
                              const heute = new Date();
                              
                              if (naechsteMoeglicheErhoehung <= heute) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={async () => {
                                      try {
                                        const mieterNamen = getMieterNamen(vertrag.id);
                                        const { error } = await supabase.functions.invoke('send-rent-increase-notification', {
                                          body: {
                                            vertragId: vertrag.id,
                                            mieterName: mieterNamen,
                                            immobilieName: vertrag.einheiten?.immobilien?.name,
                                            einheitId: vertrag.einheiten?.id,
                                            aktuelleKaltmiete: vertrag.kaltmiete,
                                            aktuelleBetriebskosten: vertrag.betriebskosten
                                          }
                                        });
                                        
                                        if (error) throw error;
                                        
                                        toast({ 
                                          title: "Benachrichtigung versendet", 
                                          description: "Die Mieterhöhungsbenachrichtigung wurde versendet."
                                        });
                                      } catch (error) {
                                        console.error('Error sending notification:', error);
                                        toast({ 
                                          title: "Fehler", 
                                          description: "Die Benachrichtigung konnte nicht versendet werden.",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                  >
                                    Erhöhung
                                  </Button>
                                );
                              }
                              return null;
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          
          {organizedData?.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500">Keine Mietverträge gefunden</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};