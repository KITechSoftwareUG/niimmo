import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Eye, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { useQueryClient } from "@tanstack/react-query";
import { DocumentDragDropZone } from "./DocumentDragDropZone";

interface ImmobilienDocumentsTabProps {
  immobilieId: string;
  dokumente: any[];
}

const DOCUMENT_CATEGORIES = [
  'Mietvertrag',
  'Kaufvertrag',
  'Grundbuchauszug',
  'Energieausweis',
  'Versicherung',
  'Rechnung',
  'Sonstiges',
];

export function ImmobilienDocumentsTab({ immobilieId, dokumente }: ImmobilienDocumentsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadDocument, uploading, progress } = useDocumentUpload();
  
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitel, setUploadTitel] = useState("");
  const [uploadKategorie, setUploadKategorie] = useState("Sonstiges");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  const formatDatum = (datum: string) => {
    if (!datum) return 'Unbekannt';
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handlePreview = async (dokument: any) => {
    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(dokument.pfad, 3600);

      if (signedUrlError) {
        toast({
          variant: "destructive",
          title: "Vorschau fehlgeschlagen",
          description: `Fehler: ${signedUrlError.message}`
        });
        return;
      }

      window.open(signedUrlData.signedUrl, '_blank');
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Vorschau konnte nicht geöffnet werden.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (dokument: any) => {
    setDownloading(dokument.id);
    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(dokument.pfad, 60);

      if (signedUrlError) {
        toast({
          variant: "destructive",
          title: "Download fehlgeschlagen",
          description: `Fehler: ${signedUrlError.message}`
        });
        return;
      }

      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dokument.titel || 'dokument';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: `${dokument.titel} wurde heruntergeladen.`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadTitel(file.name);
    }
  };

  const handleFileDrop = (file: File) => {
    setSelectedFile(file);
    setUploadTitel(file.name);
    setUploadKategorie("Sonstiges");
    setIsUploadDialogOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Datei aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      await uploadDocument(selectedFile, {
        immobilieId,
        titel: uploadTitel || selectedFile.name,
        kategorie: uploadKategorie,
      });

      queryClient.invalidateQueries({ queryKey: ['immobilien-dokumente', immobilieId] });

      setSelectedFile(null);
      setUploadTitel("");
      setUploadKategorie("Sonstiges");
      setIsUploadDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteClick = (documentId: string) => {
    setDocumentToDelete(documentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      const { error } = await supabase
        .from('dokumente')
        .update({ geloescht: true })
        .eq('id', documentToDelete);

      if (error) throw error;

      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich gelöscht.",
      });

      queryClient.invalidateQueries({ queryKey: ['immobilien-dokumente', immobilieId] });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <>
      <DocumentDragDropZone onFileSelect={handleFileDrop}>
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Dokumente</span>
              <Badge variant="secondary" className="ml-2">
                {dokumente?.length || 0}
              </Badge>
            </div>
            
            <Button
              onClick={() => {
                setSelectedFile(null);
                setUploadTitel("");
                setUploadKategorie("Sonstiges");
                setIsUploadDialogOpen(true);
              }}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Hochladen
            </Button>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {dokumente && dokumente.length > 0 ? (
            <div className="space-y-3">
              {dokumente.map((dok) => (
                <div
                  key={dok.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{dok.titel}</p>
                        <Badge variant="secondary" className="text-xs">
                          {dok.kategorie}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {formatDatum(dok.hochgeladen_am)}
                        {dok.groesse_bytes && ` • ${Math.round(dok.groesse_bytes / 1024)}KB`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handlePreview(dok)}
                      size="sm"
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Vorschau</span>
                    </Button>
                    
                    <Button
                      onClick={() => handleDownload(dok)}
                      size="sm"
                      variant="outline"
                      disabled={downloading === dok.id}
                      className="flex items-center space-x-2"
                    >
                      {downloading === dok.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span>Download</span>
                    </Button>
                    
                    <Button
                      onClick={() => handleDeleteClick(dok.id)}
                      size="sm"
                      variant="outline"
                      className="flex items-center space-x-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Dokumente vorhanden</p>
              <p className="text-sm mt-2">Laden Sie Dokumente für diese Immobilie hoch</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument hochladen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Datei auswählen</Label>
              <Input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Ausgewählt: {selectedFile.name}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={uploadTitel}
                onChange={(e) => setUploadTitel(e.target.value)}
                placeholder="Dokumenttitel"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={uploadKategorie} onValueChange={setUploadKategorie}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Upload läuft...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              Hochladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie dieses Dokument löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </DocumentDragDropZone>
    </>
  );
}
