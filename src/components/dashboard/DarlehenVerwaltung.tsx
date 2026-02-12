import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  ArrowLeft, Plus, Pencil, Trash2, Building2, Landmark, 
  TrendingDown, Calendar, Euro, Percent, ChevronDown, ChevronUp,
  PieChart, TrendingUp, Wallet, Home, Shield
} from "lucide-react";

interface DarlehenVerwaltungProps {
  onBack: () => void;
}

interface DarlehenForm {
  bezeichnung: string;
  bank: string;
  kontonummer: string;
  darlehensbetrag: number;
  restschuld: number;
  zinssatz_prozent: number;
  tilgungssatz_prozent: number;
  monatliche_rate: number;
  start_datum: string;
  ende_datum: string;
  notizen: string;
  immobilien_ids: string[];
}

const emptyForm: DarlehenForm = {
  bezeichnung: "",
  bank: "",
  kontonummer: "",
  darlehensbetrag: 0,
  restschuld: 0,
  zinssatz_prozent: 0,
  tilgungssatz_prozent: 0,
  monatliche_rate: 0,
  start_datum: "",
  ende_datum: "",
  notizen: "",
  immobilien_ids: [],
};

export const DarlehenVerwaltung = ({ onBack }: DarlehenVerwaltungProps) => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DarlehenForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch all Darlehen
  const { data: darlehen, isLoading } = useQuery({
    queryKey: ["darlehen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("darlehen")
        .select("*")
        .order("erstellt_am", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all Immobilien for assignment
  const { data: immobilien } = useQuery({
    queryKey: ["immobilien"],
    queryFn: async () => {
      const { data, error } = await supabase.from("immobilien").select("id, name, adresse, kaufpreis").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch Darlehen-Immobilien mappings
  const { data: darlehenImmobilien } = useQuery({
    queryKey: ["darlehen-immobilien"],
    queryFn: async () => {
      const { data, error } = await supabase.from("darlehen_immobilien").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch Darlehen-Zahlungen
  const { data: darlehenZahlungen } = useQuery({
    queryKey: ["darlehen-zahlungen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("darlehen_zahlungen")
        .select("*")
        .order("buchungsdatum", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: DarlehenForm) => {
      const { immobilien_ids, ...darlehenData } = formData;
      
      let darlehenId = editId;
      
      if (editId) {
        const { error } = await supabase.from("darlehen").update(darlehenData).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("darlehen").insert(darlehenData).select("id").single();
        if (error) throw error;
        darlehenId = data.id;
      }

      // Sync immobilien assignments
      if (darlehenId) {
        await supabase.from("darlehen_immobilien").delete().eq("darlehen_id", darlehenId);
        if (immobilien_ids.length > 0) {
          const mappings = immobilien_ids.map((immId) => ({
            darlehen_id: darlehenId!,
            immobilie_id: immId,
          }));
          const { error: mapError } = await supabase.from("darlehen_immobilien").insert(mappings);
          if (mapError) throw mapError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["darlehen"] });
      queryClient.invalidateQueries({ queryKey: ["darlehen-immobilien"] });
      toast.success(editId ? "Darlehen aktualisiert" : "Darlehen erstellt");
      resetForm();
    },
    onError: (err: any) => toast.error("Fehler: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("darlehen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["darlehen"] });
      queryClient.invalidateQueries({ queryKey: ["darlehen-immobilien"] });
      queryClient.invalidateQueries({ queryKey: ["darlehen-zahlungen"] });
      toast.success("Darlehen gelöscht");
    },
    onError: (err: any) => toast.error("Fehler: " + err.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (d: any) => {
    const assignedIds = darlehenImmobilien?.filter((di) => di.darlehen_id === d.id).map((di) => di.immobilie_id) || [];
    setForm({
      bezeichnung: d.bezeichnung || "",
      bank: d.bank || "",
      kontonummer: d.kontonummer || "",
      darlehensbetrag: d.darlehensbetrag || 0,
      restschuld: d.restschuld || 0,
      zinssatz_prozent: d.zinssatz_prozent || 0,
      tilgungssatz_prozent: d.tilgungssatz_prozent || 0,
      monatliche_rate: d.monatliche_rate || 0,
      start_datum: d.start_datum || "",
      ende_datum: d.ende_datum || "",
      notizen: d.notizen || "",
      immobilien_ids: assignedIds,
    });
    setEditId(d.id);
    setShowForm(true);
  };

  const getImmobilienForDarlehen = (darlehenId: string) => {
    const ids = darlehenImmobilien?.filter((di) => di.darlehen_id === darlehenId).map((di) => di.immobilie_id) || [];
    return immobilien?.filter((i) => ids.includes(i.id)) || [];
  };

  const getZahlungenForDarlehen = (darlehenId: string) => {
    return darlehenZahlungen?.filter((dz) => dz.darlehen_id === darlehenId) || [];
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);

  const formatPercent = (val: number) => `${val.toFixed(2)}%`;

  // Summary stats
  const totalDarlehensbetrag = darlehen?.reduce((s, d) => s + (d.darlehensbetrag || 0), 0) || 0;
  const totalRestschuld = darlehen?.reduce((s, d) => s + (d.restschuld || 0), 0) || 0;
  const totalMonatlicheRate = darlehen?.reduce((s, d) => s + (d.monatliche_rate || 0), 0) || 0;
  const avgZinssatz = darlehen && darlehen.length > 0 
    ? darlehen.reduce((s, d) => s + (d.zinssatz_prozent || 0), 0) / darlehen.length 
    : 0;

  // Portfolio metrics
  const totalKaufpreis = immobilien?.reduce((s, i) => s + (i.kaufpreis || 0), 0) || 0;
  const totalGetilgt = totalDarlehensbetrag - totalRestschuld;
  const eigenkapitalQuote = totalKaufpreis > 0 ? ((totalKaufpreis - totalRestschuld) / totalKaufpreis) * 100 : 0;
  const tilgungsQuote = totalDarlehensbetrag > 0 ? (totalGetilgt / totalDarlehensbetrag) * 100 : 0;
  const anzahlKredite = darlehen?.length || 0;

  // Circular progress helper
  const CircularProgress = ({ percent, size = 120, strokeWidth = 10, color = "hsl(var(--primary))" }: { percent: number; size?: number; strokeWidth?: number; color?: string }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="h-9 w-9 p-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Finanzierung & Portfolio</h1>
                <p className="text-xs text-muted-foreground">{anzahlKredite} {anzahlKredite === 1 ? 'Kredit' : 'Kredite'} · {immobilien?.length || 0} Immobilien</p>
              </div>
            </div>
            <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Neues Darlehen
            </Button>
          </div>
        </div>

        {/* Hero Portfolio Card */}
        <Card className="p-0 overflow-hidden mb-6">
          <div className="bg-gradient-to-br from-primary/5 via-card to-primary/3 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Key Numbers */}
              <div className="lg:col-span-2 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {/* Immobilienwert */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Home className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Immobilienwert</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalKaufpreis)}</p>
                  </div>
                  {/* Gesamtschuld */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Restschuld</span>
                    </div>
                    <p className="text-2xl font-bold text-destructive">{formatCurrency(totalRestschuld)}</p>
                  </div>
                  {/* Bereits getilgt */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Bereits getilgt</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'hsl(152, 69%, 31%)' }}>{formatCurrency(totalGetilgt)}</p>
                  </div>
                </div>

                {/* Progress Bar: Tilgungsfortschritt */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Gesamter Tilgungsfortschritt</span>
                    <span className="text-xs font-bold text-foreground">{tilgungsQuote.toFixed(1)}%</span>
                  </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(tilgungsQuote, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground">Volumen: {formatCurrency(totalDarlehensbetrag)}</span>
                    <span className="text-[10px] text-muted-foreground">Offen: {formatCurrency(totalRestschuld)}</span>
                  </div>
                </div>

                {/* Bottom metrics row */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 border">
                    <Euro className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Monatl. Belastung</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(totalMonatlicheRate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 border">
                    <Percent className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Ø Zinssatz</p>
                      <p className="text-sm font-bold text-foreground">{formatPercent(avgZinssatz)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 border">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Jährl. Belastung</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(totalMonatlicheRate * 12)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Eigenkapital Ring */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  <CircularProgress percent={eigenkapitalQuote} size={140} strokeWidth={12} color="hsl(var(--primary))" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Shield className="h-5 w-5 text-primary mb-0.5" />
                    <span className="text-2xl font-bold text-foreground">{eigenkapitalQuote.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground font-medium">Eigenkapital</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  {formatCurrency(totalKaufpreis - totalRestschuld)} von {formatCurrency(totalKaufpreis)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Darlehen List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Wird geladen...</div>
        ) : darlehen && darlehen.length > 0 ? (
          <div className="space-y-3">
            {darlehen.map((d) => {
              const assignedImmos = getImmobilienForDarlehen(d.id);
              const zahlungen = getZahlungenForDarlehen(d.id);
              const isExpanded = expandedId === d.id;
              const tilgungsfortschritt = d.darlehensbetrag > 0 
                ? ((d.darlehensbetrag - (d.restschuld || 0)) / d.darlehensbetrag) * 100 
                : 0;

              return (
                <Card key={d.id} className="overflow-hidden">
                  {/* Main Row */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{d.bezeichnung}</h3>
                          {d.bank && <Badge variant="outline" className="text-[10px] shrink-0">{d.bank}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Euro className="h-3 w-3" /> {formatCurrency(d.darlehensbetrag)}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Rest: {formatCurrency(d.restschuld || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" /> {formatPercent(d.zinssatz_prozent || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Rate: {formatCurrency(d.monatliche_rate || 0)}/Monat
                          </span>
                        </div>
                        {assignedImmos.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {assignedImmos.map((immo) => (
                              <Badge key={immo.id} variant="secondary" className="text-[10px] gap-1">
                                <Building2 className="h-2.5 w-2.5" /> {immo.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Progress bar */}
                        <div className="w-20 hidden sm:block">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(tilgungsfortschritt, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                            {tilgungsfortschritt.toFixed(0)}% getilgt
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { 
                          e.stopPropagation(); 
                          if (confirm("Darlehen wirklich löschen?")) deleteMutation.mutate(d.id); 
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Payment History */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Kontonr.</p>
                          <p className="text-xs font-medium">{d.kontonummer || "–"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Tilgungssatz</p>
                          <p className="text-xs font-medium">{formatPercent(d.tilgungssatz_prozent || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Laufzeit von</p>
                          <p className="text-xs font-medium">{d.start_datum ? new Date(d.start_datum).toLocaleDateString("de-DE") : "–"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Laufzeit bis</p>
                          <p className="text-xs font-medium">{d.ende_datum ? new Date(d.ende_datum).toLocaleDateString("de-DE") : "–"}</p>
                        </div>
                      </div>
                      {d.notizen && (
                        <p className="text-xs text-muted-foreground mb-3 italic">{d.notizen}</p>
                      )}
                      <h4 className="text-xs font-semibold mb-2">Zahlungen ({zahlungen.length})</h4>
                      {zahlungen.length > 0 ? (
                        <div className="rounded-md border overflow-auto max-h-60">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Datum</TableHead>
                                <TableHead className="text-xs">Betrag</TableHead>
                                <TableHead className="text-xs">Zinsanteil</TableHead>
                                <TableHead className="text-xs">Tilgung</TableHead>
                                <TableHead className="text-xs">Restschuld</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {zahlungen.map((z) => (
                                <TableRow key={z.id}>
                                  <TableCell className="text-xs">{new Date(z.buchungsdatum).toLocaleDateString("de-DE")}</TableCell>
                                  <TableCell className="text-xs font-medium">{formatCurrency(z.betrag)}</TableCell>
                                  <TableCell className="text-xs text-destructive">{formatCurrency(z.zinsanteil || 0)}</TableCell>
                                  <TableCell className="text-xs text-primary">{formatCurrency(z.tilgungsanteil || 0)}</TableCell>
                                  <TableCell className="text-xs">{z.restschuld_danach != null ? formatCurrency(z.restschuld_danach) : "–"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Noch keine Zahlungen zugeordnet.</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Landmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">Keine Darlehen vorhanden</h3>
            <p className="text-sm text-muted-foreground/70 mb-4">Erstellen Sie Ihr erstes Darlehen, um Ihre Finanzierungen zu verwalten.</p>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Darlehen anlegen
            </Button>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Darlehen bearbeiten" : "Neues Darlehen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bezeichnung *</Label>
                <Input value={form.bezeichnung} onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })} placeholder="z.B. Sparkasse Darlehen 1" />
              </div>
              <div>
                <Label className="text-xs">Bank</Label>
                <Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="z.B. Sparkasse" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kontonummer</Label>
                <Input value={form.kontonummer} onChange={(e) => setForm({ ...form, kontonummer: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Darlehensbetrag (€)</Label>
                <Input type="number" step="0.01" value={form.darlehensbetrag || ""} onChange={(e) => setForm({ ...form, darlehensbetrag: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Restschuld (€)</Label>
                <Input type="number" step="0.01" value={form.restschuld || ""} onChange={(e) => setForm({ ...form, restschuld: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Monatliche Rate (€)</Label>
                <Input type="number" step="0.01" value={form.monatliche_rate || ""} onChange={(e) => setForm({ ...form, monatliche_rate: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Zinssatz (%)</Label>
                <Input type="number" step="0.01" value={form.zinssatz_prozent || ""} onChange={(e) => setForm({ ...form, zinssatz_prozent: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Tilgungssatz (%)</Label>
                <Input type="number" step="0.01" value={form.tilgungssatz_prozent || ""} onChange={(e) => setForm({ ...form, tilgungssatz_prozent: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Laufzeit von</Label>
                <Input type="date" value={form.start_datum} onChange={(e) => setForm({ ...form, start_datum: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Laufzeit bis</Label>
                <Input type="date" value={form.ende_datum} onChange={(e) => setForm({ ...form, ende_datum: e.target.value })} />
              </div>
            </div>

            {/* Immobilien Assignment (n-to-n) */}
            <div>
              <Label className="text-xs mb-2 block">Zugeordnete Immobilien (optional)</Label>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {immobilien?.map((immo) => (
                  <label key={immo.id} className="flex items-center gap-2 text-xs hover:bg-muted/50 p-1 rounded cursor-pointer">
                    <Checkbox
                      checked={form.immobilien_ids.includes(immo.id)}
                      onCheckedChange={(checked) => {
                        setForm({
                          ...form,
                          immobilien_ids: checked
                            ? [...form.immobilien_ids, immo.id]
                            : form.immobilien_ids.filter((id) => id !== immo.id),
                        });
                      }}
                    />
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span>{immo.name}</span>
                    <span className="text-muted-foreground truncate">– {immo.adresse}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Notizen</Label>
              <Textarea value={form.notizen} onChange={(e) => setForm({ ...form, notizen: e.target.value })} rows={2} placeholder="Optionale Notizen..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Abbrechen</Button>
            <Button 
              onClick={() => saveMutation.mutate(form)} 
              disabled={!form.bezeichnung || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Speichern..." : editId ? "Aktualisieren" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
