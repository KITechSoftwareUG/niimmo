import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Building2, Square } from "lucide-react";

interface MietvertragTenantInfoProps {
  mieter: any[];
  immobilie?: any;
  einheit?: any;
}

export function MietvertragTenantInfo({
  mieter,
  immobilie,
  einheit
}: MietvertragTenantInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mieter Informationen</CardTitle>
      </CardHeader>
      <CardContent>
        {mieter && mieter.length > 0 ? (
          <div className="space-y-4">
            {mieter.map((m: any) => (
              <div key={m.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{m.vorname} {m.nachname}</p>
                    <div className="text-sm text-muted-foreground space-y-1 mt-2">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span>{m.hauptmail || 'Keine E-Mail'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>{m.telnr || 'Keine Telefonnummer'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Keine Mieter gefunden</p>
        )}
        
        {/* Immobilie und Einheit Informationen */}
        <div className="mt-6 pt-6 border-t">
          <div className="space-y-4">
            {immobilie && (
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">Immobilie: </span>
                  <span className="text-foreground">{immobilie.name}</span>
                </div>
              </div>
            )}
            {einheit && (
              <div className="flex items-center space-x-2">
                <Square className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">Einheit: </span>
                  <span className="text-foreground">
                    {einheit.einheitentyp} - {einheit.id?.slice(-2) || 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}