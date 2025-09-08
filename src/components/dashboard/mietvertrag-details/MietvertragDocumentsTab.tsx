import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MietvertragDocumentsTabProps {
  dokumente: any[];
  formatDatum: (datum: string) => string;
}

export function MietvertragDocumentsTab({
  dokumente,
  formatDatum
}: MietvertragDocumentsTabProps) {
  const { toast } = useToast();

  const handleDownload = async (dokument: any) => {
    try {
      // Implementation for document download
      toast({
        title: "Download gestartet",
        description: `${dokument.titel} wird heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
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
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
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