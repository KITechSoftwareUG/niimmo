
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, User, Building, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchPanelProps {
  onImmobilieSelect: (immobilieId: string) => void;
}

export const SearchPanel = ({ onImmobilieSelect }: SearchPanelProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: searchResults } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return { mieter: [], immobilien: [] };

      // Suche Mieter
      const { data: mieter, error: mieterError } = await supabase
        .from('mieter')
        .select(`
          id, 
          Vorname, 
          Nachname, 
          hauptmail,
          mietvertrag_mieter!inner(
            mietvertrag_id,
            mietvertrag!inner(
              einheit_id,
              einheiten!inner(
                immobilie_id,
                immobilien!inner(
                  id,
                  name,
                  adresse
                )
              )
            )
          )
        `)
        .or(`Vorname.ilike.%${searchTerm}%,Nachname.ilike.%${searchTerm}%,hauptmail.ilike.%${searchTerm}%`);

      if (mieterError) throw mieterError;

      // Suche Immobilien
      const { data: immobilien, error: immobilienError } = await supabase
        .from('immobilien')
        .select('id, name, adresse, einheiten_anzahl')
        .or(`name.ilike.%${searchTerm}%,adresse.ilike.%${searchTerm}%`);

      if (immobilienError) throw immobilienError;

      return { mieter: mieter || [], immobilien: immobilien || [] };
    },
    enabled: searchTerm.length >= 2
  });

  const handleImmobilieClick = (immobilieId: string) => {
    onImmobilieSelect(immobilieId);
    setSearchTerm("");
  };

  return (
    <Card className="mb-6 elegant-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-sans">
          <Search className="h-5 w-5" />
          Suche
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Input
            type="text"
            placeholder="Mieter oder Immobilie suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 modern-input font-sans"
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        {searchResults && searchTerm.length >= 2 && (
          <div className="mt-4 space-y-4 max-h-64 overflow-y-auto">
            {/* Mieter Ergebnisse */}
            {searchResults.mieter.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Mieter ({searchResults.mieter.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.mieter.map((mieter) => (
                    <div
                      key={mieter.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        const immobilie = mieter.mietvertrag_mieter[0]?.mietvertrag?.einheiten?.immobilien;
                        if (immobilie) {
                          handleImmobilieClick(immobilie.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {mieter.Vorname} {mieter.Nachname}
                          </p>
                          <p className="text-sm text-gray-600">{mieter.hauptmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {mieter.mietvertrag_mieter[0]?.mietvertrag?.einheiten?.immobilien?.name || 'Unbekannt'}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Immobilien Ergebnisse */}
            {searchResults.immobilien.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Immobilien ({searchResults.immobilien.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.immobilien.map((immobilie) => (
                    <div
                      key={immobilie.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handleImmobilieClick(immobilie.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{immobilie.name}</p>
                          <p className="text-sm text-gray-600">{immobilie.adresse}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {immobilie.einheiten_anzahl} Einheiten
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.mieter.length === 0 && searchResults.immobilien.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Keine Ergebnisse gefunden
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
