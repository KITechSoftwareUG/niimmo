import { useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Search, ChevronDown, ChevronRight, Save, X, ArrowLeft, 
  TableProperties, Building2, Users, Banknote, Check, Pencil
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { sortPropertiesByName, getCurrentContract } from "@/utils/contractUtils";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface EditableMietUebersichtProps {
  onBack: () => void;
}

interface MieterInfo {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
}

interface ContractRow {
  contractId: string;
  objektId: string;
  objektName: string;
  einheitId: string;
  mieterId: string;
  etage: string;
  qm: number;
  typ: string;
  status: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  mieter: MieterInfo[];
  kaltmiete: number;
  betriebskosten: number;
  mietbeginn: string;
  lastschrift: boolean;
  anzahlPersonen: number | null;
  verwendungszweck: string[] | null;
  bankkonto: string;
  kaution_betrag: number | null;
  kaution_status: string;
}

export const EditableMietUebersicht = ({ onBack }: EditableMietUebersichtProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<{ id: string; field: string; value: any } | null>(null);
  const [pendingKaltmiete, setPendingKaltmiete] = useState<{ contractId: string; oldValue: number; newValue: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ['miet-overview'],
    queryFn: async () => {
      const { data: einheitenData, error: einheitenError } = await supabase
        .from('einheiten')
        .select(`
          id, etage, qm, einheitentyp, zaehler,
          immobilien!inner( id, name ),
          mietvertrag(
            id, status, kaltmiete, betriebskosten, start_datum, lastschrift, anzahl_personen,
            verwendungszweck, bankkonto_mieter, kaution_betrag, kaution_status,
            mietvertrag_mieter( mieter( id, vorname, nachname, hauptmail, telnr ) )
          )
        `);
      if (einheitenError) throw einheitenError;

      const results: ContractRow[] = [];
      einheitenData?.forEach(einheit => {
        const contracts = einheit.mietvertrag || [];
        if (contracts.length === 0) return;
        const currentContract = getCurrentContract(contracts);
        if (!currentContract) return;
        const allMieter: MieterInfo[] = (currentContract.mietvertrag_mieter || [])
          .map((mm: any) => mm.mieter)
          .filter(Boolean)
          .map((m: any) => ({
            id: m.id || '',
            vorname: m.vorname || '',
            nachname: m.nachname || '',
            email: m.hauptmail || '',
            telefon: m.telnr || '',
          }));
        const hauptmieter = allMieter[0];
        results.push({
          contractId: currentContract.id,
          objektId: einheit.immobilien.id,
          objektName: einheit.immobilien.name,
          einheitId: einheit.id,
          mieterId: hauptmieter?.id || '',
          etage: einheit.etage || '',
          qm: einheit.qm || 0,
          typ: einheit.einheitentyp || 'Wohnung',
          status: currentContract.status || 'aktiv',
          vorname: hauptmieter?.vorname || '',
          nachname: hauptmieter?.nachname || '',
          email: hauptmieter?.email || '',
          telefon: hauptmieter?.telefon || '',
          mieter: allMieter,
          kaltmiete: currentContract.kaltmiete || 0,
          betriebskosten: currentContract.betriebskosten || 0,
          mietbeginn: currentContract.start_datum || '',
          lastschrift: currentContract.lastschrift || false,
          anzahlPersonen: currentContract.anzahl_personen,
          verwendungszweck: currentContract.verwendungszweck,
          bankkonto: currentContract.bankkonto_mieter || '',
          kaution_betrag: currentContract.kaution_betrag,
          kaution_status: currentContract.kaution_status || 'offen',
        });
      });
      return results;
    },
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
               r.email.toLowerCase().includes(s) ||
               r.etage.toLowerCase().includes(s);
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
      contracts,
    }));

    return sortPropertiesByName(groupedArray.map(g => ({ name: g.objektName, ...g })))
      .map(({ name, ...rest }) => rest);
  }, [rows, search, statusFilter]);

  // Save field
  const saveField = useCallback(async (table: string, id: string, field: string, value: any, extraUpdate?: Record<string, any>) => {
    if (!id || id.trim() === '') {
      toast({ title: "Fehler", description: "Kein gültiger Datensatz gefunden", variant: "destructive" });
      setEditing(null);
      return;
    }
    try {
      const updateData = { [field]: value, ...extraUpdate };
      const { error } = await supabase.from(table as any).update(updateData).eq('id', id);
      if (error) throw error;
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['miet-overview'] });
      queryClient.invalidateQueries({ queryKey: ['einheiten'] });
      queryClient.invalidateQueries({ queryKey: ['mietvertrag'] });
      queryClient.invalidateQueries({ queryKey: ['mieter'] });
      queryClient.invalidateQueries({ queryKey: ['immobilie-detail'] });
      queryClient.invalidateQueries({ queryKey: ['all-mietvertraege'] });
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-mit-details'] });
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail'] });
      toast({ title: extraUpdate?.letzte_mieterhoehung_am ? "✓ Mieterhöhung dokumentiert" : "✓ Gespeichert" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  }, [queryClient, toast]);

  // Intercept kaltmiete saves to show confirmation dialog
  const handleSaveField = useCallback((table: string, id: string, field: string, value: any) => {
    if (field === 'kaltmiete') {
      const row = rows?.find(r => r.contractId === id);
      const oldValue = row?.kaltmiete ?? 0;
      const newValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      if (newValue !== oldValue) {
        setPendingKaltmiete({ contractId: id, oldValue, newValue });
        return;
      }
    }
    saveField(table, id, field, value);
  }, [rows, saveField]);

  // Inline edit cell
  const EditCell = ({ rowId, table, field, value, type = "text", className = "" }: any) => {
    const editKey = `${rowId}-${field}`;
    const isEditing = editing?.id === editKey;
    const displayValue = isEditing ? editing.value : value;

    if (isEditing) {
      return (
        <div className="flex gap-0.5 items-center">
          {type === "select-status" ? (
            <Select value={displayValue} onValueChange={(v) => setEditing({ ...editing!, value: v })}>
              <SelectTrigger className="h-7 text-xs w-[90px] border-primary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="gekuendigt">Gekündigt</SelectItem>
                <SelectItem value="beendet">Beendet</SelectItem>
              </SelectContent>
            </Select>
          ) : type === "select-typ" ? (
            <Select value={displayValue} onValueChange={(v) => setEditing({ ...editing!, value: v })}>
              <SelectTrigger className="h-7 text-xs w-[90px] border-primary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">Wohnung</SelectItem>
                <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                <SelectItem value="Stellplatz">Stellplatz</SelectItem>
                <SelectItem value="Garage">Garage</SelectItem>
                <SelectItem value="Lager">Lager</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          ) : type === "personen" ? (
            <Input type="number" step="1" min="1" value={displayValue ?? ''} onChange={(e) => setEditing({ ...editing!, value: e.target.value ? parseInt(e.target.value) : null })} className="h-7 text-xs w-14 border-primary" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveField(table, rowId, field, editing!.value)} />
          ) : (type === "number" || type === "qm") ? (
            <Input type="number" step="0.01" value={displayValue} onChange={(e) => setEditing({ ...editing!, value: parseFloat(e.target.value) || 0 })} className="h-7 text-xs w-20 border-primary" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveField(table, rowId, field, editing!.value)} />
          ) : type === "date" ? (
            <Input type="date" value={displayValue?.slice(0, 10) || ''} onChange={(e) => setEditing({ ...editing!, value: e.target.value })} className="h-7 text-xs w-[120px] border-primary" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveField(table, rowId, field, editing!.value)} />
          ) : (
            <Input value={displayValue} onChange={(e) => setEditing({ ...editing!, value: e.target.value })} className="h-7 text-xs w-full min-w-[80px] border-primary" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveField(table, rowId, field, editing!.value)} />
          )}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => handleSaveField(table, rowId, field, editing!.value)}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => setEditing(null)}>
            <X className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      );
    }

    let formatted: string;
    if (type === "number") formatted = `${Number(value || 0).toFixed(2)} €`;
    else if (type === "qm") formatted = `${Number(value || 0).toFixed(1)} m²`;
    else if (type === "personen") formatted = value != null ? value.toString() : '-';
    else if (type === "date") formatted = value?.slice(0, 10) || '-';
    else formatted = value || '-';

    return (
      <div 
        className={`group/cell cursor-pointer hover:bg-primary/5 px-1.5 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${className}`}
        onClick={() => setEditing({ id: editKey, field, value })}
      >
        <span className="truncate">{formatted}</span>
        <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 shrink-0 transition-opacity" />
      </div>
    );
  };

  // Stats
  const stats = useMemo(() => {
    const all = rows || [];
    return {
      total: all.length,
      aktiv: all.filter(r => r.status === 'aktiv').length,
      gekuendigt: all.filter(r => r.status === 'gekuendigt').length,
      kaltmiete: all.filter(r => r.status === 'aktiv').reduce((sum, r) => sum + r.kaltmiete, 0),
      warmmiete: all.filter(r => r.status === 'aktiv').reduce((sum, r) => sum + r.kaltmiete + r.betriebskosten, 0),
      properties: new Set(all.map(r => r.objektId)).size,
    };
  }, [rows]);

  const toggleAll = useCallback(() => {
    if (expanded.size === grouped.length) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(grouped.map(g => g.objektId)));
    }
  }, [expanded.size, grouped]);

  const toggleGroup = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const statusBadge = (status: string) => {
    if (status === 'aktiv') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">Aktiv</Badge>;
    if (status === 'gekuendigt') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">Gekündigt</Badge>;
    return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px] px-1.5 py-0">Beendet</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Stammdaten werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="shrink-0 z-30 bg-background border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <TableProperties className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Stammdaten</h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">Einheiten, Mieter & Verträge bearbeiten</p>
              </div>
            </div>

            {/* Stats inline */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{stats.properties}</span>
                <span className="text-muted-foreground">Objekte</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{stats.aktiv}</span>
                <span className="text-muted-foreground">aktiv</span>
                {stats.gekuendigt > 0 && (
                  <span className="text-amber-600">+{stats.gekuendigt} gek.</span>
                )}
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{stats.warmmiete.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</span>
                <span className="text-muted-foreground">Warmmiete</span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input 
                  placeholder="Suchen..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="h-8 text-xs pl-8 w-[140px] sm:w-[200px]" 
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="gekuendigt">Gekündigt</SelectItem>
                  <SelectItem value="beendet">Beendet</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 text-xs hidden sm:flex" onClick={toggleAll}>
                {expanded.size === grouped.length ? 'Alle zuklappen' : 'Alle aufklappen'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Content - scrollable area */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1100px]">
          <table className="w-full caption-bottom text-sm">
            <thead className="sticky top-0 z-20 [&_tr]:border-b">
              <tr className="bg-muted border-b-2">
                <th className="w-8 text-[10px] font-bold py-2 px-2 h-12 text-left align-middle font-medium text-muted-foreground"></th>
                <th className="text-[10px] font-bold py-2 px-2 w-[50px] h-12 text-left align-middle text-muted-foreground">Einheit</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[50px] h-12 text-left align-middle text-muted-foreground">Etage</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[55px] h-12 text-left align-middle text-muted-foreground">m²</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[75px] h-12 text-left align-middle text-muted-foreground">Typ</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[65px] h-12 text-left align-middle text-muted-foreground">Status</th>
                <th className="text-[10px] font-bold py-2 px-2 h-12 text-left align-middle text-muted-foreground">Mieter</th>
                <th className="text-[10px] font-bold py-2 px-2 h-12 text-left align-middle text-muted-foreground">E-Mail</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[100px] h-12 text-left align-middle text-muted-foreground">Telefon</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[80px] text-right h-12 align-middle text-muted-foreground">Kaltmiete</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[60px] text-right h-12 align-middle text-muted-foreground">NK</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[80px] text-right h-12 align-middle text-muted-foreground">Warmmiete</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[40px] text-center h-12 align-middle text-muted-foreground">Pers</th>
                <th className="text-[10px] font-bold py-2 px-2 w-[85px] h-12 text-left align-middle text-muted-foreground">Beginn</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {grouped.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                    {search ? 'Keine Ergebnisse für diese Suche' : 'Keine Daten vorhanden'}
                  </TableCell>
                </TableRow>
              )}
              {grouped.map(group => {
                const isExpanded = expanded.has(group.objektId);
                const groupKaltmiete = group.contracts.reduce((s, r) => s + r.kaltmiete, 0);
                const groupWarmmiete = group.contracts.reduce((s, r) => s + r.kaltmiete + r.betriebskosten, 0);

                return (
                  <> 
                    {/* Property Group Header */}
                    <TableRow 
                      key={group.objektId} 
                      className="bg-muted/40 hover:bg-muted/60 cursor-pointer border-t-2 border-border/50"
                      onClick={() => toggleGroup(group.objektId)}
                    >
                      <TableCell className="py-2 px-2">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </TableCell>
                      <TableCell colSpan={8} className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-sm">{group.objektName}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {group.contracts.length} {group.contracts.length === 1 ? 'Einheit' : 'Einheiten'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right text-xs font-medium text-muted-foreground">
                        {groupKaltmiete.toFixed(0)} €
                      </TableCell>
                      <TableCell className="py-2 px-2" />
                      <TableCell className="py-2 px-2 text-right text-xs font-medium">
                        {groupWarmmiete.toFixed(0)} €
                      </TableCell>
                      <TableCell colSpan={2} className="py-2 px-2" />
                    </TableRow>

                    {/* Contract Rows */}
                    {isExpanded && group.contracts
                      .sort((a, b) => {
                        const aNum = parseInt(a.einheitId.slice(-2));
                        const bNum = parseInt(b.einheitId.slice(-2));
                        return aNum - bNum;
                      })
                      .map((row, idx) => (
                        <TableRow key={row.contractId} className="hover:bg-accent/30 border-b border-border/30">
                          <TableCell className="py-1 px-2 text-center text-[10px] text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <span className="text-xs font-mono text-muted-foreground">{row.einheitId.slice(-4)}</span>
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <EditCell rowId={row.einheitId} table="einheiten" field="etage" value={row.etage} />
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <EditCell rowId={row.einheitId} table="einheiten" field="qm" value={row.qm} type="qm" />
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <EditCell rowId={row.einheitId} table="einheiten" field="einheitentyp" value={row.typ} type="select-typ" />
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            {statusBadge(row.status)}
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <div className="space-y-0.5">
                              {(row.mieter || []).map((m, mi) => (
                                <div key={m.id || mi} className="flex gap-0.5">
                                  <EditCell rowId={m.id} table="mieter" field="vorname" value={m.vorname} />
                                  <EditCell rowId={m.id} table="mieter" field="nachname" value={m.nachname} />
                                </div>
                              ))}
                              {(!row.mieter || row.mieter.length === 0) && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <div className="space-y-0.5">
                              {(row.mieter || []).map((m, mi) => (
                                <EditCell key={m.id || mi} rowId={m.id} table="mieter" field="hauptmail" value={m.email} />
                              ))}
                              {(!row.mieter || row.mieter.length === 0) && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <div className="space-y-0.5">
                              {(row.mieter || []).map((m, mi) => (
                                <EditCell key={m.id || mi} rowId={m.id} table="mieter" field="telnr" value={m.telefon} />
                              ))}
                              {(!row.mieter || row.mieter.length === 0) && <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <EditCell rowId={row.contractId} table="mietvertrag" field="kaltmiete" value={row.kaltmiete} type="number" />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <EditCell rowId={row.contractId} table="mietvertrag" field="betriebskosten" value={row.betriebskosten} type="number" />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <span className="text-xs font-medium text-muted-foreground">
                              {(row.kaltmiete + row.betriebskosten).toFixed(2)} €
                            </span>
                          </TableCell>
                          <TableCell className="py-1 px-2 text-center">
                            <EditCell rowId={row.contractId} table="mietvertrag" field="anzahl_personen" value={row.anzahlPersonen} type="personen" />
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <EditCell rowId={row.contractId} table="mietvertrag" field="start_datum" value={row.mietbeginn} type="date" />
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rent Increase Confirmation Dialog */}
      <AlertDialog open={!!pendingKaltmiete} onOpenChange={(open) => {
        if (!open) {
          setPendingKaltmiete(null);
          setEditing(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mietänderung bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben die Kaltmiete von {pendingKaltmiete?.oldValue.toFixed(2)} € auf {pendingKaltmiete?.newValue.toFixed(2)} € geändert. Handelt es sich um eine offizielle Mieterhöhung?
              <br /><br />
              <strong>Ja:</strong> Das Datum der letzten Mieterhöhung wird automatisch auf heute gesetzt.
              <br />
              <strong>Nein:</strong> Die Miete wird nur korrigiert, ohne das Mieterhöhungsdatum zu ändern.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => {
              e.stopPropagation();
              setPendingKaltmiete(null);
              setEditing(null);
            }}>
              Abbrechen
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                if (pendingKaltmiete) {
                  saveField('mietvertrag', pendingKaltmiete.contractId, 'kaltmiete', pendingKaltmiete.newValue);
                  setPendingKaltmiete(null);
                }
              }}
            >
              Nein, nur Korrektur
            </Button>
            <AlertDialogAction onClick={(e) => {
              e.stopPropagation();
              if (pendingKaltmiete) {
                saveField('mietvertrag', pendingKaltmiete.contractId, 'kaltmiete', pendingKaltmiete.newValue, {
                  letzte_mieterhoehung_am: new Date().toISOString().split('T')[0],
                });
                setPendingKaltmiete(null);
              }
            }}>
              Ja, offizielle Mieterhöhung
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
