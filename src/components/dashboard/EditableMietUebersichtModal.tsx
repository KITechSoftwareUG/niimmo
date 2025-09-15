import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, X, Edit3, Check, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Settings, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useCallback } from "react";
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
import { useEditableField } from "@/hooks/useEditableField";
import { useContractFiltering } from "@/hooks/useContractFiltering";
import { formatDateForInput, formatDateForDisplay, parseInputDate } from "@/utils/dateUtils";
import { formatCurrency, formatArea } from "@/utils/contractUtils";

interface EditableMietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  'einheit.qm': { label: 'Quadratmeter', type: 'number', table: 'einheiten', category: 'unit', format: formatArea },
  'einheit.einheitentyp': { label: 'Nutzung', type: 'select', table: 'einheiten', category: 'unit', options: ['Wohnung', 'Gewerbe', 'Garage', 'Keller', 'Dachboden'] },
  
  // Mietvertrag fields
  'vertrag.kaltmiete': { label: 'Kaltmiete', type: 'number', table: 'mietvertrag', category: 'contract', format: formatCurrency },
  'vertrag.betriebskosten': { label: 'Betriebskosten', type: 'number', table: 'mietvertrag', category: 'contract', format: formatCurrency },
  'vertrag.status': { label: 'Status', type: 'select', table: 'mietvertrag', category: 'contract', options: ['aktiv', 'inaktiv', 'gekuendigt'] },
  'vertrag.start_datum': { label: 'Mietbeginn', type: 'date', table: 'mietvertrag', category: 'contract', format: formatDateForDisplay },
  'vertrag.ende_datum': { label: 'Mietende', type: 'date', table: 'mietvertrag', category: 'contract', format: formatDateForDisplay },
  'vertrag.kaution_betrag': { label: 'Kaution Soll', type: 'number', table: 'mietvertrag', category: 'contract', format: formatCurrency },
  'vertrag.kaution_ist': { label: 'Kaution Ist', type: 'number', table: 'mietvertrag', category: 'contract', format: formatCurrency },
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

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { field: 'immobilie.name', label: 'Objekt', width: '150px', sticky: true, visible: true, sortable: true, groupable: true },
  { field: 'einheit.nummer', label: 'Einheit', width: '80px', visible: true, sortable: true },
  { field: 'einheit.etage', label: 'Etage', width: '80px', visible: true, sortable: true },
  { field: 'einheit.qm', label: 'Qm', width: '80px', visible: true, sortable: true },
  { field: 'vertrag.status', label: 'Status', width: '100px', visible: true, sortable: true, groupable: true },
  { field: 'vertrag.kaltmiete', label: 'Kaltmiete', width: '100px', visible: true, sortable: true },
  { field: 'vertrag.betriebskosten', label: 'NK', width: '100px', visible: true, sortable: true },
  { field: 'vertrag.start_datum', label: 'Mietbeginn', width: '120px', visible: true, sortable: true },
  { field: 'vertrag.ende_datum', label: 'Mietende', width: '120px', visible: true, sortable: true },
  { field: 'mieter.name', label: 'Mieter', width: '200px', visible: true, sortable: true },
  { field: 'mieter.hauptmail', label: 'E-Mail', width: '200px', visible: false, sortable: true },
  { field: 'mieter.telnr', label: 'Telefon', width: '120px', visible: false, sortable: true },
  { field: 'vertrag.kaution_betrag', label: 'Kaution Soll', width: '120px', visible: false, sortable: true },
  { field: 'vertrag.kaution_ist', label: 'Kaution Ist', width: '120px', visible: false, sortable: true },
];

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  // Column visibility and configuration
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Use centralized hooks
  const editingHook = useEditableField();

  // Data fetching
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['mietvertrag-mit-details'],
    queryFn: async () => {
      // Fetch all data with relations
      const { data: mietvertraege, error } = await supabase
        .from('mietvertrag')
        .select(`
          *,
          einheiten (*,
            immobilien (*)
          ),
          mietvertrag_mieter (
            mieter (*)
          )
        `)
        .neq('status', 'beendet'); // Exclude ended contracts

      if (error) throw error;

      // Transform data to match expected structure
      return mietvertraege?.map(vertrag => ({
        vertrag,
        einheit: vertrag.einheiten,
        immobilie: vertrag.einheiten?.immobilien,
        mieter: vertrag.mietvertrag_mieter?.map((mm: any) => mm.mieter) || [],
      })) || [];
    },
    enabled: open
  });

  // Use centralized filtering with the loaded data
  const {
    filteredData,
    filters,
    setFilters,
    sortConfig,
    handleSort,
    searchTerm,
    setSearchTerm,
    resetFilters,
    totalCount,
    filteredCount
  } = useContractFiltering(tableData);

  // Memoized summary calculations
  const summaryData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        totalUnits: 0,
        activeContracts: 0,
        terminatedContracts: 0,
        totalColdRent: 0,
        totalOperatingCosts: 0,
        totalWarmRent: 0,
        totalArea: 0
      };
    }

    return filteredData.reduce((acc, row) => {
      const kaltmiete = row.vertrag?.kaltmiete || 0;
      const betriebskosten = row.vertrag?.betriebskosten || 0;
      const qm = row.einheit?.qm || 0;

      return {
        totalUnits: acc.totalUnits + 1,
        activeContracts: acc.activeContracts + (row.vertrag?.status === 'aktiv' ? 1 : 0),
        terminatedContracts: acc.terminatedContracts + (row.vertrag?.status === 'gekuendigt' ? 1 : 0),
        totalColdRent: acc.totalColdRent + kaltmiete,
        totalOperatingCosts: acc.totalOperatingCosts + betriebskosten,
        totalWarmRent: acc.totalWarmRent + kaltmiete + betriebskosten,
        totalArea: acc.totalArea + qm
      };
    }, {
      totalUnits: 0,
      activeContracts: 0,
      terminatedContracts: 0,
      totalColdRent: 0,
      totalOperatingCosts: 0,
      totalWarmRent: 0,
      totalArea: 0
    });
  }, [filteredData]);

  // Column management
  const toggleColumnVisibility = useCallback((field: string) => {
    setColumns(prev => prev.map(col => 
      col.field === field ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  const resetColumns = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
  }, []);

  // Get visible columns
  const visibleColumns = useMemo(() => 
    columns.filter(col => col.visible), 
    [columns]
  );

  // Render cell content
  const renderCellContent = useCallback((row: any, field: string) => {
    const [object, property] = field.split('.');
    let value;

    switch (object) {
      case 'immobilie':
        value = row.immobilie?.[property];
        break;
      case 'einheit':
        value = row.einheit?.[property];
        break;
      case 'vertrag':
        value = row.vertrag?.[property];
        break;
      case 'mieter':
        if (property === 'name') {
          const mieter = row.mieter?.[0];
          value = mieter ? `${mieter.vorname || ''} ${mieter.nachname || ''}`.trim() : '';
        } else {
          value = row.mieter?.[0]?.[property];
        }
        break;
      default:
        value = '';
    }

    const fieldConfig = EDITABLE_FIELDS[field];
    if (fieldConfig?.format && value != null) {
      return fieldConfig.format(value);
    }

    return value || '';
  }, []);

  // Render editable cell
  const renderEditableCell = useCallback((row: any, field: string) => {
    const recordId = getRecordId(row, field);
    const isEditing = editingHook.isFieldEditing(recordId, field);
    const currentValue = renderCellContent(row, field);
    const editingValue = editingHook.getEditingValue(recordId, field);
    const fieldConfig = EDITABLE_FIELDS[field];

    if (!fieldConfig) {
      return <span className="text-gray-500">{currentValue}</span>;
    }

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {renderEditInput(recordId, field, fieldConfig, editingValue || currentValue)}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleSaveField(recordId, field, fieldConfig)}
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editingHook.cancelEdit(recordId, field)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div 
        className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
        onClick={() => editingHook.startEditing(recordId, field, getRawValue(row, field))}
      >
        <span>{currentValue}</span>
        <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
      </div>
    );
  }, [editingHook]);

  // Helper functions
  const getRecordId = (row: any, field: string): string => {
    const [object] = field.split('.');
    switch (object) {
      case 'immobilie':
        return row.immobilie?.id || '';
      case 'einheit':
        return row.einheit?.id || '';
      case 'vertrag':
        return row.vertrag?.id || '';
      case 'mieter':
        return row.mieter?.[0]?.id || '';
      default:
        return '';
    }
  };

  const getRawValue = (row: any, field: string) => {
    const [object, property] = field.split('.');
    switch (object) {
      case 'immobilie':
        return row.immobilie?.[property];
      case 'einheit':
        return row.einheit?.[property];
      case 'vertrag':
        return row.vertrag?.[property];
      case 'mieter':
        return row.mieter?.[0]?.[property];
      default:
        return '';
    }
  };

  const handleSaveField = async (recordId: string, field: string, fieldConfig: FieldConfig) => {
    await editingHook.saveSingleField(recordId, field, fieldConfig);
  };

  const renderEditInput = (recordId: string, field: string, fieldConfig: FieldConfig, value: any) => {
    const commonProps = {
      value: value || '',
      onChange: (e: any) => {
        const newValue = e.target ? e.target.value : e;
        editingHook.updateValue(recordId, field, newValue);
      },
      className: "h-8 text-sm",
      autoFocus: true
    };

    switch (fieldConfig.type) {
      case 'select':
        return (
          <Select 
            value={value || ''} 
            onValueChange={(newValue) => editingHook.updateValue(recordId, field, newValue)}
          >
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options?.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'boolean':
        return (
          <Switch
            checked={!!value}
            onCheckedChange={(checked) => editingHook.updateValue(recordId, field, checked)}
          />
        );
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("h-8 text-sm justify-start text-left font-normal", !value && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => {
                  if (date) {
                    editingHook.updateValue(recordId, field, formatDateForInput(date));
                  }
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        );
      case 'number':
        return <Input {...commonProps} type="number" step="0.01" />;
      case 'email':
        return <Input {...commonProps} type="email" />;
      case 'tel':
        return <Input {...commonProps} type="tel" />;
      default:
        return <Input {...commonProps} type="text" />;
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: string }) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Mietübersicht - Bearbeitbar</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="text-sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Filter zurücksetzen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnSettings(!showColumnSettings)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Spalten
              </Button>
              {editingHook.hasUnsavedChanges && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={editingHook.discardAllChanges}
                >
                  Alle Änderungen verwerfen
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="p-3">
              <div className="text-sm font-medium text-gray-600">Einheiten</div>
              <div className="text-xl font-bold">{summaryData.totalUnits}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm font-medium text-green-600">Aktiv</div>
              <div className="text-xl font-bold text-green-700">{summaryData.activeContracts}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm font-medium text-yellow-600">Gekündigt</div>
              <div className="text-xl font-bold text-yellow-700">{summaryData.terminatedContracts}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm font-medium text-blue-600">Kaltmiete</div>
              <div className="text-xl font-bold text-blue-700">{formatCurrency(summaryData.totalColdRent)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm font-medium text-purple-600">NK</div>
              <div className="text-xl font-bold text-purple-700">{formatCurrency(summaryData.totalOperatingCosts)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm font-medium text-red-600">Warmmiete</div>
              <div className="text-xl font-bold text-red-700">{formatCurrency(summaryData.totalWarmRent)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm font-medium text-gray-600">Fläche</div>
              <div className="text-xl font-bold">{formatArea(summaryData.totalArea)}</div>
            </Card>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={filters.mietstatus}
                onValueChange={(value) => setFilters({ ...filters, mietstatus: value as any })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="gekuendigt">Gekündigt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-500">
              {filteredCount} von {totalCount} Einträgen
            </div>
          </div>
        </div>

        {/* Column Settings */}
        {showColumnSettings && (
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Spalten anpassen</h3>
              <Button variant="outline" size="sm" onClick={resetColumns}>
                Zurücksetzen
              </Button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {columns.map(column => (
                <div key={column.field} className="flex items-center space-x-2">
                  <Switch
                    checked={column.visible}
                    onCheckedChange={() => toggleColumnVisibility(column.field)}
                  />
                  <Label className="text-sm">{column.label}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map(column => (
                    <TableHead 
                      key={column.field}
                      className={cn(
                        "text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50",
                        column.sticky && "sticky left-0 bg-white z-10",
                        column.width && `w-[${column.width}]`
                      )}
                      onClick={() => column.sortable && handleSort(column.field)}
                    >
                      <div className="flex items-center justify-between">
                        {column.label}
                        {column.sortable && <SortIcon field={column.field} />}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData?.map((row: any, index: number) => (
                  <TableRow key={`${row.vertrag?.id || index}`} className="hover:bg-gray-50">
                    {visibleColumns.map(column => (
                      <TableCell 
                        key={column.field}
                        className={cn(
                          "text-sm p-2",
                          column.sticky && "sticky left-0 bg-white z-10"
                        )}
                      >
                        {EDITABLE_FIELDS[column.field] ? 
                          renderEditableCell(row, column.field) : 
                          renderCellContent(row, column.field)
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};