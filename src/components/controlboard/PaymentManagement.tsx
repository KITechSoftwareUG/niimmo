import { useState } from "react";
import { ArrowLeft, Upload, Search, FileText, Calendar, DollarSign } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface PaymentManagementProps {
  onBack: () => void;
}

export function PaymentManagement({ onBack }: PaymentManagementProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const handleProcessCsv = async () => {
    if (!csvFile) {
      toast({
        title: "Keine Datei ausgewählt",
        description: "Bitte wählen Sie eine CSV-Datei aus.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Send to webhook for processing using FormData
      const webhookUrl = 'https://k01-2025-u36730.vm.elestio.app/webhook/csv-upload';
      
      // Create FormData and append file with the field name 'file'
      const formData = new FormData();
      formData.append('file', csvFile, csvFile.name);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - it will be set automatically with boundary
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Create upload record
      await supabase.from('csv_uploads').insert({
        dateiname: csvFile.name,
        dateigroe_bytes: csvFile.size,
        anzahl_datensaetze: result.recordCount || 0,
        status: 'verarbeitet',
      });

      toast({
        title: "CSV erfolgreich verarbeitet",
        description: `${result.recordCount || 0} Datensätze wurden importiert.`,
      });

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['last-csv-upload'] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });

      setCsvFile(null);
    } catch (error: any) {
      console.error('CSV processing error:', error);
      toast({
        title: "Fehler bei der Verarbeitung",
        description: error.message || "Die CSV-Datei konnte nicht verarbeitet werden.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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
                disabled={isProcessing}
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
              disabled={!csvFile || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Zahlungsdaten verarbeiten
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
                      <TableCell className="text-right font-semibold">
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
    </div>
  );
}
