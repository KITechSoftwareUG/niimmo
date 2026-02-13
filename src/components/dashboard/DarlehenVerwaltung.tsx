import { useState, useMemo, useRef } from "react";
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
  PieChart, TrendingUp, Wallet, Home, Shield, Upload, FileText, Loader2, Check, AlertTriangle
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

  // PDF Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // PDF Import handler
  const handlePdfImport = async (file: File) => {
    setIsImporting(true);
    try {
      let textContent = '';
      let base64 = '';

      if (file.type === 'application/pdf') {
        // Extract text from PDF
        try {
          let pdfjsLib: any;
          try {
            pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
          } catch (e) {
            pdfjsLib = await import('pdfjs-dist/build/pdf');
          }
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
              'pdfjs-dist/legacy/build/pdf.worker.min.js',
              import.meta.url
            ).toString();
          }
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = Math.min(pdf.numPages, 10);
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            textContent += '\n\n' + tc.items.map((item: any) => item.str).join(' ');
          }
          textContent = textContent.trim();
        } catch (e) {
          console.warn('PDF text extraction failed:', e);
        }
      }

      // If no text extracted, convert to base64 image
      if (!textContent || textContent.length < 30) {
        const reader = new FileReader();
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(',');
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const effectiveFileType = (!textContent || textContent.length < 30) ? 'image/png' : file.type;

      const { data, error } = await supabase.functions.invoke('process-tilgungsplan-ocr', {
        body: {
          fileName: file.name,
          fileType: effectiveFileType,
          fileContent: base64,
          textContent: textContent,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Verarbeitung fehlgeschlagen');

      const extracted = data.extractedData;
      setImportedData(extracted);
      setImportedZahlungen(extracted.zahlungen || []);
      setImportImmobilienIds([]);
      setShowImportReview(true);
      toast.success(`Tilgungsplan erkannt: ${extracted.zahlungen?.length || 0} Zahlungen extrahiert`);
    } catch (err: any) {
      console.error('PDF Import Error:', err);
      toast.error('PDF-Import fehlgeschlagen: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save imported darlehen + zahlungen
  const saveImportMutation = useMutation({
    mutationFn: async () => {
      if (!importedData) throw new Error('Keine Daten');

      const { zahlungen: _, ...loanData } = importedData;
      const darlehenInsert = {
        bezeichnung: loanData.bezeichnung || 'Importiertes Darlehen',
        bank: loanData.bank || null,
        kontonummer: loanData.kontonummer || null,
        darlehensbetrag: loanData.darlehensbetrag || 0,
        restschuld: loanData.restschuld || 0,
        zinssatz_prozent: loanData.zinssatz_prozent || 0,
        tilgungssatz_prozent: loanData.tilgungssatz_prozent || 0,
        monatliche_rate: loanData.monatliche_rate || 0,
        start_datum: loanData.start_datum || null,
        ende_datum: loanData.ende_datum || null,
        notizen: loanData.notizen || null,
      };

      const { data: newDarlehen, error: dError } = await supabase
        .from('darlehen')
        .insert(darlehenInsert)
        .select('id')
        .single();
      if (dError) throw dError;

      // Save immobilien assignments
      if (importImmobilienIds.length > 0) {
        const mappings = importImmobilienIds.map((immId) => ({
          darlehen_id: newDarlehen.id,
          immobilie_id: immId,
        }));
        await supabase.from('darlehen_immobilien').insert(mappings);
      }

      // Save Zahlungen
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
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfImport(file);
                }}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isImporting ? "Wird analysiert..." : "PDF importieren"}
              </Button>
              <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Neues Darlehen
              </Button>
            </div>
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

      {/* Import Review Modal */}
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
              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Bitte prüfen Sie die extrahierten Daten sorgfältig. KI-Extraktion kann Fehler enthalten.
                </p>
              </div>

              {/* Loan Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
                  <Input 
                    value={importedData.bezeichnung || ''} 
                    onChange={(e) => setImportedData({ ...importedData, bezeichnung: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bank</Label>
                  <Input 
                    value={importedData.bank || ''} 
                    onChange={(e) => setImportedData({ ...importedData, bank: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Kontonummer/IBAN</Label>
                  <Input 
                    value={importedData.kontonummer || ''} 
                    onChange={(e) => setImportedData({ ...importedData, kontonummer: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Darlehensbetrag (€)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={importedData.darlehensbetrag || ''} 
                    onChange={(e) => setImportedData({ ...importedData, darlehensbetrag: parseFloat(e.target.value) || 0 })}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Restschuld (€)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={importedData.restschuld || ''} 
                    onChange={(e) => setImportedData({ ...importedData, restschuld: parseFloat(e.target.value) || 0 })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zinssatz (%)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={importedData.zinssatz_prozent || ''} 
                    onChange={(e) => setImportedData({ ...importedData, zinssatz_prozent: parseFloat(e.target.value) || 0 })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monatliche Rate (€)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={importedData.monatliche_rate || ''} 
                    onChange={(e) => setImportedData({ ...importedData, monatliche_rate: parseFloat(e.target.value) || 0 })}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Laufzeit von</Label>
                  <Input 
                    type="date"
                    value={importedData.start_datum || ''} 
                    onChange={(e) => setImportedData({ ...importedData, start_datum: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Laufzeit bis</Label>
                  <Input 
                    type="date"
                    value={importedData.ende_datum || ''} 
                    onChange={(e) => setImportedData({ ...importedData, ende_datum: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              {importedData.notizen && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notizen</Label>
                  <Textarea 
                    value={importedData.notizen || ''} 
                    onChange={(e) => setImportedData({ ...importedData, notizen: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Immobilien Assignment */}
              <div>
                <Label className="text-xs mb-2 block">Zugeordnete Immobilien</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                  {immobilien?.map((immo) => (
                    <label key={immo.id} className="flex items-center gap-2 text-xs hover:bg-muted/50 p-1 rounded cursor-pointer">
                      <Checkbox
                        checked={importImmobilienIds.includes(immo.id)}
                        onCheckedChange={(checked) => {
                          setImportImmobilienIds(
                            checked
                              ? [...importImmobilienIds, immo.id]
                              : importImmobilienIds.filter((id) => id !== immo.id)
                          );
                        }}
                      />
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span>{immo.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Zahlungen Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4" />
                    Tilgungsplan ({importedZahlungen.length} Zahlungen)
                  </h4>
                </div>
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
                  <p className="text-xs text-muted-foreground">Keine Zahlungen im Tilgungsplan gefunden.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportReview(false); setImportedData(null); }}>
              Abbrechen
            </Button>
            <Button 
              onClick={() => saveImportMutation.mutate()} 
              disabled={saveImportMutation.isPending || !importedData?.bezeichnung}
              className="gap-1.5"
            >
              {saveImportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saveImportMutation.isPending ? "Wird gespeichert..." : "Darlehen importieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
