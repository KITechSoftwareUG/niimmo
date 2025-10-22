import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Copy, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoiceToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadedFile {
  file: File;
  id: string;
  preview?: string;
}

interface InvoiceTableData {
  headers: string[];
  rows: string[][];
}

export function InvoiceTool({ open, onOpenChange }: InvoiceToolProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tableData, setTableData] = useState<InvoiceTableData | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach((file) => {
      // Validate file type
      const isValidType = file.type === 'application/pdf' || 
                          file.type === 'image/png' || 
                          file.type === 'image/jpeg';
      
      if (!isValidType) {
        toast({
          title: "Ungültiger Dateityp",
          description: `${file.name} ist kein PDF oder PNG/JPG`,
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB per file)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Datei zu groß",
          description: `${file.name} ist größer als 10MB`,
          variant: "destructive",
        });
        return;
      }

      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          setUploadedFiles(prev => 
            prev.map(f => f.id === id ? { ...f, preview } : f)
          );
        };
        reader.readAsDataURL(file);
      }

      newFiles.push({ file, id });
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Reset input
    event.target.value = '';
  }, [toast]);

  const removeFile = useCallback((id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleProcess = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Keine Dateien",
        description: "Bitte laden Sie mindestens eine Datei hoch",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setTableData(null);

    try {
      // Create FormData to send binary files
      const formData = new FormData();
      
      // Add all files as binary data
      uploadedFiles.forEach(({ file }, index) => {
        formData.append(`file_${index}`, file);
      });
      
      // Add metadata
      formData.append('timestamp', new Date().toISOString());
      formData.append('fileCount', uploadedFiles.length.toString());

      const webhookUrl = 'https://k01-2025-u36730.vm.elestio.app/webhook/22c64ddf-c72c-41d9-b19a-5a78ac3354e7';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'X-Source': 'lovable-rental-management'
          // Content-Type wird automatisch vom Browser gesetzt (multipart/form-data)
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server hat kein JSON zurückgegeben. Bitte prüfen Sie die Webhook-Konfiguration.');
      }

      const result = await response.json();
      
      // Expected response format: { headers: string[], rows: string[][] }
      if (result.headers && result.rows) {
        setTableData(result);
        toast({
          title: "Erfolgreich verarbeitet",
          description: `${uploadedFiles.length} Datei(en) wurden analysiert`,
        });
      } else {
        throw new Error('Ungültiges Antwortformat vom Server');
      }
    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Fehler bei der Verarbeitung",
        description: error.message || "Ein unbekannter Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyTableToClipboard = async () => {
    if (!tableData) return;

    try {
      // Format as TSV (Tab-Separated Values) for better Excel compatibility
      const tsvContent = [
        tableData.headers.join('\t'),
        ...tableData.rows.map(row => row.join('\t'))
      ].join('\n');

      await navigator.clipboard.writeText(tsvContent);
      setIsCopied(true);
      
      toast({
        title: "In Zwischenablage kopiert",
        description: "Die Tabelle kann jetzt in Excel eingefügt werden",
      });

      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Fehler beim Kopieren",
        description: "Die Tabelle konnte nicht kopiert werden",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setUploadedFiles([]);
    setTableData(null);
    setIsCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rechnungstool</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Rechnungen hochladen (PDF, PNG, JPG)</Label>
              <div className="mt-2">
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                  className="cursor-pointer"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Maximale Dateigröße: 10MB pro Datei
              </p>
            </div>

            {/* File List */}
            {uploadedFiles.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Hochgeladene Dateien ({uploadedFiles.length})</Label>
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                    >
                      Alle entfernen
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {uploadedFiles.map(({ file, id, preview }) => (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                    >
                      {preview && (
                        <img
                          src={preview}
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(id)}
                        disabled={isProcessing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Process Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleProcess}
              disabled={uploadedFiles.length === 0 || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Rechnungen verarbeiten
                </>
              )}
            </Button>
          </div>

          {/* Results Section */}
          {tableData && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Label>Ergebnisse</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyTableToClipboard}
                >
                  {isCopied ? (
                    <>
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      In Zwischenablage kopieren
                    </>
                  )}
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tableData.headers.map((header, idx) => (
                        <TableHead key={idx}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.rows.map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <TableCell key={cellIdx}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Info Alert */}
          {!tableData && !isProcessing && uploadedFiles.length === 0 && (
            <Alert>
              <AlertDescription>
                Laden Sie PDF- oder Bild-Dateien (PNG, JPG) Ihrer Rechnungen hoch. 
                Das System wird diese analysieren und eine Tabelle mit den extrahierten Daten erstellen.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to convert file to data URL
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
  });
}
