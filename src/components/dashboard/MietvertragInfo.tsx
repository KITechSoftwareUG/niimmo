
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface MietvertragInfoProps {
  vertrag: any;
  einheit: any;
  immobilie: any;
}

export const MietvertragInfo = ({ vertrag, einheit, immobilie }: MietvertragInfoProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Mietvertrag Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Einheit</label>
            <p>{einheit?.id?.slice(0, 8) || 'Keine ID'}</p>
            <p className="text-sm text-gray-600">{einheit?.etage || 'Keine Etage'}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-500">Immobilie</label>
            <p>{immobilie?.name}</p>
            <p className="text-sm text-gray-600">{immobilie?.adresse}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Kaltmiete</label>
            <p className="text-lg font-semibold">{vertrag?.kaltmiete}€</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Warmmiete</label>
            <p className="text-lg font-semibold">{vertrag?.warmmiete || 'Nicht angegeben'}€</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Vertragsbeginn</label>
            <p>{vertrag?.start_datum ? new Date(vertrag.start_datum).toLocaleDateString('de-DE') : 'Nicht angegeben'}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Vertragsende</label>
            <p>{vertrag?.ende_datum ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE') : 'Unbefristet'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
