import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  CheckSquare, 
  Square, 
  Euro, 
  Calendar, 
  User,
  Loader2,
  FolderOpen,
  File,
  Image,
  FileArchive,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DokumentenModalProps {
  isOpen: boolean;
  onClose: () => void;
  mietvertragId: string;
  einheit?: {
    id: string;
    nummer?: string;
    etage?: string;
    qm?: number;
  };
  immobilie?: {
    name: string;
    adresse: string;
  };
}

export const DokumentenModal = ({ 
  isOpen, 
  onClose, 
  mietvertragId,
  einheit,
  immobilie 
}: DokumentenModalProps) => {
  const { toast } = useToast();
  const [selectedDokumente, setSelectedDokumente] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Mietvertrag Details laden
  const { data: mietvertrag, isLoading: mietvertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', mietvertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          *,
          mietvertrag_mieter!inner(
            mieter:mieter_id (
              id,
              vorname,
              nachname,
              hauptmail
            )
          )
        `)
        .eq('id', mietvertragId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!mietvertragId
  });

  // Dokumente laden
  const { data: dokumente, isLoading: dokumenteLoading } = useQuery({
    queryKey: ['dokumente', mietvertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', mietvertragId)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!mietvertragId
  });

  const getFileIcon = (dateityp: string | null) => {
    if (!dateityp) return <File className="h-5 w-5" />;
    
    if (dateityp.includes('image')) return <Image className="h-5 w-5 text-green-600" />;
    if (dateityp.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
    if (dateityp.includes('zip') || dateityp.includes('rar')) return <FileArchive className="h-5 w-5 text-purple-600" />;
    return <File className="h-5 w-5 text-blue-600" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unbekannt';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDokumentSelect = (dokumentId: string) => {
    setSelectedDokumente(prev => 
      prev.includes(dokumentId)
        ? prev.filter(id => id !== dokumentId)
        : [...prev, dokumentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDokumente.length === dokumente?.length) {
      setSelectedDokumente([]);
    } else {
      setSelectedDokumente(dokumente?.map(doc => doc.id) || []);
    }
  };

  const handleDownload = async (dokumentIds: string[]) => {
    if (dokumentIds.length === 0) return;

    setDownloading(true);
    try {
      for (const dokumentId of dokumentIds) {
        const dokument = dokumente?.find(d => d.id === dokumentId);
        if (!dokument || !dokument.pfad) continue;

        // Create a signed URL for private bucket access
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('dokumente')
          .createSignedUrl(dokument.pfad, 60); // Valid for 60 seconds

        if (signedUrlError) {
          toast({
            variant: "destructive",
            title: "Download fehlgeschlagen",
            description: `Fehler beim Download von ${dokument.titel}: ${signedUrlError.message}`
          });
          continue;
        }

        // Download using the signed URL
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
      }

      toast({
        title: "Download erfolgreich",
        description: `${dokumentIds.length} Dokument(e) wurden heruntergeladen.`
      });

      setSelectedDokumente([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download fehlgeschlagen",
        description: "Es gab einen Fehler beim Herunterladen der Dokumente."
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSingleDownload = (dokumentId: string) => {
    handleDownload([dokumentId]);
  };

  const handleMultipleDownload = () => {
    handleDownload(selectedDokumente);
  };

  if (mietvertragLoading || dokumenteLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Dokumente - {einheit?.nummer ? `Einheit ${einheit.nummer}` : 'Einheit'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Immobilie Info */}
          {immobilie && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">
                  <strong>{immobilie.name}</strong> - {immobilie.adresse}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mietvertrag Übersicht */}
          {mietvertrag && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Mietvertrag Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-600">Kaltmiete</div>
                      <div className="font-semibold">{mietvertrag.kaltmiete}€</div>
                    </div>
                  </div>
                  {mietvertrag.betriebskosten && (
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="text-sm text-gray-600">Betriebskosten</div>
                        <div className="font-semibold">{mietvertrag.betriebskosten}€</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-600">Status</div>
                      <Badge className={mietvertrag.status === 'aktiv' ? 'bg-green-600' : 'bg-yellow-600'}>
                        {mietvertrag.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Mieter */}
                {mietvertrag.mietvertrag_mieter && mietvertrag.mietvertrag_mieter.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Mieter</span>
                    </div>
                    <div className="space-y-2">
                      {mietvertrag.mietvertrag_mieter.map((mm: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                           <span className="text-sm">
                             {mm.mieter.vorname} {mm.mieter.nachname}
                           </span>
                         </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Dokumente Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Dokumente ({dokumente?.length || 0})
                </CardTitle>
                
                {dokumente && dokumente.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="flex items-center gap-2"
                    >
                      {selectedDokumente.length === dokumente.length ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      Alle auswählen
                    </Button>
                    
                    {selectedDokumente.length > 0 && (
                      <Button
                        onClick={handleMultipleDownload}
                        disabled={downloading}
                        className="flex items-center gap-2"
                      >
                        {downloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {selectedDokumente.length} herunterladen
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {dokumente && dokumente.length > 0 ? (
                <div className="space-y-2">
                  {dokumente.map((dokument) => (
                    <div 
                      key={dokument.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={selectedDokumente.includes(dokument.id)}
                          onCheckedChange={() => handleDokumentSelect(dokument.id)}
                        />
                        
                        {getFileIcon(dokument.dateityp)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{dokument.titel}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-4">
                            <span>{formatFileSize(dokument.groesse_bytes)}</span>
                            {dokument.hochgeladen_am && (
                              <span>
                                {new Date(dokument.hochgeladen_am).toLocaleDateString('de-DE')}
                              </span>
                            )}
                            {dokument.kategorie && (
                              <Badge variant="outline" className="text-xs">
                                {dokument.kategorie}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSingleDownload(dokument.id)}
                        disabled={downloading}
                        className="ml-2"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Keine Dokumente für diesen Mietvertrag gefunden</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};