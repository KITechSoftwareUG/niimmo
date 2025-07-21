
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, CheckCircle, XCircle, Clock } from "lucide-react";

interface PaymentHistoryProps {
  payments: any[];
}

export const PaymentHistory = ({ payments }: PaymentHistoryProps) => {
  if (!payments || payments.length === 0) {
    return null;
  }

  return (
    <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <CardTitle className="flex items-center space-x-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Euro className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <span className="text-xl font-semibold text-gray-800">Zahlungshistorie</span>
            <p className="text-sm text-gray-600 font-normal mt-1">Übersicht der Zahlungseingänge</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-4">
          {payments.map((zahlung) => (
            <div key={zahlung.id} className="p-6 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${
                    zahlung.bezahlt_am 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {zahlung.bezahlt_am ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <XCircle className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">
                      {new Date(zahlung.monat).toLocaleDateString('de-DE', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {zahlung.bezahlt_am 
                          ? `Bezahlt am ${new Date(zahlung.bezahlt_am).toLocaleDateString('de-DE')}`
                          : 'Noch ausstehend'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {zahlung.betrag.toLocaleString()}€
                  </p>
                  <Badge 
                    variant={zahlung.bezahlt_am ? "default" : "destructive"}
                    className={`${
                      zahlung.bezahlt_am 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {zahlung.bezahlt_am ? '✓ Bezahlt' : '⚠ Offen'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
