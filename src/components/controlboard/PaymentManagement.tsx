import { useState } from "react";
import { ArrowLeft, Upload, Search, FileText, Calendar, DollarSign, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { AssignPaymentDialog } from "./AssignPaymentDialog";
import { PaymentAssignmentResultsModal } from "./PaymentAssignmentResultsModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCsvUploadProgress } from "@/hooks/useCsvUploadProgress";

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

export function PaymentManagement({ onBack }: PaymentManagementProps) {
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

  // Fetch unassigned payments
  const { data: unassignedPayments, isLoading } = useQuery({
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

  // Advanced filter for payments - searches across multiple fields
  const filteredPayments = unassignedPayments?.filter(payment => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase().trim();
    
    // Search in text fields
    const textMatch = (
      payment.iban?.toLowerCase().includes(search) ||
      payment.empfaengername?.toLowerCase().includes(search) ||
      payment.verwendungszweck?.toLowerCase().includes(search) ||
      payment.kategorie?.toLowerCase().includes(search) ||
      payment.zugeordneter_monat?.toLowerCase().includes(search)
    );
    
    // Search in amount (convert betrag to string and search)
    const betragString = payment.betrag?.toString();
    const betragMatch = betragString?.includes(search) || 
                       Math.abs(payment.betrag || 0).toFixed(2).includes(search);
    
    // Search in date
    const dateString = payment.buchungsdatum ? format(new Date(payment.buchungsdatum), 'dd.MM.yyyy') : '';
    const dateMatch = dateString.includes(search);
    
    return textMatch || betragMatch || dateMatch;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte laden Sie eine CSV-Datei hoch.",
          variant: "destructive",
        });
        return;
      }
      setCsvFile(file);
    }
  };

  // Parse CSV and extract payments
  const parseCsvToPayments = async (file: File): Promise<any[]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];
    
    // Parse header
    const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
    
    const payments: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
      if (values.length < headers.length) continue;
      
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      
      // Map CSV columns to payment object
      // WICHTIG: Buchungstag (nicht Wertstellungstag!) für Duplikat-Check
      const buchungsdatum = row['Buchungstag'] || row['Buchungsdatum'] || row['Datum'];
      const betrag = row['Betrag'] || row['Umsatz'];
      // IBAN des Zahlenden/Empfängers - NICHT das eigene Konto!
      const iban = row['Kontonummer/IBAN'] || row['IBAN des Absenders'] || row['IBAN'] || row['Auftraggeber-Konto'];
      const verwendungszweck = row['Verwendungszweck'] || row['Buchungstext'];
      const empfaengername = row['Beguenstigter/Zahlungspflichtiger'] || row['Name'] || row['Empfänger'];
      
      if (!buchungsdatum || !betrag) continue;
      
      // Convert date from DD.MM.YYYY to YYYY-MM-DD
      let formattedDate = buchungsdatum;
      if (buchungsdatum.includes('.')) {
        const [day, month, year] = buchungsdatum.split('.');
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Convert amount (German format: comma as decimal separator)
      const betragNum = parseFloat(betrag.replace('.', '').replace(',', '.'));
      
      payments.push({
        buchungsdatum: formattedDate,
        betrag: betragNum,
        iban: iban,
        verwendungszweck: verwendungszweck,
        empfaengername: empfaengername,
      });
    }
    
    return payments;
  };

  // Enrich results with tenant/property names
  const enrichResults = async (results: ProcessedPayment[]): Promise<ProcessedPayment[]> => {
    const contractIds = results
      .filter(r => r.mietvertrag_id)
      .map(r => r.mietvertrag_id as string);
    
    if (contractIds.length === 0) return results;
    
    const { data: contracts } = await supabase
      .from('mietvertrag')
      .select(`
        id,
        einheiten!inner (
          etage,
          immobilien!inner (
            name
          )
        ),
        mietvertrag_mieter (
          mieter (
            vorname,
            nachname
          )
        )
      `)
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
      toast({
        title: "Keine Datei ausgewählt",
        description: "Bitte wählen Sie eine CSV-Datei aus.",
        variant: "destructive",
      });
      return;
    }

    if (isProcessing) {
      toast({
        title: "Verarbeitung läuft bereits",
        description: "Bitte warten Sie, bis die aktuelle Verarbeitung abgeschlossen ist.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProcessing(true, csvFile.name);
    
    try {
      // Parse CSV locally
      const payments = await parseCsvToPayments(csvFile);
      
      if (payments.length === 0) {
        throw new Error("Keine gültigen Zahlungen in der CSV gefunden");
      }
      
      toast({
        title: "CSV geladen",
        description: `${payments.length} Zahlungen werden von der AI analysiert...`,
      });
      
      // Call AI Edge Function for assignment (dry run first)
      const { data: result, error } = await supabase.functions.invoke('process-payments', {
        body: { payments, dryRun: true }
      });
      
      if (error) throw error;
      
      if (!result.success) {
        throw new Error(result.error || "AI-Verarbeitung fehlgeschlagen");
      }
      
      // Enrich results with names
      const enrichedResults = await enrichResults(result.results);
      
      // Store results and show modal
      setAiResults(enrichedResults);
      setAiDuplicates(result.duplicates || []);
      setAiStats(result.stats);
      setResultsModalOpen(true);
      
      resetProgress();
      
    } catch (error: any) {
      console.error('CSV processing error:', error);
      resetProgress();
      toast({
        title: "Fehler bei der Verarbeitung",
        description: error.message || "Die CSV-Datei konnte nicht verarbeitet werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Apply AI assignments to database
  const handleApplyAssignments = async () => {
    const assignmentsToApply = aiResults.filter(r => r.mietvertrag_id);
    
    for (const result of assignmentsToApply) {
      // Find existing payment by matching criteria
      const { error } = await supabase
        .from('zahlungen')
        .update({
          mietvertrag_id: result.mietvertrag_id,
          kategorie: result.kategorie as any,
        })
        .eq('buchungsdatum', result.buchungsdatum)
        .eq('betrag', result.betrag)
        .eq('iban', result.iban);
      
      if (error) {
        console.error("Assignment update error:", error);
      }
    }
    
    // Create upload record
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
  };

  const handleAssignPayment = (payment: any) => {
    setSelectedPayment(payment);
    setAssignDialogOpen(true);
  };

  return (
    <div className="min-h-screen modern-dashboard-bg relative z-0">
      <div className="container mx-auto p-8 relative z-10">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={onBack}
            className="mb-4 bg-white/50 hover:bg-white/70"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Dashboard
          </Button>

          <div className="glass-card p-6 rounded-2xl">
            <h1 className="text-3xl font-sans font-bold text-gradient-red mb-2">
              Zahlungsverwaltung
            </h1>
            <p className="text-gray-600 font-sans">
              CSV-Upload und Zuordnung von Zahlungen zu Mietverträgen
            </p>
          </div>
        </div>

        {/* CSV Upload Section */}
        <Card className="p-6 mb-6 relative z-10 bg-white">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">CSV-Upload</h2>
          </div>

          <div className="space-y-4">
            {/* Last Upload Info */}
            {lastUpload && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>
                    Letzter Upload: <strong>{lastUpload.dateiname}</strong>
                  </span>
                  <span>•</span>
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(lastUpload.hochgeladen_am), 'dd.MM.yyyy HH:mm')}
                  </span>
                  {lastUpload.anzahl_datensaetze && (
                    <>
                      <span>•</span>
                      <span>{lastUpload.anzahl_datensaetze} Datensätze</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* File Upload */}
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

            {/* Process Button */}
            <Button
              onClick={handleProcessCsv}
              disabled={!csvFile || isUploading || isProcessing}
              className="w-full"
            >
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

        {/* Unassigned Payments Section */}
        <Card className="p-6 relative z-10 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">
                Nicht zugeordnete Mietzahlungen
                {unassignedPayments && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({filteredPayments?.length || 0})
                  </span>
                )}
              </h2>
            </div>

            {/* Search */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen nach Mieter, Verwendungszweck, IBAN, Betrag, Datum..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Payments Table */}
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Lade Zahlungen...
              </div>
            ) : filteredPayments?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Keine nicht zugeordneten Zahlungen gefunden
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
                    <TableHead>Zugeordneter Monat</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.buchungsdatum), 'dd.MM.yyyy')}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${
                        payment.betrag < 0 ? 'text-destructive' : 'text-green-600'
                      }`}>
                        {payment.betrag.toFixed(2)} €
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.iban || '-'}
                      </TableCell>
                      <TableCell>{payment.empfaengername || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {payment.verwendungszweck || '-'}
                      </TableCell>
                      <TableCell>
                        {payment.zugeordneter_monat || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignPayment(payment)}
                        >
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
      </div>

      {/* Assign Payment Dialog */}
      <AssignPaymentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
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
