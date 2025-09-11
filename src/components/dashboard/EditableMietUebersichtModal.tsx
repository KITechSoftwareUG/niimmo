import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Save, X, Edit3, Check, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Settings, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useCallback, useEffect } from "react";
import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

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
  category: 'property' | 'unit' | 'contract' | 'tenant' | 'payment';
  required?: boolean;
  format?: (value: any) => string;
}

const EDITABLE_FIELDS: Record<string, FieldConfig> = {
  // Immobilie fields
  'immobilie.name': { label: 'Objektname', type: 'text', table: 'immobilien', category: 'property', required: true },
  'immobilie.adresse': { label: 'Adresse', type: 'text', table: 'immobilien', category: 'property' },
  
  // Einheit fields  
  'einheit.etage': { label: 'Etage', type: 'text', table: 'einheiten', category: 'unit' },
  'einheit.qm': { label: 'Quadratmeter', type: 'number', table: 'einheiten', category: 'unit', format: (val) => `${val} m²` },
  'einheit.einheitentyp': { label: 'Nutzung', type: 'select', table: 'einheiten', category: 'unit', options: ['Wohnung', 'Gewerbe', 'Garage', 'Keller', 'Dachboden'] },
  
  // Mietvertrag fields
  'vertrag.kaltmiete': { label: 'Kaltmiete', type: 'number', table: 'mietvertrag', category: 'contract', format: (val) => `€${Number(val).toLocaleString('de-DE')}` },
  'vertrag.betriebskosten': { label: 'Betriebskosten', type: 'number', table: 'mietvertrag', category: 'contract', format: (val) => `€${Number(val).toLocaleString('de-DE')}` },
  'vertrag.status': { label: 'Status', type: 'select', table: 'mietvertrag', category: 'contract', options: ['aktiv', 'inaktiv', 'gekündigt'] },
  'vertrag.start_datum': { label: 'Mietbeginn', type: 'date', table: 'mietvertrag', category: 'contract', format: (val) => formatDateForDisplay(val) },
  'vertrag.ende_datum': { label: 'Mietende', type: 'date', table: 'mietvertrag', category: 'contract', format: (val) => formatDateForDisplay(val) },
  'vertrag.kaution_betrag': { label: 'Kaution Soll', type: 'number', table: 'mietvertrag', category: 'contract', format: (val) => `€${Number(val).toLocaleString('de-DE')}` },
  'vertrag.kaution_ist': { label: 'Kaution Ist', type: 'number', table: 'mietvertrag', category: 'contract', format: (val) => `€${Number(val).toLocaleString('de-DE')}` },
  'vertrag.lastschrift': { label: 'Lastschrift', type: 'boolean', table: 'mietvertrag', category: 'contract', format: (val) => val ? 'Ja' : 'Nein' },
  
  // Mieter fields
  'mieter.vorname': { label: 'Vorname', type: 'text', table: 'mieter', category: 'tenant', required: true },
  'mieter.nachname': { label: 'Nachname', type: 'text', table: 'mieter', category: 'tenant', required: true },
  'mieter.hauptmail': { label: 'E-Mail', type: 'email', table: 'mieter', category: 'tenant' },
  'mieter.telnr': { label: 'Telefon', type: 'tel', table: 'mieter', category: 'tenant' },
};

interface ColumnConfig {
  field: string;
  label: string;
  width?: string;
  sticky?: boolean;
  visible: boolean;
  sortable?: boolean;
  groupable?: boolean;
}

// Date utility functions
const formatDateForInput = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
};

const formatDateForDisplay = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'dd.MM.yyyy', { locale: de });
};

