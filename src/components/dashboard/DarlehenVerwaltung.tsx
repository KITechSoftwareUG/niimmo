import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  ArrowLeft, Plus, Pencil, Trash2, Building2, Landmark, 
  TrendingDown, Calendar, Euro, Percent, ChevronDown, ChevronUp,
  TrendingUp, Wallet, Home, ClipboardPaste, FileText, Loader2, Check, AlertTriangle,
  ShieldAlert, BarChart3, ArrowUpDown, CreditCard, PiggyBank, Activity
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
  const [activeTab, setActiveTab] = useState("kredite");

  // Text Import state
  const [showTextImport, setShowTextImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showImportReview, setShowImportReview] = useState(false);
  const [importedData, setImportedData] = useState<any>(null);
  const [importedZahlungen, setImportedZahlungen] = useState<any[]>([]);
  const [importImmobilienIds, setImportImmobilienIds] = useState<string[]>([]);

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

  // Fetch all Immobilien
  const { data: immobilien } = useQuery({
    queryKey: ["immobilien-portfolio"],
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

  // Fetch Mietverträge for rental income
  const { data: mietvertraege } = useQuery({
    queryKey: ["mietvertraege-portfolio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mietvertrag")
        .select("id, kaltmiete, betriebskosten, einheit_id, status")
        .eq("status", "aktiv");
      if (error) throw error;
      return data;
    },
  });

  // Fetch Einheiten for mapping contracts to properties
  const { data: einheiten } = useQuery({
    queryKey: ["einheiten-portfolio"],
    queryFn: async () => {
      const { data, error } = await supabase.from("einheiten").select("id, immobilie_id");
      if (error) throw error;
      return data;
    },
  });

  // ── Mutations (kept from original) ──

  const saveMutation = useMutation({
    mutationFn: async (formData: DarlehenForm) => {
      const { immobilien_ids, ...rawData } = formData;
      const darlehenData = {
        ...rawData,
        start_datum: rawData.start_datum || null,
        ende_datum: rawData.ende_datum || null,
        bank: rawData.bank || null,
        kontonummer: rawData.kontonummer || null,
        notizen: rawData.notizen || null,
      };
      
      let darlehenId = editId;
      
      if (editId) {
        const { error } = await supabase.from("darlehen").update(darlehenData).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("darlehen").insert(darlehenData).select("id").single();
        if (error) throw error;
        darlehenId = data.id;
      }

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

  // Text Import handler
  const handleTextImport = async () => {
    if (!importText.trim() || importText.trim().length < 20) {
      toast.error("Bitte fügen Sie einen vollständigen Tilgungsplan ein (mindestens 20 Zeichen).");
      return;
    }
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-tilgungsplan-ocr', {
        body: { textContent: importText.trim() },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Verarbeitung fehlgeschlagen');
      const extracted = data.extractedData;
      setImportedData(extracted);
      setImportedZahlungen(extracted.zahlungen || []);
      setImportImmobilienIds([]);
      setShowTextImport(false);
      setShowImportReview(true);
      toast.success(`Tilgungsplan erkannt: ${extracted.zahlungen?.length || 0} Zahlungen extrahiert`);
    } catch (err: any) {
      console.error('Text Import Error:', err);
      toast.error('Import fehlgeschlagen: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const saveImportMutation = useMutation({
    mutationFn: async () => {
      if (!importedData) throw new Error('Keine Daten');
      const { zahlungen: _, restschuld_zinsbindungsende, ...loanData } = importedData;
      let notizen = loanData.notizen || '';
      if (restschuld_zinsbindungsende && typeof restschuld_zinsbindungsende === 'number' && restschuld_zinsbindungsende > 0) {
        const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(restschuld_zinsbindungsende);
        notizen = notizen ? `${notizen}\nRestschuld zum Zinsbindungsende: ${formatted}` : `Restschuld zum Zinsbindungsende: ${formatted}`;
      }
      const darlehenInsert = {
        bezeichnung: loanData.bezeichnung || 'Importiertes Darlehen',
        bank: loanData.bank || null,
        kontonummer: loanData.kontonummer || null,
        darlehensbetrag: Math.abs(loanData.darlehensbetrag || 0),
        restschuld: Math.abs(loanData.restschuld || 0),
        zinssatz_prozent: Math.abs(loanData.zinssatz_prozent || 0),
        tilgungssatz_prozent: Math.abs(loanData.tilgungssatz_prozent || 0),
        monatliche_rate: Math.abs(loanData.monatliche_rate || 0),
        start_datum: loanData.start_datum || null,
        ende_datum: loanData.ende_datum || null,
        notizen: notizen || null,
      };
      const { data: newDarlehen, error: dError } = await supabase
        .from('darlehen').insert(darlehenInsert).select('id').single();
      if (dError) throw dError;
      if (importImmobilienIds.length > 0) {
        const mappings = importImmobilienIds.map((immId) => ({
          darlehen_id: newDarlehen.id,
          immobilie_id: immId,
        }));
        await supabase.from('darlehen_immobilien').insert(mappings);
      }
      if (importedZahlungen.length > 0) {
        const zahlungenInserts = importedZahlungen.map((z: any) => ({
          darlehen_id: newDarlehen.id,
          buchungsdatum: z.buchungsdatum,
          betrag: z.betrag || 0,
          zinsanteil: z.zinsanteil || 0,
          tilgungsanteil: z.tilgungsanteil || 0,
          restschuld_danach: z.restschuld_danach ?? null,
        }));
        const { error: zError } = await supabase.from('darlehen_zahlungen').insert(zahlungenInserts);
        if (zError) throw zError;
      }
      return newDarlehen.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['darlehen'] });
      queryClient.invalidateQueries({ queryKey: ['darlehen-immobilien'] });
      queryClient.invalidateQueries({ queryKey: ['darlehen-zahlungen'] });
      toast.success('Darlehen mit Tilgungsplan importiert!');
      setShowImportReview(false);
      setImportedData(null);
      setImportedZahlungen([]);
    },
    onError: (err: any) => toast.error('Fehler beim Speichern: ' + err.message),
  });

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

  // ── Helper functions ──

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

  const getEffectiveRestschuld = (darlehenId: string, staticRestschuld: number | null): number => {
    const today = new Date().toISOString().split('T')[0];
    const zahlungen = darlehenZahlungen
      ?.filter((z) => z.darlehen_id === darlehenId && z.restschuld_danach != null && z.buchungsdatum <= today)
      ?.sort((a, b) => new Date(b.buchungsdatum).getTime() - new Date(a.buchungsdatum).getTime());
    if (zahlungen && zahlungen.length > 0) {
      return Math.abs(zahlungen[0].restschuld_danach!);
    }
    return Math.abs(staticRestschuld || 0);
  };

  // ── Portfolio Calculations ──

  const portfolioMetrics = useMemo(() => {
    const totalKaufpreis = immobilien?.reduce((s, i) => s + (i.kaufpreis || 0), 0) || 0;
    const totalRestschuld = darlehen?.reduce((s, d) => s + getEffectiveRestschuld(d.id, d.restschuld), 0) || 0;
    const totalDarlehensbetrag = darlehen?.reduce((s, d) => s + (d.darlehensbetrag || 0), 0) || 0;
    const totalMonatlicheRate = darlehen?.reduce((s, d) => s + (d.monatliche_rate || 0), 0) || 0;
    const eigenkapital = totalKaufpreis - totalRestschuld;
    const ltv = totalKaufpreis > 0 ? (totalRestschuld / totalKaufpreis) * 100 : 0;
    const totalGetilgt = Math.max(0, totalDarlehensbetrag - totalRestschuld);
    const tilgungsQuote = totalDarlehensbetrag > 0 ? Math.min(100, Math.max(0, (totalGetilgt / totalDarlehensbetrag) * 100)) : 0;

    // Weighted average interest rate
    const avgZinssatz = totalDarlehensbetrag > 0
      ? (darlehen?.reduce((s, d) => s + (d.zinssatz_prozent || 0) * (d.darlehensbetrag || 0), 0) || 0) / totalDarlehensbetrag
      : 0;

    // Monthly rental income from active contracts
    const totalMieteinnahmen = mietvertraege?.reduce((s, mv) => s + (mv.kaltmiete || 0) + (mv.betriebskosten || 0), 0) || 0;
    const totalKaltmiete = mietvertraege?.reduce((s, mv) => s + (mv.kaltmiete || 0), 0) || 0;

    const cashflow = totalMieteinnahmen - totalMonatlicheRate;

    // Per-property breakdown
    const propertyBreakdown = immobilien?.map(immo => {
      // Loans assigned to this property
      const assignedDarlehenIds = darlehenImmobilien
        ?.filter(di => di.immobilie_id === immo.id)
        .map(di => di.darlehen_id) || [];
      
      const assignedDarlehen = darlehen?.filter(d => assignedDarlehenIds.includes(d.id)) || [];
      
      // For each loan, check how many properties share it
      let propertyDebt = 0;
      let propertyMonthlyRate = 0;
      assignedDarlehen.forEach(d => {
        const allImmoCount = darlehenImmobilien?.filter(di => di.darlehen_id === d.id).length || 1;
        const effectiveRest = getEffectiveRestschuld(d.id, d.restschuld);
        propertyDebt += effectiveRest / allImmoCount;
        propertyMonthlyRate += (d.monatliche_rate || 0) / allImmoCount;
      });

      // Rental income for this property
      const propertyEinheiten = einheiten?.filter(e => e.immobilie_id === immo.id).map(e => e.id) || [];
      const propertyMietvertraege = mietvertraege?.filter(mv => propertyEinheiten.includes(mv.einheit_id)) || [];
      const propertyMieteinnahmen = propertyMietvertraege.reduce((s, mv) => s + (mv.kaltmiete || 0) + (mv.betriebskosten || 0), 0);
      const propertyKaltmiete = propertyMietvertraege.reduce((s, mv) => s + (mv.kaltmiete || 0), 0);

      const propertyEigenkapital = (immo.kaufpreis || 0) - propertyDebt;
      const propertyLtv = (immo.kaufpreis || 0) > 0 ? (propertyDebt / (immo.kaufpreis || 1)) * 100 : 0;
      const propertyCashflow = propertyMieteinnahmen - propertyMonthlyRate;

      // Gross yield: (annual rent / purchase price) * 100
      const bruttoRendite = (immo.kaufpreis || 0) > 0 ? ((propertyKaltmiete * 12) / (immo.kaufpreis || 1)) * 100 : 0;

      return {
        ...immo,
        schulden: propertyDebt,
        eigenkapital: propertyEigenkapital,
        ltv: propertyLtv,
        monatlicheRate: propertyMonthlyRate,
        mieteinnahmen: propertyMieteinnahmen,
        kaltmiete: propertyKaltmiete,
        cashflow: propertyCashflow,
        bruttoRendite,
        darlehen: assignedDarlehen,
      };
    }) || [];

    // Risk warnings
    const warnings: { type: 'high' | 'medium'; message: string; immobilie?: string }[] = [];
    if (ltv > 80) warnings.push({ type: 'high', message: `Beleihungsquote des Portfolios liegt bei ${ltv.toFixed(1)}% (über 80%)` });
    if (cashflow < 0) warnings.push({ type: 'high', message: `Negativer Cashflow: ${formatCurrency(cashflow)}/Monat` });
    
    propertyBreakdown.forEach(p => {
      if (p.ltv > 90) warnings.push({ type: 'high', message: `Hohe Beleihung: ${p.name} bei ${p.ltv.toFixed(0)}%`, immobilie: p.name });
      if (p.cashflow < 0) warnings.push({ type: 'medium', message: `Negativer Cashflow bei ${p.name}: ${formatCurrency(p.cashflow)}`, immobilie: p.name });
    });

    darlehen?.forEach(d => {
      if (d.ende_datum) {
        const endeDate = new Date(d.ende_datum);
        const monthsLeft = (endeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsLeft > 0 && monthsLeft < 12) {
          warnings.push({ type: 'medium', message: `Zinsbindung von "${d.bezeichnung}" endet in ${Math.round(monthsLeft)} Monaten` });
        }
      }
    });

    return {
      totalKaufpreis,
      totalRestschuld,
      totalDarlehensbetrag,
      totalMonatlicheRate,
      eigenkapital,
      ltv,
      totalGetilgt,
      tilgungsQuote,
      avgZinssatz,
      totalMieteinnahmen,
      totalKaltmiete,
      cashflow,
      propertyBreakdown,
      warnings,
      anzahlKredite: darlehen?.length || 0,
    };
  }, [darlehen, immobilien, darlehenImmobilien, darlehenZahlungen, mietvertraege, einheiten]);

  // ── RENDER ──

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">

        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="h-9 w-9 p-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Portfolio & Finanzierung</h1>
                <p className="text-xs text-muted-foreground">
                  {portfolioMetrics.anzahlKredite} {portfolioMetrics.anzahlKredite === 1 ? 'Kredit' : 'Kredite'} · {immobilien?.length || 0} Immobilien
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setImportText(""); setShowTextImport(true); }}>
                <ClipboardPaste className="h-4 w-4" />
                <span className="hidden sm:inline">Tilgungsplan einfügen</span>
              </Button>
              <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Neues Darlehen</span>
              </Button>
            </div>
          </div>
        </div>



        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="kredite" className="gap-1.5"><Landmark className="h-3.5 w-3.5" /> Kredite</TabsTrigger>
            <TabsTrigger value="uebersicht" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Immobilien</TabsTrigger>
          </TabsList>

          {/* ── Tab: Immobilienübersicht ── */}
          <TabsContent value="uebersicht">
            <div className="space-y-3">
              {portfolioMetrics.propertyBreakdown.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">Keine Immobilien vorhanden.</Card>
              ) : (
                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Immobilie</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Kaufpreis</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Schulden</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Eigenkapital</TableHead>
                        <TableHead className="text-xs font-semibold text-right">LTV</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Miete/Monat</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Rate/Monat</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Cashflow</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Rendite</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portfolioMetrics.propertyBreakdown.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.adresse}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">{formatCurrency(p.kaufpreis || 0)}</TableCell>
                          <TableCell className="text-xs text-right text-destructive font-medium">{formatCurrency(p.schulden)}</TableCell>
                          <TableCell className={`text-xs text-right font-bold ${p.eigenkapital >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                            {formatCurrency(p.eigenkapital)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Badge variant={p.ltv > 80 ? "destructive" : p.ltv > 60 ? "outline" : "secondary"} className="text-[10px]">
                              {p.ltv.toFixed(0)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(p.mieteinnahmen)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(p.monatlicheRate)}</TableCell>
                          <TableCell className={`text-xs text-right font-bold ${p.cashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                            {formatCurrency(p.cashflow)}
                          </TableCell>
                          <TableCell className="text-xs text-right">{p.bruttoRendite.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="text-xs">Gesamt ({portfolioMetrics.propertyBreakdown.length})</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(portfolioMetrics.totalKaufpreis)}</TableCell>
                        <TableCell className="text-xs text-right text-destructive">{formatCurrency(portfolioMetrics.totalRestschuld)}</TableCell>
                        <TableCell className={`text-xs text-right ${portfolioMetrics.eigenkapital >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                          {formatCurrency(portfolioMetrics.eigenkapital)}
                        </TableCell>
                        <TableCell className="text-xs text-right">{portfolioMetrics.ltv.toFixed(0)}%</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(portfolioMetrics.totalMieteinnahmen)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(portfolioMetrics.totalMonatlicheRate)}</TableCell>
                        <TableCell className={`text-xs text-right ${portfolioMetrics.cashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                          {formatCurrency(portfolioMetrics.cashflow)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {portfolioMetrics.totalKaufpreis > 0 ? ((portfolioMetrics.totalKaltmiete * 12 / portfolioMetrics.totalKaufpreis) * 100).toFixed(1) : '0.0'}%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Kreditübersicht ── */}
          <TabsContent value="kredite">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Wird geladen...</div>
            ) : darlehen && darlehen.length > 0 ? (
              <div className="space-y-3">
                {darlehen.map((d) => {
                  const assignedImmos = getImmobilienForDarlehen(d.id);
                  const zahlungen = getZahlungenForDarlehen(d.id);
                  const isExpanded = expandedId === d.id;
                  const effectiveRestschuld = getEffectiveRestschuld(d.id, d.restschuld);
                  const tilgungsfortschritt = d.darlehensbetrag > 0 
                    ? Math.min(100, Math.max(0, ((d.darlehensbetrag - effectiveRestschuld) / d.darlehensbetrag) * 100))
                    : 0;

                  return (
                    <Card key={d.id} className="overflow-hidden">
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
                              <span className="flex items-center gap-1"><Euro className="h-3 w-3" /> {formatCurrency(d.darlehensbetrag)}</span>
                              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Rest: {formatCurrency(effectiveRestschuld)}</span>
                              <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> {formatPercent(d.zinssatz_prozent || 0)}</span>
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatCurrency(d.monatliche_rate || 0)}/Monat</span>
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
                            {assignedImmos.length === 0 && (
                              <Badge variant="outline" className="text-[10px] mt-1.5 gap-1 text-muted-foreground">
                                <Wallet className="h-2.5 w-2.5" /> Unternehmenskredit (ohne Immobilie)
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-20 hidden sm:block">
                              <Progress value={tilgungsfortschritt} className="h-1.5" />
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
                <p className="text-sm text-muted-foreground/70 mb-4">Erstellen Sie Ihr erstes Darlehen.</p>
                <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Darlehen anlegen
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs (Create/Edit, Import, Review) ── */}

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
                <Input type="number" step="0.01" value={form.darlehensbetrag} onChange={(e) => setForm({ ...form, darlehensbetrag: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Restschuld (€)</Label>
                <Input type="number" step="0.01" value={form.restschuld} onChange={(e) => setForm({ ...form, restschuld: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Monatliche Rate (€)</Label>
                <Input type="number" step="0.01" value={form.monatliche_rate} onChange={(e) => setForm({ ...form, monatliche_rate: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Zinssatz (%)</Label>
                <Input type="number" step="0.01" value={form.zinssatz_prozent} onChange={(e) => setForm({ ...form, zinssatz_prozent: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Tilgungssatz (%)</Label>
                <Input type="number" step="0.01" value={form.tilgungssatz_prozent} onChange={(e) => setForm({ ...form, tilgungssatz_prozent: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
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
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.bezeichnung || saveMutation.isPending}>
              {saveMutation.isPending ? "Speichern..." : editId ? "Aktualisieren" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Review Dialog */}
      <Dialog open={showImportReview} onOpenChange={(open) => { if (!open) { setShowImportReview(false); setImportedData(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Tilgungsplan prüfen & importieren
            </DialogTitle>
          </DialogHeader>
          {importedData && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Bitte prüfen Sie die extrahierten Daten sorgfältig. KI-Extraktion kann Fehler enthalten.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
                  <Input value={importedData.bezeichnung || ''} onChange={(e) => setImportedData({ ...importedData, bezeichnung: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bank</Label>
                  <Input value={importedData.bank || ''} onChange={(e) => setImportedData({ ...importedData, bank: e.target.value })} className="text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Kontonummer/IBAN</Label>
                  <Input value={importedData.kontonummer || ''} onChange={(e) => setImportedData({ ...importedData, kontonummer: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Darlehensbetrag (€)</Label>
                  <Input type="number" step="0.01" value={importedData.darlehensbetrag ?? 0} onChange={(e) => setImportedData({ ...importedData, darlehensbetrag: parseFloat(e.target.value.replace(',', '.')) || 0 })} className="text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Restschuld (€)</Label>
                  <Input type="number" step="0.01" value={importedData.restschuld ?? 0} onChange={(e) => setImportedData({ ...importedData, restschuld: parseFloat(e.target.value.replace(',', '.')) || 0 })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zinssatz (%)</Label>
                  <Input type="number" step="0.01" value={importedData.zinssatz_prozent ?? 0} onChange={(e) => setImportedData({ ...importedData, zinssatz_prozent: parseFloat(e.target.value.replace(',', '.')) || 0 })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monatliche Rate (€)</Label>
                  <Input type="number" step="0.01" value={importedData.monatliche_rate ?? 0} onChange={(e) => setImportedData({ ...importedData, monatliche_rate: parseFloat(e.target.value.replace(',', '.')) || 0 })} className="text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Laufzeit von</Label>
                  <Input type="date" value={importedData.start_datum || ''} onChange={(e) => setImportedData({ ...importedData, start_datum: e.target.value })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Laufzeit bis</Label>
                  <Input type="date" value={importedData.ende_datum || ''} onChange={(e) => setImportedData({ ...importedData, ende_datum: e.target.value })} className="text-sm" />
                </div>
              </div>
              {importedData.notizen && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notizen</Label>
                  <Textarea value={importedData.notizen || ''} onChange={(e) => setImportedData({ ...importedData, notizen: e.target.value })} rows={2} className="text-sm" />
                </div>
              )}
              <div>
                <Label className="text-xs mb-2 block">Zugeordnete Immobilien</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                  {immobilien?.map((immo) => (
                    <label key={immo.id} className="flex items-center gap-2 text-xs hover:bg-muted/50 p-1 rounded cursor-pointer">
                      <Checkbox
                        checked={importImmobilienIds.includes(immo.id)}
                        onCheckedChange={(checked) => {
                          setImportImmobilienIds(checked ? [...importImmobilienIds, immo.id] : importImmobilienIds.filter((id) => id !== immo.id));
                        }}
                      />
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span>{immo.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-4 w-4" /> Tilgungsplan ({importedZahlungen.length} Zahlungen)
                </h4>
                {importedZahlungen.length > 0 ? (
                  <div className="rounded-md border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Datum</TableHead>
                          <TableHead className="text-xs">Rate</TableHead>
                          <TableHead className="text-xs">Zinsen</TableHead>
                          <TableHead className="text-xs">Tilgung</TableHead>
                          <TableHead className="text-xs">Restschuld</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedZahlungen.map((z: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{z.buchungsdatum ? new Date(z.buchungsdatum).toLocaleDateString('de-DE') : '–'}</TableCell>
                            <TableCell className="text-xs font-medium">{formatCurrency(z.betrag || 0)}</TableCell>
                            <TableCell className="text-xs text-destructive">{formatCurrency(z.zinsanteil || 0)}</TableCell>
                            <TableCell className="text-xs text-primary">{formatCurrency(z.tilgungsanteil || 0)}</TableCell>
                            <TableCell className="text-xs">{z.restschuld_danach != null ? formatCurrency(z.restschuld_danach) : '–'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Keine Zahlungen gefunden.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportReview(false); setImportedData(null); }}>Abbrechen</Button>
            <Button onClick={() => saveImportMutation.mutate()} disabled={saveImportMutation.isPending || !importedData?.bezeichnung} className="gap-1.5">
              {saveImportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saveImportMutation.isPending ? "Wird gespeichert..." : "Darlehen importieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Import Dialog */}
      <Dialog open={showTextImport} onOpenChange={(open) => { if (!open) setShowTextImport(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-primary" />
              Tilgungsplan einfügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kopieren Sie den Tilgungsplan aus Ihrem Bankdokument und fügen Sie ihn hier ein.
            </p>
            <div>
              <Label className="text-xs">Tilgungsplan-Text</Label>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Beispiel:\n\nDarlehen: KFW 124, IBAN DE49 2559...\nDarlehensbetrag: 116.000,00 EUR\nZinssatz: 0,76% p.a.\nRate: 363,33 EUR/Monat\n\nDatum        Rate      Zinsen    Tilgung   Restschuld\n30.10.2021   363,33    73,47     289,86    115.710,14\n...`}
                rows={14}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {importText.length > 0 ? `${importText.length} Zeichen` : "Mindestens 20 Zeichen erforderlich"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTextImport(false)}>Abbrechen</Button>
            <Button onClick={handleTextImport} disabled={isImporting || importText.trim().length < 20} className="gap-1.5">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isImporting ? "KI analysiert..." : "Analysieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── KPI Card Component ──

function KpiCard({ icon: Icon, label, value, variant }: {
  icon: any;
  label: string;
  value: string;
  variant?: 'destructive' | 'success' | 'warning';
}) {
  const colorClass = variant === 'destructive' 
    ? 'text-destructive' 
    : variant === 'success' 
      ? 'text-emerald-600 dark:text-emerald-400' 
      : variant === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground';

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-lg sm:text-xl font-bold ${colorClass}`}>{value}</p>
    </Card>
  );
}
