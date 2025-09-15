import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface MietvertragDocumentsTabProps {
  dokumente: any[];
  formatDatum: (datum: string) => string;
}

export function MietvertragDocumentsTab({
  dokumente,
  formatDatum
}: MietvertragDocumentsTabProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Dokumente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dokumente && dokumente.length > 0 ? (
            <div className="space-y-3">
              {dokumente.map((dok) => (
                <div
                  key={dok.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{dok.titel}</p>
                      <p className="text-sm text-muted-foreground">
                        {dok.kategorie} • {formatDatum(dok.hochgeladen_am)}
                        {dok.dateigross && ` • ${Math.round(dok.dateigross / 1024)}KB`}
                      </p>
                    </div>
                  </div>
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
                    <span>{downloading === dok.id ? 'Lädt...' : 'Download'}</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Keine Dokumente vorhanden</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}