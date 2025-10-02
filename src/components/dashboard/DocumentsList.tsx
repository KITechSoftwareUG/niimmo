
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PdfPreviewModal } from "./PdfPreviewModal";

interface DocumentsListProps {
  dokumente: any[];
}

export const DocumentsList = ({ dokumente }: DocumentsListProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewDokument, setPreviewDokument] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const handlePreview = (dokument: any) => {
    setPreviewDokument(dokument);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewDokument(null);
  };

  const handleDownload = async (dokument: any) => {
    if (!dokument || !dokument.pfad) {
      toast({
        title: "Fehler",
        description: "Dokument-Pfad nicht gefunden.",
        variant: "destructive",
      });
      return;
    }

    setDownloading(dokument.id);
    try {
      // Create a signed URL for private bucket access
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(dokument.pfad, 60); // Valid for 60 seconds

      if (signedUrlError) {
        console.error('Signed URL Error:', signedUrlError);
        toast({
          variant: "destructive",
          title: "Download fehlgeschlagen",
          description: `Fehler beim Download: ${signedUrlError.message}`
        });
        return;
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

      toast({
        title: "Download erfolgreich",
        description: `${dokument.titel} wurde heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  if (!dokumente || dokumente.length === 0) {
    return (
      <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <span className="text-xl font-semibold text-gray-800">Dokumente</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center py-8">
            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg">Keine Dokumente vorhanden</p>
            <p className="text-gray-400 text-sm mt-2">Dokumente werden hier angezeigt, sobald sie hochgeladen werden.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isImageFile = (dateityp?: string, pfad?: string, titel?: string): boolean => {
    const clean = (s?: string) => s?.toLowerCase().trim() || '';
    const normalized = clean(dateityp).replace(/^\./, '');
    if (normalized.startsWith('image/')) return true;
    const pathTitle = `${clean(pfad)} ${clean(titel)}`;
    if (/(\.(jpe?g|png))(\s|$)/i.test(pathTitle)) return true;
    const ext = pathTitle.match(/\.([a-z0-9]+)(\s|$)/i)?.[1];
    const candidate = normalized || ext;
    if (!candidate) return false;
    return ['image/jpeg', 'image/jpg', 'image/png', 'jpeg', 'jpg', 'png'].includes(candidate);
  };
  const isPreviewable = (dokument: any): boolean => {
    const clean = (s?: string) => s?.toLowerCase().trim() || '';
    const mime = clean(dokument?.dateityp).replace(/^\./, '');
    const byMimePdf = mime === 'application/pdf' || mime === 'pdf';
    const byMimeImg = mime.startsWith('image/') || ['jpeg', 'jpg', 'png', 'image/jpeg', 'image/jpg', 'image/png'].includes(mime);
    const pathTitle = `${clean(dokument?.pfad)} ${clean(dokument?.titel)}`;
    const byExt = /(\.(pdf|jpe?g|png))(\s|$)/i.test(pathTitle);
    const byHeuristic = isImageFile(dokument?.dateityp, dokument?.pfad, dokument?.titel);
    return byMimePdf || byMimeImg || byExt || byHeuristic;
  };
  const getFileTypeColor = (dateityp: string) => {
    const normalized = dateityp?.toLowerCase().replace(/^\./, '') || '';
    if (normalized === 'pdf' || normalized === 'application/pdf') {
      return 'bg-red-100 text-red-800';
    }
    if (['doc', 'docx', 'application/msword'].includes(normalized)) {
      return 'bg-blue-100 text-blue-800';
    }
    if (isImageFile(dateityp)) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <span className="text-xl font-semibold text-gray-800">Dokumente</span>
              <p className="text-sm text-gray-600 font-normal mt-1">{dokumente.length} Dokument(e) verfügbar</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-4">
            {dokumente.map((dokument) => (
              <div key={dokument.id} className="p-6 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full">
                      <FileText className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {dokument.titel || 'Unbenanntes Dokument'}
                      </h4>
                      <div className="flex items-center space-x-3 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {dokument.hochgeladen_am 
                              ? new Date(dokument.hochgeladen_am).toLocaleDateString('de-DE', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'Unbekannt'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant="outline" 
                      className={`${getFileTypeColor(dokument.dateityp)} border-0`}
                    >
                      {dokument.dateityp?.toUpperCase() || 'UNBEKANNT'}
                    </Badge>
                    <div className="flex items-center space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                      {isPreviewable(dokument) && (
                        <button 
                          onClick={() => handlePreview(dokument)}
                          className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors duration-200"
                          title="Vorschau anzeigen"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleDownload(dokument)}
                        disabled={downloading === dokument.id}
                        className="p-2 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
                        title="Herunterladen"
                      >
                        {downloading === dokument.id ? (
                          <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 text-green-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        dokument={previewDokument}
      />
    </>
  );
};
