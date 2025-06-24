
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Building, Home, Euro, Calendar, MapPin } from "lucide-react";

interface MietvertragInfoProps {
  vertrag: any;
  einheit: any;
  immobilie: any;
}

export const MietvertragInfo = ({ vertrag, einheit, immobilie }: MietvertragInfoProps) => {
  return (
    <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <CardTitle className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-xl font-semibold text-gray-800">Vertragsdetails</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Immobilie & Einheit Section */}
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-3 mb-4">
                <Building className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">Immobilie</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Name</label>
                  <p className="text-lg font-semibold text-gray-900">{immobilie?.name || 'Nicht verfügbar'}</p>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Adresse</label>
                    <p className="text-gray-700">{immobilie?.adresse || 'Nicht verfügbar'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
              <div className="flex items-center space-x-3 mb-4">
                <Home className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-800">Einheit</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Einheit ID</label>
                  <p className="text-gray-900 font-mono text-sm bg-white px-3 py-2 rounded-lg border">
                    {einheit?.id?.slice(0, 8) || 'Keine ID'}...
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Etage</label>
                  <p className="text-gray-900">{einheit?.etage || 'Nicht angegeben'}</p>
                </div>
                {einheit?.qm && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Größe</label>
                    <p className="text-gray-900">{einheit.qm} m²</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mietdaten Section */}
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-100">
              <div className="flex items-center space-x-3 mb-4">
                <Euro className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-800">Mietkosten</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-4 rounded-lg border border-red-100">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Kaltmiete</label>
                  <p className="text-2xl font-bold text-red-600">
                    {vertrag?.kaltmiete ? `${vertrag.kaltmiete.toLocaleString()}€` : 'Nicht angegeben'}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-red-100">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Warmmiete</label>
                  <p className="text-2xl font-bold text-gray-800">
                    {vertrag?.warmmiete ? `${vertrag.warmmiete.toLocaleString()}€` : 'Nicht angegeben'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-800">Laufzeit</h3>
              </div>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-purple-100">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Vertragsbeginn</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {vertrag?.start_datum 
                      ? new Date(vertrag.start_datum).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Nicht angegeben'
                    }
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-purple-100">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Vertragsende</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {vertrag?.ende_datum 
                      ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Unbefristet'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
