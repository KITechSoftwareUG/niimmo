import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatArea } from "@/utils/contractUtils";
import { formatDateForDisplay } from "@/utils/dateUtils";

interface EditableMietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Data fetching with simplified query
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['mietvertrag-overview'],
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
              telnr
            )
          )
        `)
        .neq('status', 'beendet')
        .order('start_datum', { ascending: false });

      if (error) throw error;

      return mietvertraege?.map(vertrag => ({
        id: vertrag.id,
        objekt: vertrag.einheiten.immobilien.name,
        adresse: vertrag.einheiten.immobilien.adresse,
        einheit: vertrag.einheiten.id.slice(-8),
        etage: vertrag.einheiten.etage || '-',
        qm: vertrag.einheiten.qm || 0,
        einheitentyp: vertrag.einheiten.einheitentyp || 'Wohnung',
        status: vertrag.status,
        kaltmiete: vertrag.kaltmiete || 0,
        betriebskosten: vertrag.betriebskosten || 0,
        warmmiete: (vertrag.kaltmiete || 0) + (vertrag.betriebskosten || 0),
        mietbeginn: vertrag.start_datum,
        mietende: vertrag.ende_datum,
        kautionSoll: vertrag.kaution_betrag || 0,
        kautionIst: vertrag.kaution_ist || 0,
        lastschrift: vertrag.lastschrift,
        mieterName: vertrag.mietvertrag_mieter[0]?.mieter 
          ? `${vertrag.mietvertrag_mieter[0].mieter.vorname} ${vertrag.mietvertrag_mieter[0].mieter.nachname}`.trim()
          : 'Unbekannt',
        mieterEmail: vertrag.mietvertrag_mieter[0]?.mieter?.hauptmail || '-',
        mieterTelefon: vertrag.mietvertrag_mieter[0]?.mieter?.telnr || '-'
      })) || [];
    },
    enabled: open
  });

  // Filter and search logic
  const filteredData = useMemo(() => {
    if (!tableData) return [];

    return tableData.filter(row => {
      // Status filter
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          row.objekt.toLowerCase().includes(searchLower) ||
          row.einheit.toLowerCase().includes(searchLower) ||
          row.mieterName.toLowerCase().includes(searchLower) ||
          row.mieterEmail.toLowerCase().includes(searchLower) ||
          row.adresse.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [tableData, searchTerm, statusFilter]);

  // Summary calculations
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

    return filteredData.reduce((acc, row) => ({
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
  }, [filteredData]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktiv':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Aktiv</Badge>;
      case 'gekuendigt':
        return <Badge variant="destructive">Gekündigt</Badge>;
      case 'inaktiv':
        return <Badge variant="secondary">Inaktiv</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <DialogHeader className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Monatliche Mieter - Übersicht</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Filter zurücksetzen
            </Button>
          </div>
        </DialogHeader>

        {/* Summary Cards */}
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

        {/* Filters */}
        <div className="px-6 py-4 border-b bg-white">
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
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
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
              {filteredData.length} von {tableData?.length || 0} Einträgen
            </div>
          </div>
        </div>

        {/* Table with proper scrolling */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[60vh]">
            <div className="px-6">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow className="border-b">
                    <TableHead className="w-[140px] font-semibold">Objekt</TableHead>
                    <TableHead className="w-[80px] font-semibold">Einheit</TableHead>
                    <TableHead className="w-[60px] font-semibold">Etage</TableHead>
                    <TableHead className="w-[60px] font-semibold">Qm</TableHead>
                    <TableHead className="w-[90px] font-semibold">Status</TableHead>
                    <TableHead className="w-[180px] font-semibold">Mieter</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">Kaltmiete</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">NK</TableHead>
                    <TableHead className="w-[90px] font-semibold text-right">Warmmiete</TableHead>
                    <TableHead className="w-[100px] font-semibold">Mietbeginn</TableHead>
                    <TableHead className="w-[100px] font-semibold">Lastschrift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row, index) => (
                    <TableRow key={row.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="max-w-[130px] truncate" title={row.objekt}>
                          {row.objekt}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.einheit}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.etage}</TableCell>
                      <TableCell>{formatArea(row.qm)}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>
                        <div className="max-w-[170px]">
                          <div className="font-medium truncate" title={row.mieterName}>
                            {row.mieterName}
                          </div>
                          {row.mieterEmail !== '-' && (
                            <div className="text-xs text-gray-500 truncate" title={row.mieterEmail}>
                              {row.mieterEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.kaltmiete)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.betriebskosten)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.warmmiete)}
                      </TableCell>
                      <TableCell>
                        {row.mietbeginn ? formatDateForDisplay(row.mietbeginn) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.lastschrift ? 'default' : 'secondary'} className="text-xs">
                          {row.lastschrift ? 'Ja' : 'Nein'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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