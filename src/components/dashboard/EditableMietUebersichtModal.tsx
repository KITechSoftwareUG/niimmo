import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, ChevronDown, ChevronRight, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { sortPropertiesByName } from "@/utils/contractUtils";

interface EditableMietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContractRow {
  contractId: string;
  objektId: string;
  objektName: string;
  einheitId: string;
  mieterId: string;
  
  // Editable fields
  etage: string;
  qm: number;
  typ: string;
  status: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  kaltmiete: number;
  betriebskosten: number;
  mietbeginn: string;
  lastschrift: boolean;
}

export const EditableMietUebersichtModal = ({ open, onOpenChange }: EditableMietUebersichtModalProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: string; value: any } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data
  const { data: rows, isLoading } = useQuery({
    queryKey: ['miet-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          status,
          kaltmiete,
          betriebskosten,
          start_datum,
          lastschrift,
          einheiten!inner(
            id,
            etage,
            qm,
            einheitentyp,
            immobilien!inner(
              id,
              name
            )
          ),
          mietvertrag_mieter!inner(
            mieter!inner(
              id,
              vorname,
              nachname,
              hauptmail,
              telnr
            )
          )
        `)
        .neq('status', 'beendet');

      if (error) throw error;

      return data?.map(v => ({
        contractId: v.id,
        objektId: v.einheiten.immobilien.id,
        objektName: v.einheiten.immobilien.name,
        einheitId: v.einheiten.id,
        mieterId: v.mietvertrag_mieter[0]?.mieter?.id || '',
        etage: v.einheiten.etage || '',
        qm: v.einheiten.qm || 0,
        typ: v.einheiten.einheitentyp || 'Wohnung',
        status: v.status || 'aktiv',
        vorname: v.mietvertrag_mieter[0]?.mieter?.vorname || '',
        nachname: v.mietvertrag_mieter[0]?.mieter?.nachname || '',
        email: v.mietvertrag_mieter[0]?.mieter?.hauptmail || '',
        telefon: v.mietvertrag_mieter[0]?.mieter?.telnr || '',
        kaltmiete: v.kaltmiete || 0,
        betriebskosten: v.betriebskosten || 0,
        mietbeginn: v.start_datum || '',
        lastschrift: v.lastschrift || false
      })) || [];
    },
    enabled: open
  });

  // Group by property
  const grouped = useMemo(() => {
    if (!rows) return [];
    
    const filtered = rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return r.objektName.toLowerCase().includes(s) ||
               `${r.vorname} ${r.nachname}`.toLowerCase().includes(s) ||
               r.email.toLowerCase().includes(s);
      }
      return true;
    });

    const groups: Record<string, ContractRow[]> = {};
    filtered.forEach(r => {
      if (!groups[r.objektId]) groups[r.objektId] = [];
      groups[r.objektId].push(r);
    });

    const groupedArray = Object.entries(groups).map(([id, contracts]) => ({
      objektId: id,
      objektName: contracts[0].objektName,
      contracts
    }));

    return sortPropertiesByName(groupedArray.map(g => ({ name: g.objektName, ...g })))
      .map(({ name, ...rest }) => rest);
  }, [rows, search, statusFilter]);

  // Save field
  const saveField = async (table: string, id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['miet-overview'] });
      toast({ title: "Gespeichert" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

  // Render editable cell
  const EditCell = ({ rowId, table, field, value, type = "text" }: any) => {
    const isEditing = editing?.id === `${rowId}-${field}`;
    const displayValue = isEditing ? editing.value : value;

    if (isEditing) {
      return (
        <div className="flex gap-1 items-center">
          {type === "select-status" ? (
            <Select value={displayValue} onValueChange={(v) => setEditing({ ...editing, value: v })}>
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="gekuendigt">Gekündigt</SelectItem>
                <SelectItem value="inaktiv">Inaktiv</SelectItem>
              </SelectContent>
            </Select>
          ) : type === "select-typ" ? (
            <Select value={displayValue} onValueChange={(v) => setEditing({ ...editing, value: v })}>
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">Wohnung</SelectItem>
                <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                <SelectItem value="Garage">Garage</SelectItem>
              </SelectContent>
            </Select>
          ) : type === "number" ? (
            <Input
              type="number"
              step="0.01"
              value={displayValue}
              onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs w-20"
              autoFocus
            />
          ) : (
            <Input
              value={displayValue}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              className="h-8 text-xs w-32"
              autoFocus
            />
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveField(table, rowId, field, editing.value)}>
            <Save className="h-3 w-3 text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
            <X className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      );
    }

    const formatted = type === "number" ? `${value.toFixed(2)} €` : 
                      type === "date" ? value?.slice(0, 10) || '-' : 
                      value || '-';

    return (
      <div 
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
        onClick={() => setEditing({ id: `${rowId}-${field}`, field, value })}
      >
        {formatted}
      </div>
    );
  };

  // Stats
  const stats = useMemo(() => {
    const all = rows || [];
    return {
      total: all.length,
      aktiv: all.filter(r => r.status === 'aktiv').length,
      kaltmiete: all.reduce((sum, r) => sum + r.kaltmiete, 0),
      warmmiete: all.reduce((sum, r) => sum + r.kaltmiete + r.betriebskosten, 0)
    };
  }, [rows]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            Lade Daten...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] p-0">
        <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-white z-20">
          <DialogTitle className="text-2xl font-bold">Monatliche Mieter - Bearbeitbare Übersicht</DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-3">
              <div className="text-sm text-gray-600">Einheiten</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-green-600">Aktiv</div>
              <div className="text-2xl font-bold text-green-700">{stats.aktiv}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-blue-600">Kaltmiete</div>
              <div className="text-2xl font-bold text-blue-700">{stats.kaltmiete.toFixed(2)} €</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-red-600">Warmmiete</div>
              <div className="text-2xl font-bold text-red-700">{stats.warmmiete.toFixed(2)} €</div>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b bg-white">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="gekuendigt">Gekündigt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="h-[60vh] px-6">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead>Etage</TableHead>
                <TableHead>Qm</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vorname</TableHead>
                <TableHead>Nachname</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Kaltmiete</TableHead>
                <TableHead className="text-right">NK</TableHead>
                <TableHead>Mietbeginn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map(group => (
                <>
                  <TableRow key={group.objektId} className="bg-gray-100 hover:bg-gray-200">
                    <TableCell colSpan={13} className="font-bold cursor-pointer" onClick={() => {
                      const newExpanded = new Set(expanded);
                      if (newExpanded.has(group.objektId)) {
                        newExpanded.delete(group.objektId);
                      } else {
                        newExpanded.add(group.objektId);
                      }
                      setExpanded(newExpanded);
                    }}>
                      <div className="flex items-center gap-2">
                        {expanded.has(group.objektId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {group.objektName}
                        <Badge variant="outline">{group.contracts.length}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded.has(group.objektId) && group.contracts.map((row, idx) => (
                    <TableRow key={row.contractId} className="hover:bg-gray-50">
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.einheitId.slice(-4)}</Badge>
                      </TableCell>
                      <TableCell><EditCell rowId={row.einheitId} table="einheiten" field="etage" value={row.etage} /></TableCell>
                      <TableCell><EditCell rowId={row.einheitId} table="einheiten" field="qm" value={row.qm} type="number" /></TableCell>
                      <TableCell><EditCell rowId={row.einheitId} table="einheiten" field="einheitentyp" value={row.typ} type="select-typ" /></TableCell>
                      <TableCell><EditCell rowId={row.contractId} table="mietvertrag" field="status" value={row.status} type="select-status" /></TableCell>
                      <TableCell><EditCell rowId={row.mieterId} table="mieter" field="vorname" value={row.vorname} /></TableCell>
                      <TableCell><EditCell rowId={row.mieterId} table="mieter" field="nachname" value={row.nachname} /></TableCell>
                      <TableCell><EditCell rowId={row.mieterId} table="mieter" field="hauptmail" value={row.email} /></TableCell>
                      <TableCell><EditCell rowId={row.mieterId} table="mieter" field="telnr" value={row.telefon} /></TableCell>
                      <TableCell className="text-right"><EditCell rowId={row.contractId} table="mietvertrag" field="kaltmiete" value={row.kaltmiete} type="number" /></TableCell>
                      <TableCell className="text-right"><EditCell rowId={row.contractId} table="mietvertrag" field="betriebskosten" value={row.betriebskosten} type="number" /></TableCell>
                      <TableCell><EditCell rowId={row.contractId} table="mietvertrag" field="start_datum" value={row.mietbeginn} type="date" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
