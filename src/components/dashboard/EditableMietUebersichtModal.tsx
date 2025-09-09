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
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  'vertrag.start_datum': { label: 'Mietbeginn', type: 'date', table: 'mietvertrag', category: 'contract', format: (val) => new Date(val).toLocaleDateString('de-DE') },
  'vertrag.ende_datum': { label: 'Mietende', type: 'date', table: 'mietvertrag', category: 'contract', format: (val) => new Date(val).toLocaleDateString('de-DE') },
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
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { field: 'immobilie.name', label: 'Objekt', width: 'w-40', sticky: true, visible: true, sortable: true },
  { field: 'einheit.etage', label: 'Einheit', width: 'w-20', visible: true },
  { field: 'mieter.name', label: 'Mieter', width: 'w-48', visible: true, sortable: true },
  { field: 'vertrag.status', label: 'Status', width: 'w-24', visible: true, sortable: true },
  { field: 'vertrag.kaltmiete', label: 'Kaltmiete', width: 'w-28', visible: true, sortable: true },
  { field: 'vertrag.betriebskosten', label: 'NK', width: 'w-24', visible: true, sortable: true },
  { field: 'zahlungen.aktuellerMonat', label: 'Aktuelle Miete', width: 'w-32', visible: true },
  { field: 'vertrag.start_datum', label: 'Mietbeginn', width: 'w-28', visible: true, sortable: true },
  { field: 'einheit.qm', label: 'qm', width: 'w-20', visible: false, sortable: true },
  { field: 'vertrag.kaution_betrag', label: 'Kaution Soll', width: 'w-28', visible: false },
  { field: 'vertrag.kaution_ist', label: 'Kaution Ist', width: 'w-28', visible: false },
  { field: 'vertrag.lastschrift', label: 'Lastschrift', width: 'w-24', visible: false },
  { field: 'mieter.hauptmail', label: 'E-Mail', width: 'w-48', visible: false },
  { field: 'mieter.telnr', label: 'Telefon', width: 'w-32', visible: false },
];

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  const [editingCells, setEditingCells] = useState<EditingCell[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('immobilie.name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

    let filtered = tableData.map(vertrag => {
      const zahlungen = getZahlungenFuerVertrag(vertrag.id);
      
      return {
        vertrag,
        einheit: vertrag.einheiten,
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

  // Editing functions
  const startEditing = useCallback((vertragId: string, field: string, currentValue: any) => {
    const existingIndex = editingCells.findIndex(
      cell => cell.vertragId === vertragId && cell.field === field
    );
    
    if (existingIndex >= 0) return;
    
    setEditingCells(prev => [
      ...prev,
      { vertragId, field, value: currentValue, originalValue: currentValue }
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
                onClick={() => {
                  updateEditingValue(vertragId, field, editValue);
                  cancelEdit(vertragId, field);
                }}
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
                onClick={() => {
                  updateEditingValue(vertragId, field, editValue);
                  cancelEdit(vertragId, field);
                }}
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
              type={fieldConfig.type === 'number' ? 'number' : fieldConfig.type === 'date' ? 'date' : 'text'}
              step={fieldConfig.type === 'number' ? '0.01' : undefined}
              value={editValue || ''}
              onChange={(e) => updateEditingValue(vertragId, field, e.target.value)}
              className="h-8 text-xs border-primary"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                updateEditingValue(vertragId, field, editValue);
                cancelEdit(vertragId, field);
              }}
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
      displayValue = new Date(value).toLocaleDateString('de-DE');
    } else if (fieldConfig.type === 'boolean') {
      displayValue = value ? 'Ja' : 'Nein';
    }

    return (
      <TableCell 
        className={cn(
          "text-sm cursor-pointer hover:bg-muted/50 transition-colors group relative",
          fieldConfig.required && !value && "border-l-2 border-l-red-500",
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
            <span>Zeige {processedData.length} von {tableData?.length || 0} Verträgen</span>
            {hasChanges && (
              <span className="text-amber-600 font-medium">
                {editingCells.length} ungespeicherte Änderungen
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(95vh-180px)]">
            <div className="relative">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-20 border-b-2">
                  <TableRow className="hover:bg-transparent border-b">
                    {visibleColumns.map((column) => (
                      <TableHead 
                        key={column.field}
                        className={cn(
                          "text-xs font-semibold text-center h-12 border-r",
                          column.width || "w-32",
                          column.sticky && "sticky left-0 z-30 bg-muted/80 shadow-lg",
                          column.sortable && "cursor-pointer hover:bg-muted/70 transition-colors"
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
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {processedData.map((row, index) => (
                    <TableRow 
                      key={row.vertrag.id} 
                      className="hover:bg-muted/30 transition-colors border-b"
                      style={{ animationDelay: `${index * 0.01}s` }}
                    >
                      {visibleColumns.map((column) => {
                        const isSticky = column.sticky;
                        
                        // Special handling for status column
                        if (column.field === 'vertrag.status') {
                          return (
                            <TableCell 
                              key={column.field}
                              className={cn(
                                "text-center border-r",
                                isSticky && "sticky left-0 z-10 bg-background/95 shadow-lg"
                              )}
                            >
                              <div className="min-h-[32px] flex items-center justify-center">
                                {getStatusBadge(row.vertrag.status)}
                              </div>
                            </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {processedData.length === 0 && (
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
          </ScrollArea>
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