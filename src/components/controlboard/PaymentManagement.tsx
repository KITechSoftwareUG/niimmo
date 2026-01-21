import { useState, useMemo } from "react";
import { ArrowLeft, Upload, Search, FileText, Calendar, Bot, Euro, Building2, Home, User, Edit2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AssignPaymentDialog } from "./AssignPaymentDialog";
import { PaymentAssignmentResultsModal } from "./PaymentAssignmentResultsModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCsvUploadProgress } from "@/hooks/useCsvUploadProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NebenkostenZuordnungTab } from "./NebenkostenZuordnungTab";

interface PaymentManagementProps {
  onBack: () => void;
}

interface ProcessedPayment {
  buchungsdatum: string;
  betrag: number;
  iban: string;
  verwendungszweck: string;
  empfaengername?: string;
  mietvertrag_id: string | null;
  kategorie: string;
  zuordnungsgrund: string;
  confidence: number;
  mieter_name?: string;
  immobilie_name?: string;
}

interface AIAssignmentStats {
  total: number;
  neue: number;
  duplikate: number;
  zugeordnet: number;
  nicht_zugeordnet: number;
  nach_kategorie: {
    miete: number;
    mietkaution: number;
    ruecklastschrift: number;
    nichtmiete: number;
  };
  durchschnittliche_konfidenz: number;
}

interface DuplicatePayment {
  buchungsdatum: string;
  betrag: number;
  iban: string;
  verwendungszweck: string;
  empfaengername?: string;
  existingId: string;
}

interface ZahlungWithDetails {
  id: string;
  betrag: number;
  buchungsdatum: string;
  verwendungszweck: string | null;
  empfaengername: string | null;
  iban: string | null;
  zugeordneter_monat: string | null;
  kategorie: string | null;
  mietvertrag_id: string | null;
  immobilie_id: string | null;
  immobilie_name: string | null;
  immobilie_adresse: string | null;
  einheit_id: string | null;
  einheit_typ: string | null;
  mieter_name: string | null;
}

