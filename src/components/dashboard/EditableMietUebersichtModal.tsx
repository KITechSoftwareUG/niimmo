import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Save, X, Edit, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface EditableMietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditingCell {
  vertragId: string;
  field: string;
  value: any;
  originalValue: any;
}

interface TableRow {
  vertrag: any;
  einheit: any;
  immobilie: any;
  mieter: any[];
  zahlungen: {
    aktuellerMonat: number;
    gesamt: number;
    anzahlZahlungen: number;
  };
}

interface FieldConfig {
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'boolean';
  table: 'mietvertrag' | 'einheiten' | 'immobilien' | 'mieter';
  options?: string[];
}

const EDITABLE_FIELDS: Record<string, FieldConfig> = {
  // Immobilie fields
  'immobilie.name': { label: 'Objektname', type: 'text', table: 'immobilien' },
  'immobilie.adresse': { label: 'Adresse', type: 'text', table: 'immobilien' },
  
  // Einheit fields  
  'einheit.etage': { label: 'Etage', type: 'text', table: 'einheiten' },
  'einheit.qm': { label: 'qm', type: 'number', table: 'einheiten' },
  'einheit.einheitentyp': { label: 'Nutzung', type: 'select', table: 'einheiten', options: ['Wohnung', 'Gewerbe', 'Garage', 'Keller', 'Dachboden'] },
  'einheit.zaehler': { label: 'Zähler', type: 'number', table: 'einheiten' },

  // Mietvertrag fields
  'vertrag.kaltmiete': { label: 'Kaltmiete', type: 'number', table: 'mietvertrag' },
  'vertrag.betriebskosten': { label: 'Betriebskosten', type: 'number', table: 'mietvertrag' },
  'vertrag.status': { label: 'Status', type: 'select', table: 'mietvertrag', options: ['aktiv', 'inaktiv', 'gekündigt'] },
  'vertrag.start_datum': { label: 'Mietbeginn', type: 'date', table: 'mietvertrag' },
  'vertrag.ende_datum': { label: 'Mietende', type: 'date', table: 'mietvertrag' },
  'vertrag.kaution_betrag': { label: 'Kaution Soll', type: 'number', table: 'mietvertrag' },
  'vertrag.kaution_ist': { label: 'Kaution Ist', type: 'number', table: 'mietvertrag' },
  'vertrag.kaution_gezahlt_am': { label: 'Kaution gezahlt am', type: 'date', table: 'mietvertrag' },
  'vertrag.letzte_mieterhoehung_am': { label: 'Letzte Erhöhung', type: 'date', table: 'mietvertrag' },
  'vertrag.mahnstufe': { label: 'Mahnstufe', type: 'number', table: 'mietvertrag' },
  'vertrag.lastschrift': { label: 'Lastschrift', type: 'boolean', table: 'mietvertrag' },
  'vertrag.bankkonto_mieter': { label: 'Bankkonto', type: 'text', table: 'mietvertrag' },
  
  // Mieter fields
  'mieter.vorname': { label: 'Vorname', type: 'text', table: 'mieter' },
  'mieter.nachname': { label: 'Nachname', type: 'text', table: 'mieter' },
  'mieter.hauptmail': { label: 'E-Mail', type: 'email', table: 'mieter' },
  'mieter.telnr': { label: 'Telefon', type: 'tel', table: 'mieter' },
  'mieter.geburtsdatum': { label: 'Geburtsdatum', type: 'date', table: 'mieter' },
};

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  const [editingCells, setEditingCells] = useState<EditingCell[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all data with relations
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['editable-miet-uebersicht'],
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

  const { data: zahlungenData } = useQuery({
    queryKey: ['zahlungen-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Helper function to get payments for a contract - MOVED BEFORE processedData
  const getZahlungenFuerVertrag = useCallback((vertragId: string) => {
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
  }, [zahlungenData]);

  // Process data into table rows
  const processedData: TableRow[] = useMemo(() => {
    if (!tableData) return [];

    return tableData.map(vertrag => {
      const zahlungen = getZahlungenFuerVertrag(vertrag.id);
      
      return {
        vertrag,
        einheit: vertrag.einheiten,
        immobilie: vertrag.einheiten?.immobilien,
        mieter: vertrag.mietvertrag_mieter?.map((mm: any) => mm.mieter) || [],
        zahlungen
      };
    });
  }, [tableData, getZahlungenFuerVertrag]);

  // Editing functions
  const startEditing = useCallback((vertragId: string, field: string, currentValue: any) => {
    if (!isEditing) setIsEditing(true);
    
    const existingIndex = editingCells.findIndex(
      cell => cell.vertragId === vertragId && cell.field === field
    );
    
    if (existingIndex >= 0) return;
    
    setEditingCells(prev => [
      ...prev,
      { vertragId, field, value: currentValue, originalValue: currentValue }
    ]);
  }, [isEditing, editingCells]);

  const updateEditingValue = useCallback((vertragId: string, field: string, value: any) => {
    setEditingCells(prev =>
      prev.map(cell =>
        cell.vertragId === vertragId && cell.field === field
          ? { ...cell, value }
          : cell
      )
    );
  }, []);

  const cancelEdit = useCallback((vertragId: string, field: string) => {
    setEditingCells(prev =>
      prev.filter(cell => !(cell.vertragId === vertragId && cell.field === field))
    );
    
    if (editingCells.length === 1) {
      setIsEditing(false);
    }
  }, [editingCells.length]);

  const cancelAllEdits = useCallback(() => {
    setEditingCells([]);
    setIsEditing(false);
  }, []);

  const getEditingValue = useCallback((vertragId: string, field: string) => {
    const cell = editingCells.find(c => c.vertragId === vertragId && c.field === field);
    return cell ? cell.value : null;
  }, [editingCells]);

  const isFieldEditing = useCallback((vertragId: string, field: string) => {
    return editingCells.some(cell => cell.vertragId === vertragId && cell.field === field);
  }, [editingCells]);

  // Save all changes
  const saveAllChanges = async () => {
    try {
      const updatesByTable = {
        mietvertrag: new Map(),
        einheiten: new Map(),
        immobilien: new Map(),
        mieter: new Map()
      };

      // Group updates by table and record ID
      editingCells.forEach(cell => {
        const fieldConfig = EDITABLE_FIELDS[cell.field];
        if (!fieldConfig) return;

        const table = fieldConfig.table;
        let recordId: string | undefined;
        let dbField: string;

        // Determine record ID and database field name
        if (cell.field.startsWith('vertrag.')) {
          recordId = cell.vertragId;
          dbField = cell.field.replace('vertrag.', '');
        } else if (cell.field.startsWith('einheit.')) {
          const row = processedData.find(r => r.vertrag.id === cell.vertragId);
          recordId = row?.einheit?.id;
          dbField = cell.field.replace('einheit.', '');
        } else if (cell.field.startsWith('immobilie.')) {
          const row = processedData.find(r => r.vertrag.id === cell.vertragId);
          recordId = row?.immobilie?.id;
          dbField = cell.field.replace('immobilie.', '');
        } else if (cell.field.startsWith('mieter.')) {
          const row = processedData.find(r => r.vertrag.id === cell.vertragId);
          recordId = row?.mieter?.[0]?.id; // First mieter for simplicity
          dbField = cell.field.replace('mieter.', '');
        }

        if (!recordId) return;

        if (!updatesByTable[table as keyof typeof updatesByTable].has(recordId)) {
          updatesByTable[table as keyof typeof updatesByTable].set(recordId, {});
        }

        // Convert value based on field type
        let processedValue = cell.value;
        if (fieldConfig.type === 'number') {
          processedValue = parseFloat(cell.value) || null;
        } else if (fieldConfig.type === 'boolean') {
          processedValue = Boolean(cell.value);
        }

        updatesByTable[table as keyof typeof updatesByTable].get(recordId)[dbField] = processedValue;
      });

      // Execute updates for each table
      for (const [tableName, updates] of Object.entries(updatesByTable)) {
        for (const [recordId, updateData] of updates) {
          if (Object.keys(updateData).length === 0) continue;

          const { error } = await supabase
            .from(tableName as any)
            .update(updateData)
            .eq('id', recordId);

          if (error) throw error;
        }
      }

      // Clear editing state
      setEditingCells([]);
      setIsEditing(false);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['editable-miet-uebersicht'] });
      queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });

      toast({
        title: "Änderungen gespeichert",
        description: `${editingCells.length} Änderungen wurden erfolgreich gespeichert.`,
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

  // Render editable cell
  const renderEditableCell = (row: TableRow, field: string, value: any, className: string = "") => {
    const fieldConfig = EDITABLE_FIELDS[field];
    if (!fieldConfig) {
      return <TableCell className={className}>{value || '-'}</TableCell>;
    }

    const vertragId = row.vertrag.id;
    const isActive = isFieldEditing(vertragId, field);
    const editValue = isActive ? getEditingValue(vertragId, field) : value;

    if (isActive) {
      if (fieldConfig.type === 'select' && fieldConfig.options) {
        return (
          <TableCell className={className}>
            <Select 
              value={editValue || ''} 
              onValueChange={(val) => updateEditingValue(vertragId, field, val)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldConfig.options.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
        );
      }

      if (fieldConfig.type === 'boolean') {
        return (
          <TableCell className={className}>
            <Select 
              value={editValue ? 'true' : 'false'} 
              onValueChange={(val) => updateEditingValue(vertragId, field, val === 'true')}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Ja</SelectItem>
                <SelectItem value="false">Nein</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
        );
      }

      return (
        <TableCell className={className}>
          <Input
            type={fieldConfig.type === 'number' ? 'number' : fieldConfig.type === 'date' ? 'date' : 'text'}
            step={fieldConfig.type === 'number' ? '0.01' : undefined}
            value={editValue || ''}
            onChange={(e) => updateEditingValue(vertragId, field, e.target.value)}
            className="h-7 text-xs"
            onBlur={() => cancelEdit(vertragId, field)}
            autoFocus
          />
        </TableCell>
      );
    }

    // Display mode
    let displayValue = value;
    if (fieldConfig.type === 'number' && value) {
      displayValue = `${Number(value).toLocaleString('de-DE')} €`;
    } else if (fieldConfig.type === 'date' && value) {
      displayValue = new Date(value).toLocaleDateString('de-DE');
    } else if (fieldConfig.type === 'boolean') {
      displayValue = value ? 'Ja' : 'Nein';
    }

    return (
      <TableCell 
        className={`${className} ${isEditing ? 'cursor-pointer hover:bg-gray-100 border border-dashed border-transparent hover:border-gray-300' : ''}`}
        onClick={() => isEditing && startEditing(vertragId, field, value)}
      >
        <div className="min-h-[20px]">
          {displayValue || '-'}
        </div>
      </TableCell>
    );
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh]">
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
      <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Editierbare Mietübersicht ({processedData.length} Verträge)
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
                  <Badge variant="secondary" className="px-2 py-1">
                    {editingCells.length} Änderungen
                  </Badge>
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
                    Speichern ({editingCells.length})
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
                  Bearbeiten aktivieren
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="h-[calc(95vh-120px)] border rounded-lg bg-white flex flex-col">
            {/* Fixed Header */}
            <div className="flex-shrink-0 border-b-2 border-gray-300 bg-white">
              <Table>
                <TableHeader className="bg-white shadow-lg border-b-2 border-gray-300">
                <TableRow className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-200">
                  <TableHead className="text-xs font-semibold text-center w-32 bg-gradient-to-r from-gray-100 to-gray-50 sticky left-0 z-20 border-r-2 border-gray-300 shadow-lg">Objekt</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 border-r bg-gradient-to-r from-gray-100 to-gray-50">Einheit Details</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-16 border-r bg-gradient-to-r from-gray-100 to-gray-50">ID</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-16 border-r bg-gradient-to-r from-gray-100 to-gray-50">Etage</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-16 border-r bg-gradient-to-r from-gray-100 to-gray-50">qm</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20 border-r bg-gradient-to-r from-gray-100 to-gray-50">Nutzung</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-16 border-r bg-gradient-to-r from-gray-100 to-gray-50">Zähler</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-32 border-r bg-gradient-to-r from-gray-100 to-gray-50">Mieter</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20 border-r bg-gradient-to-r from-gray-100 to-gray-50">Kaltmiete</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20 border-r bg-gradient-to-r from-gray-100 to-gray-50">BK</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-16 border-r bg-gradient-to-r from-gray-100 to-gray-50">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 border-r bg-gradient-to-r from-gray-100 to-gray-50">Mietbeginn</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 border-r bg-gradient-to-r from-gray-100 to-gray-50">Mietende</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20 border-r bg-gradient-to-r from-gray-100 to-gray-50">Kaution Soll</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20 border-r bg-gradient-to-r from-gray-100 to-gray-50">Kaution Ist</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 border-r bg-gradient-to-r from-gray-100 to-gray-50">Letzte Erhöhung</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-16 border-r bg-gradient-to-r from-gray-100 to-gray-50">Mahnstufe</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20 border-r bg-gradient-to-r from-gray-100 to-gray-50">Lastschrift</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-32 border-r bg-gradient-to-r from-gray-100 to-gray-50">E-Mail</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 border-r bg-gradient-to-r from-gray-100 to-gray-50">Telefon</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 border-r bg-gradient-to-r from-gray-100 to-gray-50">Zahlung aktuell</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-24 bg-gradient-to-r from-gray-100 to-gray-50">Zahlungen gesamt</TableHead>
                 </TableRow>
               </TableHeader>
              </Table>
            </div>
            
            {/* Scrollable Body */}
            <div className="flex-1 overflow-auto">
              <Table>
                <TableBody>
                  {processedData.map((row, index) => (
                    <TableRow key={row.vertrag.id} className="hover:bg-gray-50/50 border-b border-gray-200">
                      {/* Objekt - Sticky left column */}
                      <TableCell className="text-xs border-r-2 border-gray-300 sticky left-0 z-10 bg-white shadow-lg min-w-32">
                        <div className="font-medium">
                          {renderEditableCell(row, 'immobilie.name', row.immobilie?.name, 'p-0 border-0').props.children}
                          <div className="text-gray-600 text-xs mt-1">
                            {row.immobilie?.adresse}
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Einheit Details */}
                      <TableCell className="text-xs text-center border-r">
                        <div className="space-y-1">
                          <div className="font-medium text-primary">
                            Einheit #{row.einheit?.id?.toString()?.slice(-2) || '-'}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {row.einheit?.einheitentyp || 'Unbekannt'}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {row.einheit?.qm ? `${row.einheit.qm} qm` : '-'}
                            {row.einheit?.etage && ` • ${row.einheit.etage}. OG`}
                          </div>
                        </div>
                      </TableCell>
                      
                      {/* Einheit ID */}
                      <TableCell className="text-xs text-center border-r">
                        {row.einheit?.id?.toString()?.slice(-2) || '-'}
                      </TableCell>
                      
                      {/* Etage */}
                      {renderEditableCell(row, 'einheit.etage', row.einheit?.etage, 'text-xs text-center border-r')}
                      
                      {/* qm */}
                      {renderEditableCell(row, 'einheit.qm', row.einheit?.qm, 'text-xs text-center border-r')}
                      
                      {/* Nutzung */}
                      {renderEditableCell(row, 'einheit.einheitentyp', row.einheit?.einheitentyp, 'text-xs text-center border-r')}
                      
                      {/* Zähler */}
                      {renderEditableCell(row, 'einheit.zaehler', row.einheit?.zaehler, 'text-xs text-center border-r')}
                      
                      {/* Mieter */}
                      <TableCell className="text-xs text-center border-r">
                        <div className="space-y-1">
                          {row.mieter.map((mieter, idx) => (
                            <div key={mieter.id} className="text-xs">
                              {mieter.vorname} {mieter.nachname}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      
                      {/* Kaltmiete */}
                      {renderEditableCell(row, 'vertrag.kaltmiete', row.vertrag.kaltmiete, 'text-xs text-center border-r')}
                      
                      {/* Betriebskosten */}
                      {renderEditableCell(row, 'vertrag.betriebskosten', row.vertrag.betriebskosten, 'text-xs text-center border-r')}
                      
                      {/* Status */}
                      {renderEditableCell(row, 'vertrag.status', row.vertrag.status, 'text-xs text-center border-r')}
                      
                      {/* Mietbeginn */}
                      {renderEditableCell(row, 'vertrag.start_datum', row.vertrag.start_datum, 'text-xs text-center border-r')}
                      
                      {/* Mietende */}
                      {renderEditableCell(row, 'vertrag.ende_datum', row.vertrag.ende_datum, 'text-xs text-center border-r')}
                      
                      {/* Kaution Soll */}
                      {renderEditableCell(row, 'vertrag.kaution_betrag', row.vertrag.kaution_betrag, 'text-xs text-center border-r')}
                      
                      {/* Kaution Ist */}
                      {renderEditableCell(row, 'vertrag.kaution_ist', row.vertrag.kaution_ist, 'text-xs text-center border-r')}
                      
                      {/* Letzte Erhöhung */}
                      {renderEditableCell(row, 'vertrag.letzte_mieterhoehung_am', row.vertrag.letzte_mieterhoehung_am, 'text-xs text-center border-r')}
                      
                      {/* Mahnstufe */}
                      {renderEditableCell(row, 'vertrag.mahnstufe', row.vertrag.mahnstufe, 'text-xs text-center border-r')}
                      
                      {/* Lastschrift */}
                      {renderEditableCell(row, 'vertrag.lastschrift', row.vertrag.lastschrift, 'text-xs text-center border-r')}
                      
                      {/* E-Mail */}
                      <TableCell className="text-xs text-center border-r">
                        {row.mieter.map(mieter => mieter.hauptmail).filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      
                      {/* Telefon */}
                      <TableCell className="text-xs text-center border-r">
                        {row.mieter.map(mieter => mieter.telnr).filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      
                      {/* Zahlung aktueller Monat */}
                      <TableCell className="text-xs text-center border-r">
                        {row.zahlungen.aktuellerMonat > 0 
                          ? `${row.zahlungen.aktuellerMonat.toLocaleString('de-DE')} €`
                          : '-'
                        }
                      </TableCell>
                      
                      {/* Zahlungen gesamt */}
                      <TableCell className="text-xs text-center">
                        <div>
                          {row.zahlungen.gesamt > 0 
                            ? `${row.zahlungen.gesamt.toLocaleString('de-DE')} €`
                            : '-'
                          }
                          {row.zahlungen.anzahlZahlungen > 0 && (
                            <div className="text-gray-500 text-xs">
                              ({row.zahlungen.anzahlZahlungen}×)
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
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