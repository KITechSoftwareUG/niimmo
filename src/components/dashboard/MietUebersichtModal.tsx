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
            case 'kautionSoll':
            case 'startDatum':
            case 'letzteMieterhoehung':
            case 'endeDatum':
              await saveMietvertragMutation.mutateAsync({
                id: vertragId,
                updates: {
                  [field === 'startDatum' ? 'start_datum' : 
                   field === 'kautionSoll' ? 'kaution_betrag' :
                   field === 'letzteMieterhoehung' ? 'letzte_mieterhoehung_am' :
                   field === 'endeDatum' ? 'ende_datum' : field]: value
                }
              });
              break;

            case 'kautionIst':
              // Für IST-Kaution: Aktualisiere direkt die kaution_ist Spalte
              await supabase
                .from('mietvertrag')
                .update({ kaution_ist: value })
                .eq('id', vertragId);
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

  // Hole Zahlungen für alle Mietverträge (einschließlich Kaution)
  const { data: zahlungenData } = useQuery({
    queryKey: ['zahlungen-uebersicht'],
    queryFn: async () => {
      if (!mietvertraegeData) return [];
      
      const mietvertragIds = mietvertraegeData.map(mv => mv.id);
      
      const { data, error } = await supabase
        .from('zahlungen')
        .select('mietvertrag_id, betrag, buchungsdatum, kategorie')
        .in('mietvertrag_id', mietvertragIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!mietvertraegeData && open
  });

  // Hilfsfunktionen für SOLL und IST Kaution
  const getKautionSoll = (vertrag: any) => {
    return vertrag.kaution_betrag || 0;
  };

  const getKautionIst = (vertrag: any) => {
    const alleZahlungen = zahlungenData || [];
    const kautionZahlungen = alleZahlungen.filter(zahlung => 
      zahlung.mietvertrag_id === vertrag.id && 
      zahlung.kategorie === 'Mietkaution'
    );
    
    return kautionZahlungen.reduce((sum, zahlung) => sum + (zahlung.betrag || 0), 0);
  };

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
    
    const zahlungenFuerVertrag = zahlungenData?.filter(z => z.mietvertrag_id === mietvertragId && z.kategorie === 'Miete') || [];
    
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

    // Filtere aktive und gekündigte Mietverträge
    const aktiveMietvertraege = mietvertraegeData.filter(vertrag => 
      vertrag.status === 'aktiv' || vertrag.status === 'gekuendigt'
    );

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

  // Prüfe ob Kaution-Spalten angezeigt werden sollen - zeige immer an für bessere UX
  const shouldShowKaution = useMemo(() => {
    // Immer anzeigen damit Benutzer Kautionen hinzufügen können
    return true;
  }, [organizedData, zahlungenData]);

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
          <div className="space-y-6 p-4">
            {organizedData.map((propertyGroup, index) => (
              <div key={propertyGroup.immobilie.id || index} className="border rounded-lg bg-white">
                {/* Property Header - Sticky */}
                <div className="bg-gray-50 p-3 border-b sticky top-0 z-20 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{propertyGroup.immobilie.name}</h3>
                      <p className="text-xs text-gray-600">{propertyGroup.immobilie.adresse}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {propertyGroup.vertraege.length} Verträge
                    </Badge>
                  </div>
                </div>

                {/* Table with Sticky Headers */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="sticky top-[73px] z-10 bg-white shadow-sm border-b-2">
                      <TableHead className="text-center text-xs w-12 border-r">
                        Einheit
                      </TableHead>
                      <TableHead className="text-center text-xs w-16 border-r">
                        Etage
                      </TableHead>
                      <TableHead className="text-center text-xs w-16 border-r">
                        qm
                      </TableHead>
                      <TableHead className="text-center text-xs w-20 border-r">
                        Nutzung
                      </TableHead>
                      <TableHead className="text-center text-xs w-32 border-r">
                        <button onClick={() => handleSort('mieter')} className="flex items-center gap-1 w-full justify-center">
                          Mieter
                          <SortIcon field="mieter" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center text-xs w-20 border-r">
                        <button onClick={() => handleSort('kaltmiete')} className="flex items-center gap-1 w-full justify-center">
                          Kaltmiete
                          <SortIcon field="kaltmiete" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center text-xs w-20 border-r">
                        <button onClick={() => handleSort('betriebskosten')} className="flex items-center gap-1 w-full justify-center">
                          BK
                          <SortIcon field="betriebskosten" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center text-xs w-16 border-r">
                        Status
                      </TableHead>
                      <TableHead className="text-center text-xs w-24 border-r">
                        Mietbeginn
                      </TableHead>
                      <TableHead className="text-center text-xs w-24 border-r">
                        Mietende
                      </TableHead>
                      <TableHead className="text-center text-xs w-20 border-r">
                        Kaution (S/I)
                      </TableHead>
                      <TableHead className="text-center text-xs w-24 border-r">
                        nächste mögl. Erhöh.
                      </TableHead>
                      <TableHead className="text-center text-xs w-20 border-r">
                        letzte Erhöhung
                      </TableHead>
                      <TableHead className="text-center text-xs w-24 border-r">
                        Zahlung aktueller Monat
                      </TableHead>
                      <TableHead className="text-center text-xs w-20">
                        Zahlungen gesamt
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyGroup.vertraege.map((vertrag) => {
                      const zahlungen = getZahlungenFuerVertrag(vertrag.id);
                      const mieterName = getMieterNamen(vertrag.id);

                      return (
                        <TableRow key={vertrag.id} className="hover:bg-gray-50">
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
                                {vertrag.einheiten?.qm || '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Nutzung */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'nutzung') ? (
                              <Select 
                                value={getEditingValue(vertrag.id, 'nutzung') || ''} 
                                onValueChange={(value) => updateEditingValue(vertrag.id, 'nutzung', value)}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Wohnung">Wohnung</SelectItem>
                                  <SelectItem value="Büro">Büro</SelectItem>
                                  <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                                  <SelectItem value="Lager">Lager</SelectItem>
                                  <SelectItem value="Praxis">Praxis</SelectItem>
                                  <SelectItem value="Stellplatz">Stellplatz</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'nutzung', vertrag.einheiten?.einheitentyp)}
                              >
                                {vertrag.einheiten?.einheitentyp || '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Mieter */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'mieter') ? (
                              <Input
                                type="text"
                                value={getEditingValue(vertrag.id, 'mieter') || ''}
                                onChange={(e) => updateEditingValue(vertrag.id, 'mieter', e.target.value)}
                                className="h-6 text-xs text-center"
                                onBlur={() => cancelEdit(vertrag.id, 'mieter')}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-gray-100 p-1 rounded ${isEditing ? 'border border-dashed border-gray-300' : ''}`}
                                onClick={() => isEditing && startEditing(vertrag.id, 'mieter', mieterName)}
                              >
                                {mieterName || 'Kein Mieter'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Kaltmiete */}
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
                                {vertrag.kaltmiete ? `${vertrag.kaltmiete.toLocaleString('de-DE')} €` : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Betriebskosten */}
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
                                {vertrag.betriebskosten ? `${vertrag.betriebskosten.toLocaleString('de-DE')} €` : '-'}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Status */}
                          <TableCell className="text-center text-xs border-r">
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
                {vertrag.status === 'gekuendigt' && vertrag.kuendigungsdatum 
                  ? new Date(vertrag.kuendigungsdatum).toLocaleDateString('de-DE')
                  : vertrag.ende_datum 
                    ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE')
                    : 'unbefristet'
                }
              </div>
            )}
          </TableCell>
                          
                          {/* Kaution SOLL */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'kautionSoll') ? (
                              <Input
                                type="number"
                                value={getEditingValue(vertrag.id, 'kautionSoll') || ''}
                                onChange={(e) => {
                                  const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  updateEditingValue(vertrag.id, 'kautionSoll', newValue);
                                }}
                                className="h-8 text-xs text-center w-full"
                                onBlur={() => cancelEdit(vertrag.id, 'kautionSoll')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    cancelEdit(vertrag.id, 'kautionSoll');
                                  }
                                  if (e.key === 'Escape') {
                                    cancelEdit(vertrag.id, 'kautionSoll');
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-blue-50 p-2 rounded-lg text-xs transition-all ${isEditing ? 'border-2 border-dashed border-blue-300 bg-blue-50' : 'border border-gray-200 hover:border-blue-300'}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('Kaution SOLL clicked');
                                  if (!isEditing) {
                                    setIsEditing(true);
                                  }
                                  startEditing(vertrag.id, 'kautionSoll', getKautionSoll(vertrag));
                                }}
                                title="SOLL-Kaution aus Vertrag - Klicken zum Bearbeiten"
                              >
                                <div className="text-center">
                                  <div className="text-blue-600 font-bold text-sm">
                                    {getKautionSoll(vertrag) ? `${getKautionSoll(vertrag).toLocaleString()} €` : '0 €'}
                                  </div>
                                  <div className="text-xs text-gray-500">SOLL</div>
                                </div>
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Kaution IST */}
                          <TableCell className="text-center text-xs border-r p-1">
                            {isFieldEditing(vertrag.id, 'kautionIst') ? (
                              <Input
                                type="number"
                                value={getEditingValue(vertrag.id, 'kautionIst') || ''}
                                onChange={(e) => {
                                  const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  updateEditingValue(vertrag.id, 'kautionIst', newValue);
                                }}
                                className="h-8 text-xs text-center w-full"
                                onBlur={() => cancelEdit(vertrag.id, 'kautionIst')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    cancelEdit(vertrag.id, 'kautionIst');
                                  }
                                  if (e.key === 'Escape') {
                                    cancelEdit(vertrag.id, 'kautionIst');
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <div 
                                className={`cursor-pointer hover:bg-green-50 p-2 rounded-lg text-xs transition-all ${isEditing ? 'border-2 border-dashed border-green-300 bg-green-50' : 'border border-gray-200 hover:border-green-300'}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('Kaution IST clicked');
                                  if (!isEditing) {
                                    setIsEditing(true);
                                  }
                                  startEditing(vertrag.id, 'kautionIst', getKautionIst(vertrag));
                                }}
                                title="IST-Kaution aus Zahlungen - Klicken zum Bearbeiten"
                              >
                                <div className="text-center">
                                  <div className="text-green-600 font-bold text-sm">
                                    {getKautionIst(vertrag) ? `${getKautionIst(vertrag).toLocaleString()} €` : '0 €'}
                                  </div>
                                  <div className="text-xs text-gray-500">IST</div>
                                </div>
                              </div>
                            )}
                          </TableCell>
                          
                          {/* nächste mögl. Erhöh. */}
                          <TableCell className="text-center text-xs border-r">
                            {(() => {
                              // Keine Mieterhöhung für gekündigte oder beendete Verträge
                              if (vertrag.status === 'gekuendigt' || vertrag.status === 'beendet') {
                                return '-';
                              }
                              
                              const startDatum = vertrag.start_datum ? new Date(vertrag.start_datum) : null;
                              const letzteMieterhoehung = vertrag.letzte_mieterhoehung_am ? new Date(vertrag.letzte_mieterhoehung_am) : null;
                              
                              // Verwende das spätere der beiden Daten als Basis
                              const basisDatum = letzteMieterhoehung && startDatum 
                                ? (letzteMieterhoehung > startDatum ? letzteMieterhoehung : startDatum)
                                : (letzteMieterhoehung || startDatum);
                              
                              if (!basisDatum) return '-';
                              
                              // 15 Monate zum Basisdatum addieren
                              const naechsteMoeglicheErhoehung = new Date(basisDatum);
                              naechsteMoeglicheErhoehung.setMonth(naechsteMoeglicheErhoehung.getMonth() + 15);
                              
                              return naechsteMoeglicheErhoehung.toLocaleDateString('de-DE');
                            })()}
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
                          <TableCell className="text-center text-xs border-r">
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
                    })}
                  </TableBody>
                </Table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
