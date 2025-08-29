
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Euro, Calendar, User } from "lucide-react";
import { useFehlendeMietzahlungen } from "@/hooks/useFehlendeMietzahlungen";
import { Button } from "@/components/ui/button";

interface FehlendeMietzahlungenProps {
  onMietvertragClick?: (mietvertragId: string) => void;
}

export const FehlendeMietzahlungen = ({ onMietvertragClick }: FehlendeMietzahlungenProps) => {
  const { data: rueckstaende } = useFehlendeMietzahlungen();

  const gesamtRueckstand = rueckstaende?.reduce((sum, item) => sum + item.fehlend_betrag, 0) || 0;

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Rückstände</h2>
            <p className="text-sm text-gray-600">Mietverträge mit offenen Forderungen</p>
          </div>
        </div>
        
        {gesamtRueckstand > 0 && (
          <div className="text-right">
            <p className="text-sm text-gray-600">Gesamtrückstand</p>
            <p className="text-2xl font-bold text-red-600">{formatBetrag(gesamtRueckstand)}</p>
          </div>
        )}
      </div>

      {/* Contract List */}
      {rueckstaende && rueckstaende.length > 0 ? (
        <div className="space-y-4">
          {rueckstaende.map((rueckstand) => (
            <Card 
              key={rueckstand.mietvertrag_id} 
              className="border border-red-200 bg-red-50/30 hover:bg-red-50/50 transition-colors cursor-pointer"
              onClick={() => onMietvertragClick?.(rueckstand.mietvertrag_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    {/* Property and Unit Info */}
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {rueckstand.immobilie_name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {rueckstand.einheit_typ} - {rueckstand.einheit_etage}
                      </Badge>
                    </div>
                    
                    {/* Address */}
                    <p className="text-sm text-gray-600">{rueckstand.immobilie_adresse}</p>
                    
                    {/* Tenant Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{rueckstand.mieter_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Euro className="h-4 w-4" />
                        <span>Kaltmiete: {formatBetrag(rueckstand.kaltmiete)}</span>
                      </div>
                      {rueckstand.einheit_qm > 0 && (
                        <span>{rueckstand.einheit_qm} m²</span>
                      )}
                    </div>

                    {/* Payment Summary */}
                    <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
                      <div>
                        <p className="text-gray-600">Forderungen</p>
                        <p className="font-medium">{formatBetrag(rueckstand.gesamt_forderungen)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Zahlungen</p>
                        <p className="font-medium text-green-600">{formatBetrag(rueckstand.gesamt_zahlungen)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Rückstand</p>
                        <p className="font-bold text-red-600">{formatBetrag(rueckstand.fehlend_betrag)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="flex flex-col items-end gap-2 ml-4">
                    {/* Mahnstufe */}
                    {rueckstand.mahnstufe > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        Mahnstufe {rueckstand.mahnstufe}
                      </Badge>
                    )}
                    
                    {/* View Button */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMietvertragClick?.(rueckstand.mietvertrag_id);
                      }}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Summary Footer */}
          <div className="pt-4 border-t border-red-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {rueckstaende.length} Mietvertrag{rueckstaende.length !== 1 ? 'e' : ''} mit Rückständen
              </p>
              <p className="font-semibold text-red-600">
                Gesamtrückstand: {formatBetrag(gesamtRueckstand)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="p-6 bg-green-50 rounded-lg border border-green-200 inline-block">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-green-100 rounded-full">
                <Euro className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-green-700 font-medium text-lg">Keine Rückstände</p>
              <p className="text-green-600 text-sm">Alle Mietverträge sind auf dem aktuellen Stand</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
