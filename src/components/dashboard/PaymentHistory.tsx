
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Euro, CheckCircle, XCircle } from "lucide-react";

interface PaymentHistoryProps {
  payments: any[];
}

export const PaymentHistory = ({ payments }: PaymentHistoryProps) => {
  if (!payments || payments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Euro className="h-5 w-5" />
          <span>Zahlungshistorie (Beispiel)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payments.map((zahlung) => (
            <div key={zahlung.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {zahlung.bezahlt_am ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">
                    {new Date(zahlung.monat).toLocaleDateString('de-DE', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {zahlung.bezahlt_am 
                      ? `Bezahlt am ${new Date(zahlung.bezahlt_am).toLocaleDateString('de-DE')}`
                      : 'Noch offen'
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{zahlung.betrag}€</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
