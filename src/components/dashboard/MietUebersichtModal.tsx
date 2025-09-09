import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    const cell = editingCells.find(c => c.vertragId === vertragId && c.field === field);
    return cell ? cell.value : null;
  };

  const isFieldEditing = (vertragId: string, field: string) => {
    return editingCells.some(cell => cell.vertragId === vertragId && cell.field === field);
  };

  // Mutations for saving changes
  const mietvertragMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('mietvertrag')
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
    },
  });

  const einheitenMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('einheiten')
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
    },
  });

  const mieterMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('mieter')
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
    },
  });

  // Save all changes
  const saveAllChanges = async () => {
    try {
      const mietvertragUpdates = new Map();
      const einheitenUpdates = new Map();
      const mieterUpdates = new Map();

      editingCells.forEach(cell => {
        const { vertragId, field, value } = cell;
        
        if (['kaltmiete', 'betriebskosten', 'startDatum', 'endeDatum', 'letzteMieterhoehung'].includes(field)) {
          if (!mietvertragUpdates.has(vertragId)) {
            mietvertragUpdates.set(vertragId, {});
          }
          
          let dbField = field;
          if (field === 'startDatum') dbField = 'start_datum';
          if (field === 'endeDatum') dbField = 'ende_datum';
          if (field === 'letzteMieterhoehung') dbField = 'letzte_mieterhoehung_am';
          
          mietvertragUpdates.get(vertragId)[dbField] = value;
        }
      });

      // Check for rent increases and automatically set the date
      for (const [vertragId, updates] of mietvertragUpdates) {
        const originalVertrag = mietvertraegeData?.find(v => v.id === vertragId);
        
        if (originalVertrag && (updates.kaltmiete || updates.betriebskosten)) {
          const oldKaltmiete = originalVertrag.kaltmiete || 0;
          const oldBetriebskosten = originalVertrag.betriebskosten || 0;
          const newKaltmiete = updates.kaltmiete !== undefined ? parseFloat(updates.kaltmiete) : oldKaltmiete;
          const newBetriebskosten = updates.betriebskosten !== undefined ? parseFloat(updates.betriebskosten) : oldBetriebskosten;
          
          // Check if there's an increase in rent (Kaltmiete or Betriebskosten)
          if (newKaltmiete > oldKaltmiete || newBetriebskosten > oldBetriebskosten) {
            // Automatically set the date of last rent increase to today
            updates.letzte_mieterhoehung_am = new Date().toISOString().split('T')[0];
            
            toast({
              title: "Mieterhöhung erkannt",
              description: `Datum der letzten Mieterhöhung wurde automatisch auf heute gesetzt für Vertrag ${vertragId.slice(-8)}.`,
            });
          }
        }
      }

      // Execute all mutations
      for (const [vertragId, updates] of mietvertragUpdates) {
        await mietvertragMutation.mutateAsync({ id: vertragId, updates });
      }
      
      for (const [einheitId, updates] of einheitenUpdates) {
        await einheitenMutation.mutateAsync({ id: einheitId, updates });
      }
      
      for (const [mieterId, updates] of mieterUpdates) {
        await mieterMutation.mutateAsync({ id: mieterId, updates });
      }

      // Clear editing state
      setEditingCells([]);
      setIsEditing(false);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['miet-uebersicht'] });
      queryClient.invalidateQueries({ queryKey: ['zahlungen-uebersicht'] });
      queryClient.invalidateQueries({ queryKey: ['mieter-uebersicht'] });

      toast({
        title: "Änderungen gespeichert",
        description: "Alle Änderungen wurden erfolgreich gespeichert.",
      });

    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  // Fetch rental contracts with relations
  const { data: mietvertraegeData, isLoading } = useQuery({
    queryKey: ['miet-uebersicht'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          *,
          einheiten:einheit_id (
            *,
            immobilien:immobilie_id (*)
          ),
          mietvertrag_mieter (
            mieter (*)
          )
        `)
        .order('start_datum', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch payments overview
  const { data: zahlungenData } = useQuery({
    queryKey: ['zahlungen-uebersicht'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch tenants overview
  const { data: mieterData } = useQuery({
    queryKey: ['mieter-uebersicht'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mieter')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  // Helper functions
  const getKautionSoll = (vertrag: any) => {
    return vertrag.kaution_betrag 
      ? `${Number(vertrag.kaution_betrag).toLocaleString('de-DE')} €`
      : '-';
  };

  const getKautionIst = (vertrag: any) => {
    return vertrag.kaution_ist 
      ? `${Number(vertrag.kaution_ist).toLocaleString('de-DE')} €`
      : '0 €';
  };

  const getZahlungenFuerVertrag = (vertragId: string) => {
    if (!zahlungenData) return { aktuellerMonat: 0, gesamt: 0, anzahlZahlungen: 0 };
    
    const vertragsZahlungen = zahlungenData.filter(z => z.mietvertrag_id === vertragId);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const aktuellerMonat = vertragsZahlungen
      .filter(z => z.zugeordneter_monat === currentMonth || z.buchungsdatum?.startsWith(currentMonth))
      .reduce((sum, z) => sum + Number(z.betrag), 0);
    
    const gesamt = vertragsZahlungen.reduce((sum, z) => sum + Number(z.betrag), 0);
    
    return {
      aktuellerMonat,
      gesamt,
      anzahlZahlungen: vertragsZahlungen.length
    };
  };

  const getMieterNamen = (vertragId: string) => {
    const vertrag = mietvertraegeData?.find(v => v.id === vertragId);
    if (!vertrag?.mietvertrag_mieter?.length) return '-';
    
    return vertrag.mietvertrag_mieter
      .map((mm: any) => `${mm.mieter.vorname} ${mm.mieter.nachname}`)
      .join(', ');
  };

  // Organize data by property with sorting
  const organizedData: OrganizedPropertyGroup[] = useMemo(() => {
    if (!mietvertraegeData) return [];

    // Group contracts by property
    const groupedByProperty: { [key: string]: OrganizedPropertyGroup } = {};
    
    mietvertraegeData.forEach(vertrag => {
      const immobilie = vertrag.einheiten?.immobilien;
      if (!immobilie) return;
      
      const propertyKey = immobilie.id;
      
      if (!groupedByProperty[propertyKey]) {
        groupedByProperty[propertyKey] = {
          immobilie: {
            id: immobilie.id,
            name: immobilie.name,
            adresse: immobilie.adresse
          },
          vertraege: []
        };
      }
      
      groupedByProperty[propertyKey].vertraege.push(vertrag);
    });

    // Sort contracts within each property group
    Object.values(groupedByProperty).forEach(group => {
      group.vertraege.sort((a, b) => {
        // Helper function to extract unit and property info from the unit id
        const extractEinheitInfo = (idStr: string) => {
          const einheitId = parseInt(idStr.slice(-2)) || 0;
          const immobilienId = idStr.length >= 4 ? parseInt(idStr.slice(-4, -2)) || 0 : 0;
          return { einheitId, immobilienId };
        };

        const aInfo = extractEinheitInfo(a.einheiten?.id || '0');
        const bInfo = extractEinheitInfo(b.einheiten?.id || '0');
        
        // Primary sort: Property ID (extracted from unit ID)
        if (aInfo.immobilienId !== bInfo.immobilienId) {
          return aInfo.immobilienId - bInfo.immobilienId;
        }
        
        // Secondary sort: Unit ID (sequential)
        if (aInfo.einheitId !== bInfo.einheitId) {
          return aInfo.einheitId - bInfo.einheitId;
        }
        
        // Tertiary sort: Rental start date (chronological)
        const aStartDate = a.start_datum ? new Date(a.start_datum) : new Date(0);
        const bStartDate = b.start_datum ? new Date(b.start_datum) : new Date(0);
        
        return aStartDate.getTime() - bStartDate.getTime();
      });
    });

    // Sort properties alphabetically by name
    return Object.values(groupedByProperty).sort((a, b) => {
      return a.immobilie.name.localeCompare(b.immobilie.name, 'de', { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });
  }, [mietvertraegeData, sortField, sortDirection]);

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
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Mietübersicht ({organizedData.reduce((total, group) => total + group.vertraege.length, 0)} Verträge)
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelAllEdits}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Abbrechen
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={saveAllChanges}
                    className="flex items-center gap-1"
                    disabled={editingCells.length === 0}
                  >
                    <Save className="h-4 w-4" />
                    Alle speichern ({editingCells.length})
                  </Button>
                </>
              )}
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 max-h-[calc(90vh-100px)] overflow-y-auto">
          <div className="p-4">
            {/* Single Table with All Data and Sticky Headers */}
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                {/* Fixed Header */}
                <TableHeader className="sticky top-0 z-30 bg-white border-b-2 shadow-md backdrop-blur-sm">
                  <TableRow className="bg-white">
                    <TableHead className="text-center text-xs w-32 border-r bg-white sticky top-0 z-30">
                      Objekt
                    </TableHead>
                    <TableHead className="text-center text-xs w-12 border-r bg-white sticky top-0 z-30">
                      Einheit
                    </TableHead>
                    <TableHead className="text-center text-xs w-16 border-r bg-white sticky top-0 z-30">
                      Etage
                    </TableHead>
                    <TableHead className="text-center text-xs w-16 border-r bg-white sticky top-0 z-30">
                      qm
                    </TableHead>
                    <TableHead className="text-center text-xs w-20 border-r bg-white sticky top-0 z-30">
                      Nutzung
                    </TableHead>
                    <TableHead className="text-center text-xs w-32 border-r bg-white sticky top-0 z-30">
                      <button onClick={() => handleSort('mieter')} className="flex items-center gap-1 w-full justify-center">
                        Mieter
                        <SortIcon field="mieter" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center text-xs w-20 border-r bg-white sticky top-0 z-30">
                      <button onClick={() => handleSort('kaltmiete')} className="flex items-center gap-1 w-full justify-center">
                        Kaltmiete
                        <SortIcon field="kaltmiete" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center text-xs w-20 border-r bg-white sticky top-0 z-30">
                      <button onClick={() => handleSort('betriebskosten')} className="flex items-center gap-1 w-full justify-center">
                        BK
                        <SortIcon field="betriebskosten" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center text-xs w-16 border-r bg-white sticky top-0 z-30">
                      Status
                    </TableHead>
                    <TableHead className="text-center text-xs w-24 border-r bg-white sticky top-0 z-30">
                      Mietbeginn
                    </TableHead>
                    <TableHead className="text-center text-xs w-24 border-r bg-white sticky top-0 z-30">
                      Mietende
                    </TableHead>
                    <TableHead className="text-center text-xs w-20 border-r bg-white sticky top-0 z-30">
                      Kaution (S/I)
                    </TableHead>
                    <TableHead className="text-center text-xs w-24 border-r bg-white sticky top-0 z-30">
                      nächste mögl. Erhöh.
                    </TableHead>
                    <TableHead className="text-center text-xs w-20 border-r bg-white sticky top-0 z-30">
                      letzte Erhöhung
                    </TableHead>
                    <TableHead className="text-center text-xs w-24 border-r bg-white sticky top-0 z-30">
                      Zahlung aktueller Monat
                    </TableHead>
                    <TableHead className="text-center text-xs w-20 bg-white sticky top-0 z-30">
                      Zahlungen gesamt
                    </TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {organizedData.map((propertyGroup, groupIndex) => (
                    propertyGroup.vertraege.map((vertrag, vertragIndex) => {
                      const zahlungen = getZahlungenFuerVertrag(vertrag.id);
                      const mieterName = getMieterNamen(vertrag.id);
                      const isFirstInGroup = vertragIndex === 0;

                      return (
                        <TableRow 
                          key={vertrag.id} 
                          className={`hover:bg-gray-50 ${isFirstInGroup ? 'border-t-2 border-t-gray-300' : ''}`}
                        >
                          {/* Objekt Name - only show for first contract in group */}
                          <TableCell className="text-center text-xs border-r p-1 bg-gray-50/50">
                            {isFirstInGroup ? (
                              <div className="font-medium">
                                <div className="text-xs font-semibold">{propertyGroup.immobilie.name}</div>
                                <div className="text-xs text-gray-600">{propertyGroup.immobilie.adresse}</div>
                              </div>
                            ) : (
                              <div className="text-gray-300">↑</div>
                            )}
                          </TableCell>
                          
                          {/* Einheit */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {vertrag.einheiten?.id?.toString()?.slice(-2) || '-'}
                          </TableCell>
                          
                          {/* Etage */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'etage') ? (
                              <Input
                                type="text"
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
                          
                          {/* qm */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'qm') ? (
                              <Input
                                type="number"
                                step="0.1"
                                value={getEditingValue(vertrag.id, 'qm') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'qm', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'qm')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'qm', vertrag.einheiten?.qm)}
                              >
                                {vertrag.einheiten?.qm || '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Nutzung */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'einheitentyp') ? (
                              <Select 
                                value={getEditingValue(vertrag.id, 'einheitentyp') || ''} 
                                onValueChange={(value) => updateEditingValue(vertrag.id, 'einheitentyp', value)}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Wohnung">Wohnung</SelectItem>
                                  <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                                  <SelectItem value="Garage">Garage</SelectItem>
                                  <SelectItem value="Keller">Keller</SelectItem>
                                  <SelectItem value="Dachboden">Dachboden</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'einheitentyp', vertrag.einheiten?.einheitentyp)}
                              >
                                {vertrag.einheiten?.einheitentyp || '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Mieter */}
                          <TableCell className="text-center text-xs border-r p-1">
                            <div className="text-xs max-w-32 truncate" title={mieterName}>
                              {mieterName}
                            </div>
                          </TableCell>
                          
                          {/* Kaltmiete */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'kaltmiete') ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={getEditingValue(vertrag.id, 'kaltmiete') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'kaltmiete', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'kaltmiete')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'kaltmiete', vertrag.kaltmiete)}
                              >
                                {vertrag.kaltmiete ? `${Number(vertrag.kaltmiete).toLocaleString('de-DE')} €` : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Betriebskosten */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'betriebskosten') ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={getEditingValue(vertrag.id, 'betriebskosten') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'betriebskosten', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'betriebskosten')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'betriebskosten', vertrag.betriebskosten)}
                              >
                                {vertrag.betriebskosten ? `${Number(vertrag.betriebskosten).toLocaleString('de-DE')} €` : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Status */}
                          <TableCell className="text-center text-xs border-r p-1">
                            <Badge variant={vertrag.status === 'aktiv' ? 'default' : 'secondary'} className="text-xs">
                              {vertrag.status}
                            </Badge>
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
                                {vertrag.start_datum 
                                  ? new Date(vertrag.start_datum).toLocaleDateString('de-DE')
                                  : '-'
                                }
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Mietende */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'endeDatum') ? (
                              <Input
                                type="date"
                                value={getEditingValue(vertrag.id, 'endeDatum') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'endeDatum', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'endeDatum')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'endeDatum', vertrag.ende_datum)}
                              >
                                {vertrag.ende_datum 
                                  ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE')
                                  : '-'
                                }
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Kaution (S/I) */}
                          <TableCell className="text-center text-xs border-r p-1">
                            <div className="text-xs">
                              <div>
                                S: {getKautionSoll(vertrag)}
                              </div>
                              <div>
                                I: {getKautionIst(vertrag)}
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* nächste mögl. Erhöhung */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {vertrag.letzte_mieterhoehung_am 
                              ? (() => {
                                  const letzteErhoehung = new Date(vertrag.letzte_mieterhoehung_am);
                                  letzteErhoehung.setFullYear(letzteErhoehung.getFullYear() + 1);
                                  letzteErhoehung.setDate(letzteErhoehung.getDate() + 1);
                                  return letzteErhoehung.toLocaleDateString('de-DE');
                                })()
                              : vertrag.start_datum 
                                ? (() => {
                                    const startDatum = new Date(vertrag.start_datum);
                                    startDatum.setFullYear(startDatum.getFullYear() + 1);
                                    startDatum.setDate(startDatum.getDate() + 1);
                                    return startDatum.toLocaleDateString('de-DE');
                                  })()
                                : '-'
                            }
                          </TableCell>
                          
                          {/* letzte Erhöhung */}
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
                                {vertrag.letzte_mieterhoehung_am 
                                  ? new Date(vertrag.letzte_mieterhoehung_am).toLocaleDateString('de-DE')
                                  : '-'
                                }
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Zahlung aktueller Monat */}
                          <TableCell className="text-center text-xs border-r p-1">
                            <div className="text-xs">
                              {zahlungen.aktuellerMonat > 0 
                                ? `${zahlungen.aktuellerMonat.toLocaleString('de-DE')} €`
                                : '-'
                              }
                            </div>
                          </TableCell>
                          
                          {/* Zahlungen gesamt */}
                          <TableCell className="text-center text-xs">
                            <div className="text-xs">
                              {zahlungen.gesamt > 0 
                                ? `${zahlungen.gesamt.toLocaleString('de-DE')} €`
                                : '-'
                              }
                              {zahlungen.anzahlZahlungen > 0 && (
                                <div className="text-gray-500 text-xs">
                                  ({zahlungen.anzahlZahlungen} Zahlungen)
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};