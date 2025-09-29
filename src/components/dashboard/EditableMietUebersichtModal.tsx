import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, RotateCcw, Edit3, Check, X, ChevronDown, ChevronRight, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatArea } from "@/utils/contractUtils";
import { formatDateForDisplay, formatDateForInput } from "@/utils/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface EditableMietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditingState {
  recordId: string;
  field: string;
  table: string;
  value: any;
}

interface GroupedData {
  objektName: string;
  objektId: string;
  objektAdresse: string;
  contracts: ContractData[];
}

interface ContractData {
  // Contract identifiers
  contractId: string;
  objektId: string;
  objektName: string;
  objektAdresse: string;
  einheitId: string;
  mieterId: string;
  
  // Unit information
  etage: string;
  qm: number;
  einheitentyp: string;
  
  // Contract details
  status: string;
  kaltmiete: number;
  betriebskosten: number;
  warmmiete: number;
  mietbeginn: string | null;
  mietende: string | null;
  kautionSoll: number;
  kautionIst: number;
  lastschrift: boolean;
  letzteErhoehung: string | null;
  
  // Tenant information
  mieterVorname: string;
  mieterNachname: string;
  mieterEmail: string;
  mieterTelefon: string;
  mieterGeburtsdatum: string | null;
}

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingStates, setEditingStates] = useState<EditingState[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Data fetching with all necessary relations
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['mietvertrag-detailed-overview'],
    queryFn: async () => {
      const { data: mietvertraege, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          kaltmiete,
          betriebskosten,
          status,
          start_datum,
          ende_datum,
          kaution_betrag,
          kaution_ist,
          lastschrift,
          letzte_mieterhoehung_am,
          einheiten!inner (
            id,
            etage,
            qm,
            einheitentyp,
            immobilien!inner (
              id,
              name,
              adresse
            )
          ),
          mietvertrag_mieter!inner (
            mieter!inner (
              id,
              vorname,
              nachname,
              hauptmail,
              telnr,
              geburtsdatum
            )
          )
        `)
        .neq('status', 'beendet')
        .order('start_datum', { ascending: false });

      if (error) throw error;

      return mietvertraege?.map(vertrag => ({
        // Contract data
        contractId: vertrag.id,
        status: vertrag.status,
        kaltmiete: vertrag.kaltmiete || 0,
        betriebskosten: vertrag.betriebskosten || 0,
        warmmiete: (vertrag.kaltmiete || 0) + (vertrag.betriebskosten || 0),
        mietbeginn: vertrag.start_datum,
        mietende: vertrag.ende_datum,
        kautionSoll: vertrag.kaution_betrag || 0,
        kautionIst: vertrag.kaution_ist || 0,
        lastschrift: vertrag.lastschrift,
        letzteErhoehung: vertrag.letzte_mieterhoehung_am,
        
        // Property data
        objektId: vertrag.einheiten.immobilien.id,
        objektName: vertrag.einheiten.immobilien.name,
        objektAdresse: vertrag.einheiten.immobilien.adresse,
        
        // Unit data
        einheitId: vertrag.einheiten.id,
        etage: vertrag.einheiten.etage || '',
        qm: vertrag.einheiten.qm || 0,
        einheitentyp: vertrag.einheiten.einheitentyp || 'Wohnung',
        
        // Tenant data
        mieterId: vertrag.mietvertrag_mieter[0]?.mieter?.id,
        mieterVorname: vertrag.mietvertrag_mieter[0]?.mieter?.vorname || '',
        mieterNachname: vertrag.mietvertrag_mieter[0]?.mieter?.nachname || '',
        mieterEmail: vertrag.mietvertrag_mieter[0]?.mieter?.hauptmail || '',
        mieterTelefon: vertrag.mietvertrag_mieter[0]?.mieter?.telnr || '',
        mieterGeburtsdatum: vertrag.mietvertrag_mieter[0]?.mieter?.geburtsdatum || null
      })) || [];
    },
    enabled: open
  });

  // Group data by properties
  const groupedData: GroupedData[] = useMemo(() => {
    if (!tableData) return [];

    const filtered = tableData.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          row.objektName.toLowerCase().includes(searchLower) ||
          `${row.mieterVorname} ${row.mieterNachname}`.toLowerCase().includes(searchLower) ||
          row.mieterEmail.toLowerCase().includes(searchLower) ||
          row.objektAdresse.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });

    const grouped: GroupedData[] = [];
    filtered.forEach(row => {
      const existing = grouped.find(g => g.objektId === row.objektId);
      if (existing) {
        existing.contracts.push(row);
      } else {
        grouped.push({
          objektName: row.objektName,
          objektId: row.objektId,
          objektAdresse: row.objektAdresse,
          contracts: [row]
        });
      }
    });

    return grouped.sort((a, b) => a.objektName.localeCompare(b.objektName));
  }, [tableData, searchTerm, statusFilter]);

  // Initialize expanded groups
  useEffect(() => {
    if (groupedData.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(groupedData.map(g => g.objektId)));
    }
  }, [groupedData, expandedGroups.size]);

  // Toggle group expansion
  const toggleGroup = (objektId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(objektId)) {
        newSet.delete(objektId);
      } else {
        newSet.add(objektId);
      }
      return newSet;
    });
  };

  // Expand all groups
  const expandAllGroups = () => {
    if (groupedData.length > 0) {
      setExpandedGroups(new Set(groupedData.map(g => g.objektId)));
    }
  };

  // Editing functions
  const startEditing = (recordId: string, field: string, table: string, currentValue: any) => {
    setEditingStates(prev => {
      const existing = prev.find(e => e.recordId === recordId && e.field === field);
      if (existing) return prev;
      
      return [...prev, { recordId, field, table, value: currentValue }];
    });
  };

  const updateEditingValue = (recordId: string, field: string, value: any) => {
    setEditingStates(prev => prev.map(e => 
      e.recordId === recordId && e.field === field 
        ? { ...e, value } 
        : e
    ));
  };

  const cancelEditing = (recordId: string, field: string) => {
    setEditingStates(prev => prev.filter(e => !(e.recordId === recordId && e.field === field)));
  };

  const saveField = async (recordId: string, field: string, table: string, value: any) => {
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ [field]: value })
        .eq('id', recordId);

      if (error) throw error;

      // Remove from editing states
      setEditingStates(prev => prev.filter(e => !(e.recordId === recordId && e.field === field)));
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detailed-overview'] });
      
      toast({
        title: "Erfolgreich gespeichert",
        description: `${getFieldLabel(field)} wurde aktualisiert.`,
      });
    } catch (error: any) {
      toast({
        title: "Fehler beim Speichern",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Get editing state
  const getEditingState = (recordId: string, field: string) => {
    return editingStates.find(e => e.recordId === recordId && e.field === field);
  };

  // Field configurations
  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      'name': 'Objektname',
      'adresse': 'Adresse',
      'etage': 'Etage',
      'qm': 'Quadratmeter',
      'einheitentyp': 'Nutzungsart',
      'kaltmiete': 'Kaltmiete',
      'betriebskosten': 'Betriebskosten',
      'status': 'Status',
      'start_datum': 'Mietbeginn',
      'ende_datum': 'Mietende',
      'kaution_betrag': 'Kaution Soll',
      'kaution_ist': 'Kaution Ist',
      'lastschrift': 'Lastschrift',
      'letzte_mieterhoehung_am': 'Letzte Erhöhung',
      'vorname': 'Vorname',
      'nachname': 'Nachname',
      'hauptmail': 'E-Mail',
      'telnr': 'Telefon',
      'geburtsdatum': 'Geburtsdatum'
    };
    return labels[field] || field;
  };

  // Format cell values
  const formatCellValue = (field: string, value: any) => {
    if (value === null || value === undefined || value === '') return '-';
    
    switch (field) {
      case 'kaltmiete':
      case 'betriebskosten':
      case 'kaution_betrag':
      case 'kaution_ist':
        return formatCurrency(value);
      case 'qm':
        return formatArea(value);
      case 'start_datum':
      case 'ende_datum':
      case 'letzte_mieterhoehung_am':
      case 'geburtsdatum':
        return value ? formatDateForDisplay(value) : '-';
      case 'lastschrift':
        return value ? 'Ja' : 'Nein';
      default:
        return String(value);
    }
  };

  // Render edit input
  const renderEditInput = (field: string, value: any, onChange: (value: any) => void) => {
    const commonProps = {
      value: value || '',
      onChange: (e: any) => onChange(e.target ? e.target.value : e),
      className: "h-7 text-xs min-w-0",
      autoFocus: true
    };

    switch (field) {
      case 'status':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="h-7 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aktiv">Aktiv</SelectItem>
              <SelectItem value="gekuendigt">Gekündigt</SelectItem>
              <SelectItem value="inaktiv">Inaktiv</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'einheitentyp':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="h-7 text-xs w-24">
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
        );
      case 'lastschrift':
        return (
          <Switch
            checked={!!value}
            onCheckedChange={onChange}
            className="scale-75"
          />
        );
      case 'start_datum':
      case 'ende_datum':
      case 'letzte_mieterhoehung_am':
      case 'geburtsdatum':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("h-7 text-xs justify-start text-left font-normal w-24", !value && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                {value ? format(new Date(value), "dd.MM.yy", { locale: de }) : "Datum"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => {
                  if (date) {
                    onChange(formatDateForInput(date));
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      case 'kaltmiete':
      case 'betriebskosten':
      case 'kaution_betrag':
      case 'kaution_ist':
      case 'qm':
        return <Input {...commonProps} type="number" step="0.01" className="w-20" />;
      case 'hauptmail':
        return <Input {...commonProps} type="email" className="w-32" />;
      case 'telnr':
        return <Input {...commonProps} type="tel" className="w-24" />;
      default:
        return <Input {...commonProps} type="text" className="w-24" />;
    }
  };

  // Render editable cell
  const renderEditableCell = (row: any, field: string, table: string, recordId: string, value: any) => {
    const editingState = getEditingState(recordId, field);
    const isEditing = !!editingState;
    const displayValue = isEditing ? editingState.value : value;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 min-w-0">
          {renderEditInput(field, displayValue, (newValue) => updateEditingValue(recordId, field, newValue))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => saveField(recordId, field, table, editingState.value)}
            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 flex-shrink-0"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => cancelEditing(recordId, field)}
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    const formattedValue = formatCellValue(field, value);
    
    return (
      <div 
        className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 px-1 py-1 rounded min-w-0"
        onClick={() => startEditing(recordId, field, table, value)}
      >
        <span className="truncate min-w-0 flex-1" title={formattedValue}>
          {formattedValue}
        </span>
        <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity flex-shrink-0 ml-1" />
      </div>
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktiv':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">Aktiv</Badge>;
      case 'gekuendigt':
        return <Badge variant="destructive" className="text-xs">Gekündigt</Badge>;
      case 'inaktiv':
        return <Badge variant="secondary" className="text-xs">Inaktiv</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  // Summary calculations
  const summaryData = useMemo(() => {
    const allContracts = groupedData.flatMap(g => g.contracts);
    if (allContracts.length === 0) {
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

    return allContracts.reduce((acc, row) => ({
      totalUnits: acc.totalUnits + 1,
      activeContracts: acc.activeContracts + (row.status === 'aktiv' ? 1 : 0),
      terminatedContracts: acc.terminatedContracts + (row.status === 'gekuendigt' ? 1 : 0),
      totalColdRent: acc.totalColdRent + row.kaltmiete,
      totalOperatingCosts: acc.totalOperatingCosts + row.betriebskosten,
      totalWarmRent: acc.totalWarmRent + row.warmmiete,
      totalArea: acc.totalArea + row.qm
    }), {
      totalUnits: 0,
      activeContracts: 0,
      terminatedContracts: 0,
      totalColdRent: 0,
      totalOperatingCosts: 0,
      totalWarmRent: 0,
      totalArea: 0
    });
  }, [groupedData]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Daten werden geladen...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] p-0">
        <DialogHeader className="px-6 py-4 border-b bg-white sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Monatliche Mieter - Bearbeitbare Übersicht</DialogTitle>
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
                onClick={expandAllGroups}
                className="text-sm"
              >
                Alle ausklappen
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-gray-50 border-b sticky top-[73px] z-10">
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

        {/* Filters */}
        <div className="px-6 py-4 border-b bg-white sticky top-[205px] z-10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Suchen nach Objekt, Mieter, E-Mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="gekuendigt">Gekündigt</SelectItem>
                <SelectItem value="inaktiv">Inaktiv</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-500">
              {groupedData.reduce((sum, g) => sum + g.contracts.length, 0)} Verträge in {groupedData.length} Objekten
            </div>
          </div>
        </div>

        {/* Table with sticky headers and grouping */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[50vh]">
            <div className="px-6">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow className="border-b-2">
                    <TableHead className="w-[50px] font-semibold text-center">#</TableHead>
                    <TableHead className="w-[80px] font-semibold">Einheit</TableHead>
                    <TableHead className="w-[70px] font-semibold">Etage</TableHead>
                    <TableHead className="w-[60px] font-semibold">Qm</TableHead>
                    <TableHead className="w-[80px] font-semibold">Nutzung</TableHead>
                    <TableHead className="w-[80px] font-semibold">Status</TableHead>
                    <TableHead className="w-[120px] font-semibold">Vorname</TableHead>
                    <TableHead className="w-[120px] font-semibold">Nachname</TableHead>
                    <TableHead className="w-[160px] font-semibold">E-Mail</TableHead>
                    <TableHead className="w-[100px] font-semibold">Telefon</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">Kaltmiete</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">NK</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">Warmmiete</TableHead>
                    <TableHead className="w-[100px] font-semibold">Mietbeginn</TableHead>
                    <TableHead className="w-[100px] font-semibold">Mietende</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">Kaution Soll</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">Kaution Ist</TableHead>
                    <TableHead className="w-[80px] font-semibold">Lastschrift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedData.map((group, groupIndex) => (
                    <React.Fragment key={group.objektId}>
                      {/* Group Header */}
                      <TableRow className="bg-gray-100 hover:bg-gray-200 border-t-2">
                        <TableCell 
                          colSpan={18} 
                          className="font-bold cursor-pointer"
                          onClick={() => toggleGroup(group.objektId)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedGroups.has(group.objektId) ? 
                              <ChevronDown className="h-4 w-4" /> : 
                              <ChevronRight className="h-4 w-4" />
                            }
                            <span className="text-lg">{group.objektName}</span>
                            <Badge variant="outline" className="ml-2">
                              {group.contracts.length} Einheiten
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Group Content */}
                      {expandedGroups.has(group.objektId) && group.contracts.map((row, contractIndex) => (
                         <TableRow key={row.contractId} className="hover:bg-gray-50">
                           <TableCell className="text-center text-sm font-medium">
                             {contractIndex + 1}
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className="text-xs">
                               Einheit {contractIndex + 1}
                             </Badge>
                           </TableCell>
                           <TableCell>
                             {renderEditableCell(row, 'etage', 'einheiten', row.einheitId, row.etage)}
                           </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'qm', 'einheiten', row.einheitId, row.qm)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'einheitentyp', 'einheiten', row.einheitId, row.einheitentyp)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'status', 'mietvertrag', row.contractId, row.status)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'vorname', 'mieter', row.mieterId, row.mieterVorname)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'nachname', 'mieter', row.mieterId, row.mieterNachname)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'hauptmail', 'mieter', row.mieterId, row.mieterEmail)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'telnr', 'mieter', row.mieterId, row.mieterTelefon)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderEditableCell(row, 'kaltmiete', 'mietvertrag', row.contractId, row.kaltmiete)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderEditableCell(row, 'betriebskosten', 'mietvertrag', row.contractId, row.betriebskosten)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.warmmiete)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'start_datum', 'mietvertrag', row.contractId, row.mietbeginn)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'ende_datum', 'mietvertrag', row.contractId, row.mietende)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderEditableCell(row, 'kaution_betrag', 'mietvertrag', row.contractId, row.kautionSoll)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderEditableCell(row, 'kaution_ist', 'mietvertrag', row.contractId, row.kautionIst)}
                          </TableCell>
                          <TableCell>
                            {renderEditableCell(row, 'lastschrift', 'mietvertrag', row.contractId, row.lastschrift)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Group separator */}
                      {groupIndex < groupedData.length - 1 && (
                        <TableRow>
                          <TableCell colSpan={18} className="p-0">
                            <Separator className="my-2" />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {groupedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={18} className="text-center py-8 text-gray-500">
                        {searchTerm || statusFilter !== 'all' ? 
                          'Keine Ergebnisse für die aktuellen Filter gefunden.' : 
                          'Keine Mietverträge vorhanden.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};