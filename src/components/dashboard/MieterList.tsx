
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

interface MieterListProps {
  mieter: any[];
}

export const MieterList = ({ mieter }: MieterListProps) => {
  if (!mieter || mieter.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Mieter</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mieter.map((m, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">
                    {m.mieter?.Vorname} {m.mieter?.Nachname}
                  </p>
                  <p className="text-sm text-gray-600">{m.mieter?.hauptmail}</p>
                  {m.mieter?.weitere_mails && (
                    <p className="text-sm text-gray-600">{m.mieter.weitere_mails}</p>
                  )}
                </div>
                {m.rolle && (
                  <Badge variant="outline">{m.rolle}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
