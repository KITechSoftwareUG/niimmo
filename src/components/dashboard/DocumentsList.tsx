
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface DocumentsListProps {
  dokumente: any[];
}

export const DocumentsList = ({ dokumente }: DocumentsListProps) => {
  if (!dokumente || dokumente.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Dokumente</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {dokumente.map((dokument) => (
            <div key={dokument.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{dokument.titel || 'Unbenanntes Dokument'}</p>
                <p className="text-sm text-gray-600">
                  Hochgeladen am {dokument.hochgeladen_am ? new Date(dokument.hochgeladen_am).toLocaleDateString('de-DE') : 'Unbekannt'}
                </p>
              </div>
              <Badge variant="outline">{dokument.dateityp || 'Unbekannt'}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