const parseDateFromInput = (dateString: string): string | null => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { field: 'immobilie.name', label: 'Objekt', width: 'w-40', sticky: true, visible: true, sortable: true, groupable: true },
  { field: 'einheit.einheitIndex', label: 'Einheit', width: 'w-24', visible: true, sortable: true, groupable: false },
  { field: 'einheit.etage', label: 'Einheit', width: 'w-20', visible: true, sortable: false },
  { field: 'mieter.name', label: 'Mieter', width: 'w-48', visible: true, sortable: true, groupable: false },
  { field: 'vertrag.status', label: 'Status', width: 'w-24', visible: true, sortable: true, groupable: true },
  { field: 'vertrag.kaltmiete', label: 'Kaltmiete', width: 'w-28', visible: true, sortable: true, groupable: false },
  { field: 'vertrag.betriebskosten', label: 'NK', width: 'w-24', visible: true, sortable: true, groupable: false },
  { field: 'zahlungen.aktuellerMonat', label: 'Aktuelle Miete', width: 'w-32', visible: true, sortable: false },
  { field: 'vertrag.start_datum', label: 'Mietbeginn', width: 'w-28', visible: true, sortable: true, groupable: false },
  { field: 'einheit.qm', label: 'qm', width: 'w-20', visible: false, sortable: true, groupable: false },
  { field: 'vertrag.kaution_betrag', label: 'Kaution Soll', width: 'w-28', visible: false, sortable: false },
  { field: 'vertrag.kaution_ist', label: 'Kaution Ist', width: 'w-28', visible: false, sortable: false },
  { field: 'vertrag.lastschrift', label: 'Lastschrift', width: 'w-24', visible: false, sortable: false },
  { field: 'mieter.hauptmail', label: 'E-Mail', width: 'w-48', visible: false, sortable: false },
  { field: 'mieter.telnr', label: 'Telefon', width: 'w-32', visible: false, sortable: false },
];

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  const [editingCells, setEditingCells] = useState<EditingCell[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('einheit.einheitIndex');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string>('immobilie.name');
  const [showGrouping, setShowGrouping] = useState<boolean>(true);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all data with relations - only active and terminated contracts
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
        .in('status', ['aktiv', 'gekuendigt'])
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

  // Helper function to get payments for a contract
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

  // Process and filter data
  const processedData: TableRow[] = useMemo(() => {
    if (!tableData) return [];

    // First, group by immobilie to assign sequential einheit indices
    const immobilieGroups: Record<string, any[]> = {};
    tableData.forEach(vertrag => {
      const immobilieId = vertrag.einheiten?.immobilie_id;
      if (immobilieId) {
        if (!immobilieGroups[immobilieId]) {
          immobilieGroups[immobilieId] = [];
        }
        immobilieGroups[immobilieId].push(vertrag);
      }
    });

    // Sort units within each immobilie by unit number with fallbacks
    Object.keys(immobilieGroups).forEach(immobilieId => {
      immobilieGroups[immobilieId].sort((a, b) => {
        const extractNum = (val?: string | number) => {
          if (val == null) return null;
          const s = val.toString();
          const match = s.match(/\d+/g);
          if (match && match.length) {
            return parseInt(match.join(''), 10);
          }
          return null;
        };

        const aNum = extractNum(a.einheiten?.nummer);
        const bNum = extractNum(b.einheiten?.nummer);

        if (aNum != null && bNum != null && aNum !== bNum) {
          return aNum - bNum;
        }
        if (aNum != null && bNum == null) return -1;
        if (aNum == null && bNum != null) return 1;

        // Fallback: creation date
        const aCreated = a.einheiten?.erstellt_am ? new Date(a.einheiten.erstellt_am).getTime() : 0;
        const bCreated = b.einheiten?.erstellt_am ? new Date(b.einheiten.erstellt_am).getTime() : 0;
        if (aCreated !== bCreated) return aCreated - bCreated;

        // Last fallback: ID
        return (a.einheiten?.id || '').localeCompare(b.einheiten?.id || '');
      });
    });

    // Create processed data with einheit indices
    let filtered = tableData.map(vertrag => {
      const immobilieId = vertrag.einheiten?.immobilie_id;
      const fullIndex = immobilieId 
        ? immobilieGroups[immobilieId].findIndex(v => v.id === vertrag.id) + 1
        : 1;
      
      // Remove last two digits from the index
      const einheitIndex = fullIndex < 100 ? '' : Math.floor(fullIndex / 100).toString();

      const zahlungen = getZahlungenFuerVertrag(vertrag.id);
      
      return {
        vertrag,
        einheit: {
          ...vertrag.einheiten,
          einheitIndex
        },
        immobilie: vertrag.einheiten?.immobilien,
        mieter: vertrag.mietvertrag_mieter?.map((mm: any) => mm.mieter) || [],
        zahlungen
      };
    });

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(row => row.vertrag.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(row => {
        const searchableText = [
          row.immobilie?.name,
          row.immobilie?.adresse,
          row.einheit?.etage,
          ...row.mieter.map(m => `${m.vorname} ${m.nachname}`),
          row.vertrag.status
        ].join(' ').toLowerCase();
        
        return searchableText.includes(query);
      });
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let valueA: any, valueB: any;
        
        if (sortField === 'mieter.name') {
          valueA = a.mieter[0] ? `${a.mieter[0].nachname} ${a.mieter[0].vorname}` : '';
          valueB = b.mieter[0] ? `${b.mieter[0].nachname} ${b.mieter[0].vorname}` : '';
        } else if (sortField === 'zahlungen.aktuellerMonat') {
          valueA = a.zahlungen.aktuellerMonat;
          valueB = b.zahlungen.aktuellerMonat;
        } else if (sortField === 'einheit.einheitIndex') {
          // Primary sort by immobilie name, then by einheit index
          const immobilieA = a.immobilie?.name || '';
          const immobilieB = b.immobilie?.name || '';
          const immobilieCompare = immobilieA.localeCompare(immobilieB, 'de-DE');
          
          if (immobilieCompare !== 0) {
            return sortDirection === 'asc' ? immobilieCompare : -immobilieCompare;
          }
          
          valueA = a.einheit?.einheitIndex || 0;
          valueB = b.einheit?.einheitIndex || 0;
        } else {
          const fieldParts = sortField.split('.');
          valueA = fieldParts.reduce((obj, key) => obj?.[key], a);
          valueB = fieldParts.reduce((obj, key) => obj?.[key], b);
        }

        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return sortDirection === 'asc' 
            ? valueA.localeCompare(valueB, 'de-DE', { numeric: true })
            : valueB.localeCompare(valueA, 'de-DE', { numeric: true });
        }
        
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        }

        return 0;
      });
    }

    return filtered;
  }, [tableData, getZahlungenFuerVertrag, searchQuery, sortField, sortDirection, statusFilter]);

  // Group data if grouping is enabled
  const groupedData = useMemo(() => {
    if (!showGrouping || !groupBy) return { ungrouped: processedData };
    
    const groups: Record<string, TableRow[]> = {};
    
    processedData.forEach(row => {
      let groupValue: string;
      
      if (groupBy === 'mieter.name') {
        groupValue = row.mieter[0] ? `${row.mieter[0].nachname} ${row.mieter[0].vorname}` : 'Ohne Mieter';
      } else if (groupBy === 'immobilie.name') {
        groupValue = row.immobilie?.name || 'Ohne Objekt';
      } else if (groupBy === 'vertrag.status') {
        groupValue = row.vertrag.status || 'Ohne Status';
      } else {
        const fieldParts = groupBy.split('.');
        groupValue = fieldParts.reduce((obj, key) => obj?.[key], row) || 'Nicht definiert';
      }
      
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(row);
    });
    
    // Sort groups by group name
    const sortedGroups: Record<string, TableRow[]> = {};
    Object.keys(groups).sort((a, b) => a.localeCompare(b, 'de-DE', { numeric: true })).forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  }, [processedData, showGrouping, groupBy]);

  // Editing functions
  const startEditing = useCallback((vertragId: string, field: string, currentValue: any) => {
    const existingIndex = editingCells.findIndex(
      cell => cell.vertragId === vertragId && cell.field === field
    );
    
    if (existingIndex >= 0) return;
    
    const fieldConfig = EDITABLE_FIELDS[field];
    let editValue = currentValue;
    
    // Format value for editing based on field type
    if (fieldConfig?.type === 'date' && currentValue) {
      editValue = formatDateForInput(currentValue);
    }
    
    setEditingCells(prev => [
      ...prev,
      { vertragId, field, value: editValue, originalValue: currentValue }
    ]);
  }, [editingCells]);

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
  }, []);

  const cancelAllEdits = useCallback(() => {
    setEditingCells([]);
  }, []);

  const getEditingValue = useCallback((vertragId: string, field: string) => {
    const cell = editingCells.find(c => c.vertragId === vertragId && c.field === field);
    return cell ? cell.value : null;
  }, [editingCells]);

  const isFieldEditing = useCallback((vertragId: string, field: string) => {
    return editingCells.some(cell => cell.vertragId === vertragId && cell.field === field);
  }, [editingCells]);

  // Save a single field
  const saveSingleField = async (vertragId: string, field: string) => {
    const editingCell = editingCells.find(cell => cell.vertragId === vertragId && cell.field === field);
    if (!editingCell) return;

    try {
      const fieldConfig = EDITABLE_FIELDS[field];
      if (!fieldConfig) return;

      const table = fieldConfig.table;
      let recordId: string | undefined;
      let dbField: string;

      // Determine record ID and database field name
      if (field.startsWith('vertrag.')) {
        recordId = vertragId;
        dbField = field.replace('vertrag.', '');
      } else if (field.startsWith('einheit.')) {
        const row = processedData.find(r => r.vertrag.id === vertragId);
        recordId = row?.einheit?.id;
        dbField = field.replace('einheit.', '');
      } else if (field.startsWith('immobilie.')) {
        const row = processedData.find(r => r.vertrag.id === vertragId);
        recordId = row?.immobilie?.id;
        dbField = field.replace('immobilie.', '');
      } else if (field.startsWith('mieter.')) {
        const row = processedData.find(r => r.vertrag.id === vertragId);
        recordId = row?.mieter?.[0]?.id;
        dbField = field.replace('mieter.', '');
      }

      if (!recordId) return;

      // Convert value based on field type
      let processedValue = editingCell.value;
      if (fieldConfig.type === 'number') {
        processedValue = parseFloat(editingCell.value) || null;
      } else if (fieldConfig.type === 'boolean') {
        processedValue = Boolean(editingCell.value);
      } else if (fieldConfig.type === 'date') {
        processedValue = parseDateFromInput(editingCell.value);
      }

      // Save to database
      const { error } = await supabase
        .from(table as any)
        .update({ [dbField]: processedValue })
        .eq('id', recordId);

      if (error) throw error;

      // Clear this specific editing cell
      setEditingCells(prev => prev.filter(cell => !(cell.vertragId === vertragId && cell.field === field)));

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['editable-miet-uebersicht'] });
      queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });

      toast({
        title: "Erfolgreich gespeichert",
        description: `${fieldConfig.label} wurde aktualisiert.`,
      });

    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Die Änderung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  // Save changes with optimistic updates
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
          recordId = row?.mieter?.[0]?.id;
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
        } else if (fieldConfig.type === 'date') {
          processedValue = parseDateFromInput(cell.value);
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

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['editable-miet-uebersicht'] });
      queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });

      toast({
        title: "Erfolgreich gespeichert",
        description: `${editingCells.length} Änderungen wurden gespeichert.`,
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

  // Handle column visibility
  const toggleColumn = (field: string) => {
    setColumns(prev => prev.map(col => 
      col.field === field ? { ...col, visible: !col.visible } : col
    ));
  };

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get field value from row
  const getFieldValue = (row: TableRow, field: string) => {
    if (field === 'mieter.name') {
      return row.mieter[0] ? `${row.mieter[0].vorname} ${row.mieter[0].nachname}` : '';
    }
    if (field === 'zahlungen.aktuellerMonat') {
      return row.zahlungen.aktuellerMonat;
    }
    if (field === 'einheit.einheitIndex') {
      return row.einheit?.einheitIndex || 1;
    }
    if (field === 'einheit.etage') {
      return row.einheit?.etage || '';
    }
    
    const fieldParts = field.split('.');
    return fieldParts.reduce((obj, key) => obj?.[key], row);
  };

  // Render editable cell
  const renderEditableCell = (row: TableRow, field: string, className: string = "") => {
    const fieldConfig = EDITABLE_FIELDS[field];
    const value = getFieldValue(row, field);
    const vertragId = row.vertrag.id;
    const isActive = isFieldEditing(vertragId, field);
    const editValue = isActive ? getEditingValue(vertragId, field) : value;

    if (!fieldConfig) {
      // Handle non-editable display fields
      let displayValue = value;
      if (field === 'zahlungen.aktuellerMonat' && typeof value === 'number') {
        displayValue = `€${value.toLocaleString('de-DE')}`;
      } else if (field === 'mieter.name') {
        displayValue = value || '-';
      }
      
      return (
        <TableCell className={cn("text-sm", className)}>
          <div className="min-h-[32px] flex items-center">
            {displayValue || '-'}
          </div>
        </TableCell>
      );
    }

    if (isActive) {
      if (fieldConfig.type === 'select' && fieldConfig.options) {
        return (
          <TableCell className={className}>
            <div className="flex items-center gap-1">
              <Select 
                value={editValue || ''} 
                onValueChange={(val) => updateEditingValue(vertragId, field, val)}
              >
                <SelectTrigger className="h-8 text-xs border-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldConfig.options.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveSingleField(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelEdit(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </TableCell>
        );
      }

      if (fieldConfig.type === 'boolean') {
        return (
          <TableCell className={className}>
            <div className="flex items-center gap-1">
              <Select 
                value={editValue ? 'true' : 'false'} 
                onValueChange={(val) => updateEditingValue(vertragId, field, val === 'true')}
              >
                <SelectTrigger className="h-8 text-xs border-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ja</SelectItem>
                  <SelectItem value="false">Nein</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveSingleField(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelEdit(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </TableCell>
        );
      }

      // Handle date input with proper date picker
      if (fieldConfig.type === 'date') {
        const dateValue = editValue ? new Date(editValue) : null;
        
        return (
          <TableCell className={className}>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-8 text-xs justify-start text-left font-normal border-primary",
                      !dateValue && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dateValue ? formatDateForDisplay(dateValue) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={(date) => {
                      if (date) {
                        updateEditingValue(vertragId, field, formatDateForInput(date));
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveSingleField(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelEdit(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </TableCell>
        );
      }

      return (
        <TableCell className={className}>
          <div className="flex items-center gap-1">
            <Input
              type={fieldConfig.type === 'number' ? 'number' : 'text'}
              step={fieldConfig.type === 'number' ? '0.01' : undefined}
              value={editValue || ''}
              onChange={(e) => updateEditingValue(vertragId, field, e.target.value)}
              className="h-8 text-xs border-primary"
              autoFocus
            />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveSingleField(vertragId, field)}
                className="h-8 w-8 p-0"
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cancelEdit(vertragId, field)}
              className="h-8 w-8 p-0"
            >
              <X className="h-3 w-3 text-red-600" />
            </Button>
          </div>
        </TableCell>
      );
    }

  // Display mode
  let displayValue = value;
  if (fieldConfig.format && value) {
    displayValue = fieldConfig.format(value);
  } else if (fieldConfig.type === 'date' && value) {
    displayValue = formatDateForDisplay(value);
  } else if (fieldConfig.type === 'boolean') {
    displayValue = value ? 'Ja' : 'Nein';
  }

  // Check if this field has unsaved changes
  const hasUnsavedChanges = editingCells.some(cell => {
    if (cell.vertragId !== vertragId || cell.field !== field) return false;
    
    // For date fields, compare the formatted versions
    if (fieldConfig?.type === 'date') {
      const originalFormatted = formatDateForInput(cell.originalValue);
      const currentFormatted = formatDateForInput(cell.value);
      return originalFormatted !== currentFormatted;
    }
    
    // For other fields, do a string comparison to avoid type issues
    const originalStr = String(cell.originalValue || '');
    const currentStr = String(cell.value || '');
    return originalStr !== currentStr;
  });

  return (
    <TableCell 
      className={cn(
        "text-sm cursor-pointer hover:bg-muted/50 transition-colors group relative",
        fieldConfig.required && !value && "border-l-2 border-l-red-500",
        hasUnsavedChanges && "border-l-2 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
        className
      )}
      onClick={() => startEditing(vertragId, field, value)}
    >
      <div className="min-h-[32px] flex items-center justify-between">
        <span>{displayValue || '-'}</span>
        <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ml-2" />
      </div>
    </TableCell>
  );
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      'aktiv': 'default',
      'inaktiv': 'secondary',
      'gekündigt': 'destructive'
    };
    
    const variant = variants[status] || 'secondary';
    
    return (
      <Badge variant={variant} className="text-xs">
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Lade Mietübersicht...
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Daten werden geladen...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const visibleColumns = columns.filter(col => col.visible);
  const hasChanges = editingCells.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-hidden p-0">
        
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Mietübersicht
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {processedData.length} Verträge • Alle Felder direkt editierbar
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {hasChanges && (
                <>
                  <Badge variant="secondary" className="animate-pulse">
                    {editingCells.length} Änderungen
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelAllEdits}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Zurücksetzen
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={saveAllChanges}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    Speichern ({editingCells.length})
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Controls */}
        <div className="px-6 py-3 border-b bg-muted/30 space-y-3">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen nach Objekt, Mieter, Adresse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="inaktiv">Inaktiv</SelectItem>
                <SelectItem value="gekündigt">Gekündigt</SelectItem>
              </SelectContent>
            </Select>

            {/* Grouping Controls */}
            <div className="flex items-center gap-2">
              <Switch
                id="grouping"
                checked={showGrouping}
                onCheckedChange={setShowGrouping}
              />
              <Label htmlFor="grouping" className="text-sm whitespace-nowrap">Gruppieren</Label>
              {showGrouping && (
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.filter(col => col.groupable).map((col) => (
                      <SelectItem key={col.field} value={col.field}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Column Visibility */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Spalten ({visibleColumns.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Sichtbare Spalten</h4>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {columns.map((column) => (
                      <div key={column.field} className="flex items-center space-x-2">
                        <Switch
                          id={column.field}
                          checked={column.visible}
                          onCheckedChange={() => toggleColumn(column.field)}
                          disabled={column.sticky}
                        />
                        <Label htmlFor={column.field} className="text-sm flex-1">
                          {column.label}
                          {column.sticky && <span className="text-muted-foreground ml-1">(fixiert)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>Zeige {showGrouping ? Object.values(groupedData).flat().length : processedData.length} von {tableData?.length || 0} Verträgen</span>
            {showGrouping && (
              <span>In {Object.keys(groupedData).length} Gruppen</span>
            )}
            {hasChanges && (
              <span className="text-amber-600 font-medium">
                {editingCells.length} ungespeicherte Änderungen
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 border rounded-lg bg-white h-[calc(95vh-180px)] overflow-auto">
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead>
              <tr className="sticky top-0 z-50 bg-white border-b-2 shadow-lg backdrop-blur-sm hover:bg-white">
                {visibleColumns.map((column) => (
                  <th 
                    key={column.field}
                    className={cn(
                      "sticky top-0 z-50 text-xs font-semibold text-center h-12 border-r bg-white/95 backdrop-blur-sm px-2 align-middle font-medium text-muted-foreground",
                      column.width || "w-32",
                      column.sticky && "sticky left-0 z-60 bg-white shadow-lg",
                      column.sortable && "cursor-pointer hover:bg-muted/20 transition-colors"
                    )}
                    onClick={() => column.sortable && handleSort(column.field)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <div className="text-muted-foreground">
                          {sortField === column.field ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
                   {showGrouping ? (
                     // Render grouped data
                     Object.entries(groupedData).map(([groupName, groupRows]) => (
                       <React.Fragment key={groupName}>
                         {/* Group Header */}
                         <tr className="bg-gradient-to-r from-primary/5 to-primary/10 border-b-2 border-primary/20 hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/15">
                           <td 
                             colSpan={visibleColumns.length} 
                             className="py-3 px-4 font-semibold text-primary align-middle"
                           >
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <Building2 className="h-4 w-4" />
                                 <span className="text-sm font-bold">
                                   {groupBy === 'immobilie.name' && 'Objekt: '}
                                   {groupBy === 'vertrag.status' && 'Status: '}
                                   {groupName}
                                 </span>
                               </div>
                               <Badge variant="secondary" className="text-xs">
                                 {groupRows.length} Verträge
                               </Badge>
                             </div>
                           </td>
                         </tr>
                         
                         {/* Group Rows */}
                         {groupRows.map((row, index) => (
                           <tr 
                             key={row.vertrag.id} 
                             className="hover:bg-muted/30 transition-colors border-b"
                             style={{ animationDelay: `${index * 0.01}s` }}
                           >
                             {visibleColumns.map((column) => {
                               const isSticky = column.sticky;
                               
                               // Special handling for status column
                               if (column.field === 'vertrag.status') {
                                 return (
                                   <td 
                                     key={column.field}
                                     className={cn(
                                       "text-center border-r p-4 align-middle",
                                       isSticky && "sticky left-0 z-10 bg-background/95 shadow-lg"
                                     )}
                                   >
                                     <div className="min-h-[32px] flex items-center justify-center">
                                       {getStatusBadge(row.vertrag.status)}
                                     </div>
                                   </td>
                                 );
                               }
                               
                               return renderEditableCell(
                                 row, 
                                 column.field,
                                 cn(
                                   "text-center border-r",
                                   isSticky && "sticky left-0 z-10 bg-background/95 shadow-lg"
                                 )
                               );
                             })}
                           </tr>
                         ))}
                         
                         {/* Group Summary */}
                         <tr className="bg-muted/20 border-b-2 border-muted">
                           <td 
                             colSpan={visibleColumns.length} 
                             className="py-2 px-4 text-xs text-muted-foreground align-middle"
                           >
                             <div className="flex items-center justify-between">
                               <span>Zwischensumme {groupName}:</span>
                               <div className="flex gap-6">
                                 <span>
                                   Gesamt Kaltmiete: €{groupRows.reduce((sum, row) => sum + (row.vertrag.kaltmiete || 0), 0).toLocaleString('de-DE')}
                                 </span>
                                 <span>
                                   Aktuelle Zahlungen: €{groupRows.reduce((sum, row) => sum + (row.zahlungen.aktuellerMonat || 0), 0).toLocaleString('de-DE')}
                                 </span>
                               </div>
                             </div>
                           </td>
                         </tr>
                       </React.Fragment>
                     ))
                   ) : (
                     // Render ungrouped data
                     processedData.map((row, index) => (
                       <tr 
                         key={row.vertrag.id} 
                         className="hover:bg-muted/30 transition-colors border-b"
                         style={{ animationDelay: `${index * 0.01}s` }}
                       >
                         {visibleColumns.map((column) => {
                           const isSticky = column.sticky;
                           
                           // Special handling for status column
                           if (column.field === 'vertrag.status') {
                             return (
                               <td 
                                 key={column.field}
                                 className={cn(
                                   "text-center border-r p-4 align-middle",
                                   isSticky && "sticky left-0 z-10 bg-background/95 shadow-lg"
                                 )}
                               >
                                 <div className="min-h-[32px] flex items-center justify-center">
                                   {getStatusBadge(row.vertrag.status)}
                                 </div>
                               </td>
                             );
                           }
                           
                           return renderEditableCell(
                             row, 
                             column.field,
                             cn(
                               "text-center border-r",
                               isSticky && "sticky left-0 z-10 bg-background/95 shadow-lg"
                             )
                           );
                         })}
                       </tr>
                 ))
               )}
             </tbody>
        </table>

        {(showGrouping ? Object.values(groupedData).flat().length === 0 : processedData.length === 0) && (
          <div className="text-center py-20">
            <div className="space-y-4">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-medium">Keine Verträge gefunden</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Versuchen Sie es mit anderen Suchkriterien.' 
                    : 'Es sind noch keine Mietverträge vorhanden.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Footer */}
        {hasChanges && (
          <div className="px-6 py-3 border-t bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span>Sie haben {editingCells.length} ungespeicherte Änderungen</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={cancelAllEdits}>
                  Abbrechen
                </Button>
                <Button size="sm" onClick={saveAllChanges} className="bg-green-600 hover:bg-green-700">
                  Alle Änderungen speichern
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};