export function PaymentManagement({ onBack }: PaymentManagementProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  // AI Assignment Results State
  const [aiResults, setAiResults] = useState<ProcessedPayment[]>([]);
  const [aiDuplicates, setAiDuplicates] = useState<DuplicatePayment[]>([]);
  const [aiStats, setAiStats] = useState<AIAssignmentStats | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  
  // Zahlungsübersicht State
  const [selectedZahlungId, setSelectedZahlungId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'datum-desc' | 'datum-asc' | 'betrag-desc' | 'betrag-asc' | 'status' | 'kategorie'>('datum-desc');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedKategorie, setSelectedKategorie] = useState<string | null>(null);
  const [showOnlyZugeordnet, setShowOnlyZugeordnet] = useState(false);
  const [showOnlyNichtZugeordnet, setShowOnlyNichtZugeordnet] = useState(false);
  const [allPaymentsSearchTerm, setAllPaymentsSearchTerm] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isProcessing, setProcessing, reset: resetProgress } = useCsvUploadProgress();

  // Fetch last CSV upload info
  const { data: lastUpload } = useQuery({
    queryKey: ['last-csv-upload'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('csv_uploads')
        .select('*')
        .order('hochgeladen_am', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch unassigned payments (for the "Nicht zugeordnete" tab)
  const { data: unassignedPayments, isLoading: unassignedLoading } = useQuery({
    queryKey: ['unassigned-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .is('mietvertrag_id', null)
        .in('kategorie', ['Miete', 'Mietkaution', 'Rücklastschrift'])
        .order('buchungsdatum', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL payments with details (for the "Alle Zahlungen" tab)
  const { data: allPayments, isLoading: allPaymentsLoading } = useQuery({
    queryKey: ['zahlungen-overview'],
    queryFn: async () => {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('zahlungen')
        .select('*')
        .order('buchungsdatum', { ascending: false });

      if (paymentsError) throw paymentsError;

      const transformed: ZahlungWithDetails[] = await Promise.all(
        (paymentsData || []).map(async (zahlung: any) => {
          let immobilie_name = null;
          let immobilie_adresse = null;
          let einheit_id = null;
          let einheit_typ = null;
          let mieter_name = null;

          if (zahlung.mietvertrag_id) {
            const { data: contractData } = await supabase
              .from('mietvertrag')
              .select(`
                einheit_id,
                einheiten:einheit_id (
                  id,
                  einheitentyp,
                  immobilie_id,
                  immobilien:immobilie_id (
                    name,
                    adresse
                  )
                )
              `)
              .eq('id', zahlung.mietvertrag_id)
              .single();

            if (contractData) {
              const einheit = contractData.einheiten;
              const immobilie = einheit?.immobilien;
              
              einheit_id = einheit?.id || null;
              einheit_typ = einheit?.einheitentyp || null;
              immobilie_name = immobilie?.name || null;
              immobilie_adresse = immobilie?.adresse || null;

              const { data: mieterData } = await supabase
                .from('mietvertrag_mieter')
                .select(`
                  mieter:mieter_id (
                    vorname,
                    nachname
                  )
                `)
                .eq('mietvertrag_id', zahlung.mietvertrag_id);

              if (mieterData && mieterData.length > 0) {
                const mieter = mieterData[0].mieter;
                mieter_name = mieter ? `${mieter.vorname} ${mieter.nachname}` : null;
              }
            }
          } else if (zahlung.immobilie_id) {
            const { data: propertyData } = await supabase
              .from('immobilien')
              .select('name, adresse')
              .eq('id', zahlung.immobilie_id)
              .single();

            if (propertyData) {
              immobilie_name = propertyData.name;
              immobilie_adresse = propertyData.adresse;
            }
          }

          return {
            id: zahlung.id,
            betrag: zahlung.betrag,
            buchungsdatum: zahlung.buchungsdatum,
            verwendungszweck: zahlung.verwendungszweck,
            empfaengername: zahlung.empfaengername,
            iban: zahlung.iban,
            zugeordneter_monat: zahlung.zugeordneter_monat,
            kategorie: zahlung.kategorie,
            mietvertrag_id: zahlung.mietvertrag_id,
            immobilie_id: zahlung.immobilie_id,
            immobilie_name,
            immobilie_adresse,
            einheit_id,
            einheit_typ,
            mieter_name,
          };
        })
      );

      return transformed;
    },
  });

  // Filter for unassigned payments (simple table)
  const filteredUnassignedPayments = unassignedPayments?.filter(payment => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase().trim();
    
    return (
      payment.iban?.toLowerCase().includes(search) ||
      payment.empfaengername?.toLowerCase().includes(search) ||
      payment.verwendungszweck?.toLowerCase().includes(search) ||
      payment.kategorie?.toLowerCase().includes(search) ||
      payment.zugeordneter_monat?.toLowerCase().includes(search) ||
      payment.betrag?.toString().includes(search) ||
      format(new Date(payment.buchungsdatum), 'dd.MM.yyyy').includes(search)
    );
  });

  // Filtering and sorting for all payments
  const uniqueKategorien = allPayments 
    ? Array.from(new Set(allPayments.map(z => z.kategorie || 'Keine Kategorie'))).sort()
    : [];

  const filteredAllPayments = useMemo(() => {
    if (!allPayments) return [];
    
    return allPayments.filter((zahlung) => {
      // Search filter
      if (allPaymentsSearchTerm) {
        const search = allPaymentsSearchTerm.toLowerCase().trim();
        const textMatch = (
          zahlung.verwendungszweck?.toLowerCase().includes(search) ||
          zahlung.empfaengername?.toLowerCase().includes(search) ||
          zahlung.iban?.toLowerCase().includes(search) ||
          zahlung.mieter_name?.toLowerCase().includes(search) ||
          zahlung.immobilie_name?.toLowerCase().includes(search) ||
          zahlung.immobilie_adresse?.toLowerCase().includes(search) ||
          zahlung.kategorie?.toLowerCase().includes(search) ||
          zahlung.zugeordneter_monat?.toLowerCase().includes(search)
        );
        const betragMatch = zahlung.betrag?.toString().includes(search);
        const dateMatch = format(new Date(zahlung.buchungsdatum), 'dd.MM.yyyy').includes(search);
        
        if (!textMatch && !betragMatch && !dateMatch) return false;
      }
      
      if (selectedKategorie) {
        const zahlungKategorie = zahlung.kategorie || 'Keine Kategorie';
        if (zahlungKategorie !== selectedKategorie) return false;
      }

      if (showOnlyZugeordnet && !zahlung.mietvertrag_id && !zahlung.immobilie_id) return false;
      if (showOnlyNichtZugeordnet && (zahlung.mietvertrag_id || zahlung.immobilie_id)) return false;

      if (!dateRange.from && !dateRange.to) return true;
      
      const zahlungDate = new Date(zahlung.buchungsdatum);
      zahlungDate.setHours(0, 0, 0, 0);
      
      if (dateRange.from && dateRange.to) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        return zahlungDate >= from && zahlungDate <= to;
      }
      
      if (dateRange.from) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        return zahlungDate >= from;
      }
      
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        return zahlungDate <= to;
      }
      
      return true;
    });
  }, [allPayments, allPaymentsSearchTerm, selectedKategorie, showOnlyZugeordnet, showOnlyNichtZugeordnet, dateRange]);

  const sortedAllPayments = useMemo(() => {
    return [...filteredAllPayments].sort((a, b) => {
      switch (sortBy) {
        case 'datum-desc':
          return new Date(b.buchungsdatum).getTime() - new Date(a.buchungsdatum).getTime();
        case 'datum-asc':
          return new Date(a.buchungsdatum).getTime() - new Date(b.buchungsdatum).getTime();
        case 'betrag-desc':
          return b.betrag - a.betrag;
        case 'betrag-asc':
          return a.betrag - b.betrag;
        case 'status':
          const aAssigned = a.mietvertrag_id || a.immobilie_id ? 1 : 0;
          const bAssigned = b.mietvertrag_id || b.immobilie_id ? 1 : 0;
          return bAssigned - aAssigned;
        case 'kategorie':
          const katA = a.kategorie || 'Keine Kategorie';
          const katB = b.kategorie || 'Keine Kategorie';
          return katA.localeCompare(katB);
        default:
          return 0;
      }
    });
  }, [filteredAllPayments, sortBy]);

  const selectedZahlung = sortedAllPayments?.find(z => z.id === selectedZahlungId);

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag);
  };

  const formatDatum = (datum: string) => {
    return new Date(datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getEinheitNr = (einheitId: string | null) => {
    if (!einheitId) return 'N/A';
    return einheitId.slice(-2);
  };

  const getDateRangeDuration = () => {
    if (!dateRange.from || !dateRange.to) return null;
    const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({ title: "Ungültiger Dateityp", description: "Bitte laden Sie eine CSV-Datei hoch.", variant: "destructive" });
        return;
      }
      setCsvFile(file);
    }
  };

  const parseCsvToPayments = async (file: File): Promise<any[]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
    const payments: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
      if (values.length < headers.length) continue;
      
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      
      const buchungsdatumRaw = row["Buchungstag"] || row["Buchungsdatum"] || row["Datum"];
      const wertstellungsdatumRaw = row["Wertstellung"] || row["Wertstellungstag"] || row["Valuta"] || row["Valutadatum"];
      const betrag = row["Betrag"] || row["Umsatz"];
      const iban = row["Kontonummer/IBAN"] || row["IBAN des Absenders"] || row["IBAN"] || row["Auftraggeber-Konto"];
      const verwendungszweck = row["Verwendungszweck"] || row["Buchungstext"];
      const empfaengername = row["Beguenstigter/Zahlungspflichtiger"] || row["Name"] || row["Empfänger"];

      if (!buchungsdatumRaw || !betrag) continue;

      const toIsoDate = (d: string) => {
        if (!d) return d;
        if (d.includes('.')) {
          const [day, month, year] = d.split('.');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return d;
      };

      const buchungsdatum = toIsoDate(buchungsdatumRaw);
      const wertstellungsdatum = wertstellungsdatumRaw ? toIsoDate(wertstellungsdatumRaw) : undefined;
      const betragNum = parseFloat(betrag.replace('.', '').replace(',', '.'));

      payments.push({ buchungsdatum, wertstellungsdatum, betrag: betragNum, iban, verwendungszweck, empfaengername });
    }
    
    return payments;
  };

  const enrichResults = async (results: ProcessedPayment[]): Promise<ProcessedPayment[]> => {
    const contractIds = results.filter(r => r.mietvertrag_id).map(r => r.mietvertrag_id as string);
    if (contractIds.length === 0) return results;
    
    const { data: contracts } = await supabase
      .from('mietvertrag')
      .select(`id, einheiten!inner (etage, immobilien!inner (name)), mietvertrag_mieter (mieter (vorname, nachname))`)
      .in('id', contractIds);
    
    const contractMap = new Map();
    contracts?.forEach((c: any) => {
      const mieterNames = c.mietvertrag_mieter?.map((mm: any) => 
        `${mm.mieter?.vorname || ''} ${mm.mieter?.nachname || ''}`.trim()
      ).filter(Boolean).join(', ');
      
      contractMap.set(c.id, {
        mieter_name: mieterNames || 'Unbekannt',
        immobilie_name: `${c.einheiten?.immobilien?.name || ''} ${c.einheiten?.etage || ''}`.trim()
      });
    });
    
    return results.map(r => ({
      ...r,
      mieter_name: r.mietvertrag_id ? contractMap.get(r.mietvertrag_id)?.mieter_name : undefined,
      immobilie_name: r.mietvertrag_id ? contractMap.get(r.mietvertrag_id)?.immobilie_name : undefined,
    }));
  };

  const handleProcessCsv = async () => {
    if (!csvFile) {
      toast({ title: "Keine Datei ausgewählt", description: "Bitte wählen Sie eine CSV-Datei aus.", variant: "destructive" });
      return;
    }

    if (isProcessing) {
      toast({ title: "Verarbeitung läuft bereits", description: "Bitte warten Sie, bis die aktuelle Verarbeitung abgeschlossen ist.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setProcessing(true, csvFile.name);
    
    try {
      const payments = await parseCsvToPayments(csvFile);
      
      if (payments.length === 0) {
        throw new Error("Keine gültigen Zahlungen in der CSV gefunden");
      }
      
      toast({ title: "CSV geladen", description: `${payments.length} Zahlungen werden von der AI analysiert...` });
      
      const { data: result, error } = await supabase.functions.invoke('process-payments', {
        body: { payments, dryRun: true }
      });
      
      if (error) throw error;
      
      if (!result.success) {
        throw new Error(result.error || "AI-Verarbeitung fehlgeschlagen");
      }
      
      const enrichedResults = await enrichResults(result.results);
      
      setAiResults(enrichedResults);
      setAiDuplicates(result.duplicates || []);
      setAiStats(result.stats);
      setResultsModalOpen(true);
      
      resetProgress();
      
    } catch (error: any) {
      console.error('CSV processing error:', error);
      resetProgress();
      toast({ title: "Fehler bei der Verarbeitung", description: error.message || "Die CSV-Datei konnte nicht verarbeitet werden.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyAssignments = async (selectedResults?: any[]) => {
    const resultsToApply = selectedResults || aiResults;
    const assignmentsToApply = resultsToApply.filter(r => r.mietvertrag_id);
    
    for (const result of assignmentsToApply) {
      const { error } = await supabase
        .from('zahlungen')
        .update({ mietvertrag_id: result.mietvertrag_id, kategorie: result.kategorie as any })
        .eq('buchungsdatum', result.buchungsdatum)
        .eq('betrag', result.betrag)
        .eq('iban', result.iban);
      
      if (error) console.error("Assignment update error:", error);
    }
    
    if (csvFile) {
      await supabase.from('csv_uploads').insert({
        dateiname: csvFile.name,
        dateigroe_bytes: csvFile.size,
        anzahl_datensaetze: aiResults.length,
        status: 'verarbeitet',
      });
    }
    
    setCsvFile(null);
    setAiResults([]);
    setAiDuplicates([]);
    setAiStats(null);
    
    // Refresh queries
    queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
    queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });
  };

  const handleAssignPayment = (payment: any) => {
    setSelectedPayment(payment);
    setAssignDialogOpen(true);
  };

  const handleAssignFromDetails = () => {
    if (selectedZahlung) {
      setSelectedPayment({
        id: selectedZahlung.id,
        betrag: selectedZahlung.betrag,
        buchungsdatum: selectedZahlung.buchungsdatum,
        empfaengername: selectedZahlung.empfaengername || undefined,
        iban: selectedZahlung.iban || undefined,
        verwendungszweck: selectedZahlung.verwendungszweck || undefined,
        kategorie: selectedZahlung.kategorie || undefined,
      });
      setAssignDialogOpen(true);
    }
  };

  return (
    <div className="min-h-screen modern-dashboard-bg relative z-0">
      <div className="container mx-auto p-8 relative z-10">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={onBack} className="mb-4 bg-white/50 hover:bg-white/70">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Dashboard
          </Button>

          <div className="glass-card p-6 rounded-2xl">
            <h1 className="text-3xl font-sans font-bold text-gradient-red mb-2">
              Zahlungsverwaltung
            </h1>
            <p className="text-gray-600 font-sans">
              CSV-Upload, Zuordnung und Übersicht aller Zahlungen
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">CSV-Upload</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="alle" className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              <span className="hidden sm:inline">Alle Zahlungen</span>
              <span className="sm:hidden">Alle</span>
              {allPayments && <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{allPayments.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="unzugeordnet" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Nicht zugeordnet</span>
              <span className="sm:hidden">Offen</span>
              {unassignedPayments && unassignedPayments.length > 0 && (
                <Badge variant="destructive" className="ml-1">{unassignedPayments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="nebenkosten" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Nebenkosten</span>
              <span className="sm:hidden">NK</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: CSV Upload */}
          <TabsContent value="upload">
            <Card className="p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <Upload className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">CSV-Upload</h2>
              </div>

              <div className="space-y-4">
                {lastUpload && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Letzter Upload: <strong>{lastUpload.dateiname}</strong></span>
                      <span>•</span>
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(lastUpload.hochgeladen_am), 'dd.MM.yyyy HH:mm')}</span>
                      {lastUpload.anzahl_datensaetze && (
                        <>
                          <span>•</span>
                          <span>{lastUpload.anzahl_datensaetze} Datensätze</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="csv-file">Bankbewegungen (CSV)</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isUploading || isProcessing}
                    className="mt-2 cursor-pointer file:cursor-pointer"
                  />
                  {csvFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Ausgewählt: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <Button onClick={handleProcessCsv} disabled={!csvFile || isUploading || isProcessing} className="w-full">
                  {isUploading || isProcessing ? (
                    <>
                      <Bot className="mr-2 h-4 w-4 animate-pulse" />
                      AI analysiert Zahlungen...
                    </>
                  ) : (
                    <>
                      <Bot className="mr-2 h-4 w-4" />
                      Mit AI zuordnen
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Tab 2: Alle Zahlungen */}
          <TabsContent value="alle">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Zahlungsliste */}
              <Card className="h-[calc(100vh-300px)]">
                <CardHeader className="pb-3">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Euro className="h-5 w-5 text-green-600" />
                          Zahlungen
                        </CardTitle>
                        <p className="text-sm text-gray-600">
                          {sortedAllPayments?.length || 0} von {allPayments?.length || 0} Zahlungen
                        </p>
                      </div>
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="bg-white w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          <SelectItem value="datum-desc">Datum ↓</SelectItem>
                          <SelectItem value="datum-asc">Datum ↑</SelectItem>
                          <SelectItem value="betrag-desc">Betrag ↓</SelectItem>
                          <SelectItem value="betrag-asc">Betrag ↑</SelectItem>
                          <SelectItem value="status">Zuordnung</SelectItem>
                          <SelectItem value="kategorie">Kategorie</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Suchen..."
                        value={allPaymentsSearchTerm}
                        onChange={(e) => setAllPaymentsSearchTerm(e.target.value)}
                        className="pl-9 bg-white"
                      />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={selectedKategorie || 'alle'} onValueChange={(v) => setSelectedKategorie(v === 'alle' ? null : v)}>
                        <SelectTrigger className="bg-white w-36">
                          <SelectValue placeholder="Kategorie" />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          <SelectItem value="alle">Alle</SelectItem>
                          {uniqueKategorien.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2">
                        <Checkbox id="zugeordnet" checked={showOnlyZugeordnet} onCheckedChange={(c) => { setShowOnlyZugeordnet(!!c); if (c) setShowOnlyNichtZugeordnet(false); }} />
                        <label htmlFor="zugeordnet" className="text-xs cursor-pointer">Zugeordnet</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="nicht-zugeordnet" checked={showOnlyNichtZugeordnet} onCheckedChange={(c) => { setShowOnlyNichtZugeordnet(!!c); if (c) setShowOnlyZugeordnet(false); }} />
                        <label htmlFor="nicht-zugeordnet" className="text-xs cursor-pointer">Offen</label>
                      </div>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("text-xs", dateRange.from && "bg-blue-50")}>
                            <Calendar className="h-3 w-3 mr-1" />
                            {dateRange.from && dateRange.to 
                              ? `${format(dateRange.from, "dd.MM", { locale: de })} – ${format(dateRange.to, "dd.MM", { locale: de })}`
                              : "Zeitraum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white" align="start">
                          <CalendarComponent
                            mode="range"
                            selected={{ from: dateRange.from, to: dateRange.to }}
                            onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                            numberOfMonths={2}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {(dateRange.from || selectedKategorie) && (
                        <Button variant="ghost" size="sm" onClick={() => { setDateRange({ from: undefined, to: undefined }); setSelectedKategorie(null); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {allPaymentsLoading ? (
                    <div className="text-center py-12"><p className="text-gray-600">Lade Zahlungen...</p></div>
                  ) : sortedAllPayments && sortedAllPayments.length > 0 ? (
                    <ScrollArea className="h-[calc(100vh-520px)]">
                      <div className="space-y-2 p-4">
                        {sortedAllPayments.map((zahlung) => (
                          <Card
                            key={zahlung.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedZahlungId === zahlung.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedZahlungId(zahlung.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-muted-foreground">{formatDatum(zahlung.buchungsdatum)}</span>
                                    {zahlung.kategorie && <Badge variant="secondary" className="text-xs">{zahlung.kategorie}</Badge>}
                                  </div>
                                  <p className={`text-lg font-bold ${zahlung.betrag < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                    {formatBetrag(zahlung.betrag)}
                                  </p>
                                  {zahlung.verwendungszweck && (
                                    <p className="text-xs text-muted-foreground truncate mt-1">{zahlung.verwendungszweck}</p>
                                  )}
                                </div>
                                <div className="ml-2">
                                  {zahlung.mietvertrag_id || zahlung.immobilie_id ? (
                                    <Badge className="bg-green-600 text-xs">✓</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">!</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12">
                      <Euro className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">Keine Zahlungen gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right: Details */}
              <Card className="h-[calc(100vh-300px)]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Details & Zuordnung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedZahlung ? (
                    <ScrollArea className="h-[calc(100vh-420px)]">
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Zahlungsdetails</h3>
                          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Datum:</span>
                              <span className="text-sm font-medium">{formatDatum(selectedZahlung.buchungsdatum)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Betrag:</span>
                              <span className={`text-sm font-bold ${selectedZahlung.betrag < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {formatBetrag(selectedZahlung.betrag)}
                              </span>
                            </div>
                            {selectedZahlung.zugeordneter_monat && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Monat:</span>
                                <span className="text-sm font-medium">{selectedZahlung.zugeordneter_monat}</span>
                              </div>
                            )}
                            {selectedZahlung.kategorie && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Kategorie:</span>
                                <Badge variant="secondary" className="text-xs">{selectedZahlung.kategorie}</Badge>
                              </div>
                            )}
                            {selectedZahlung.empfaengername && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Empfänger:</span>
                                <span className="text-sm font-medium">{selectedZahlung.empfaengername}</span>
                              </div>
                            )}
                            {selectedZahlung.iban && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">IBAN:</span>
                                <span className="text-xs font-mono">{selectedZahlung.iban}</span>
                              </div>
                            )}
                            {selectedZahlung.verwendungszweck && (
                              <div>
                                <span className="text-sm text-gray-600 block mb-1">Verwendungszweck:</span>
                                <p className="text-sm font-medium bg-white p-2 rounded border">{selectedZahlung.verwendungszweck}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900">Zuordnung</h3>
                            <Button onClick={handleAssignFromDetails} size="sm" variant="outline" className="gap-2">
                              <Edit2 className="h-4 w-4" />
                              {selectedZahlung.mietvertrag_id || selectedZahlung.immobilie_id ? 'Ändern' : 'Zuordnen'}
                            </Button>
                          </div>

                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            {selectedZahlung.mietvertrag_id ? (
                              <div className="space-y-3">
                                <Badge variant="secondary" className="text-xs">Mietvertrag</Badge>
                                <div className="flex items-start gap-3">
                                  <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                                  <div>
                                    <p className="font-semibold">{selectedZahlung.immobilie_name}</p>
                                    <p className="text-sm text-gray-600">{selectedZahlung.immobilie_adresse}</p>
                                  </div>
                                </div>
                                {selectedZahlung.einheit_typ && (
                                  <div className="flex items-center gap-3">
                                    <Home className="h-5 w-5 text-blue-600" />
                                    <p className="font-medium">{selectedZahlung.einheit_typ} - {getEinheitNr(selectedZahlung.einheit_id)}</p>
                                  </div>
                                )}
                                {selectedZahlung.mieter_name && (
                                  <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-blue-600" />
                                    <p className="font-medium">{selectedZahlung.mieter_name}</p>
                                  </div>
                                )}
                              </div>
                            ) : selectedZahlung.immobilie_id ? (
                              <div className="space-y-3">
                                <Badge variant="secondary" className="text-xs">Immobilie</Badge>
                                <div className="flex items-start gap-3">
                                  <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                                  <div>
                                    <p className="font-semibold">{selectedZahlung.immobilie_name}</p>
                                    <p className="text-sm text-gray-600">{selectedZahlung.immobilie_adresse}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <Home className="h-12 w-12 text-orange-300 mx-auto mb-2" />
                                <p className="text-orange-700 font-medium mb-1">Nicht zugeordnet</p>
                                <p className="text-sm text-orange-600">Klicken Sie auf "Zuordnen" um diese Zahlung zuzuweisen</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12">
                      <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium mb-1">Keine Zahlung ausgewählt</p>
                      <p className="text-sm text-gray-500">Wählen Sie eine Zahlung aus der Liste</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 3: Nicht zugeordnete Mietzahlungen */}
          <TabsContent value="unzugeordnet">
            <Card className="p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <h2 className="text-xl font-semibold">
                    Nicht zugeordnete Mietzahlungen
                    {unassignedPayments && (
                      <span className="ml-2 text-sm text-muted-foreground">({filteredUnassignedPayments?.length || 0})</span>
                    )}
                  </h2>
                </div>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Diese Zahlungen wurden als Miete, Mietkaution oder Rücklastschrift erkannt, konnten aber keinem Mietvertrag zugeordnet werden.
              </p>

              <ScrollArea className="h-[500px]">
                {unassignedLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Lade Zahlungen...</div>
                ) : filteredUnassignedPayments?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 text-green-300 mx-auto mb-3" />
                    <p className="text-green-700 font-medium">Alle Mietzahlungen sind zugeordnet!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Buchungsdatum</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead>IBAN</TableHead>
                        <TableHead>Empfänger</TableHead>
                        <TableHead>Verwendungszweck</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnassignedPayments?.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.buchungsdatum), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className={`text-right font-semibold ${payment.betrag < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {payment.betrag.toFixed(2)} €
                          </TableCell>
                          <TableCell className="font-mono text-xs">{payment.iban || '-'}</TableCell>
                          <TableCell>{payment.empfaengername || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate">{payment.verwendungszweck || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{payment.kategorie}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleAssignPayment(payment)}>
                              Zuweisen
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </Card>
          </TabsContent>

          {/* Tab 4: Nebenkosten (Nichtmiete-Zahlungen) */}
          <TabsContent value="nebenkosten">
            <Card className="p-6 bg-white">
              <NebenkostenZuordnungTab />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Payment Dialog */}
      <AssignPaymentDialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
            queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });
          }
        }}
        payment={selectedPayment}
      />

      {/* AI Assignment Results Modal */}
      {aiStats && (
        <PaymentAssignmentResultsModal
          open={resultsModalOpen}
          onOpenChange={setResultsModalOpen}
          results={aiResults}
          duplicates={aiDuplicates}
          stats={aiStats}
          onApply={handleApplyAssignments}
        />
      )}
    </div>
  );
}
