
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, User, Building, ArrowRight, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchPanelProps {
  onImmobilieSelect: (immobilieId: string, einheitId?: string) => void;
  onMietvertragClick: (mietvertragId: string) => void;
}

export const SearchPanel = ({ onImmobilieSelect, onMietvertragClick }: SearchPanelProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: searchResults } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return { mieter: [], immobilien: [], einheiten: [] };

      // Suche Mieter (inklusive beendete Mietverträge)
      const { data: mieter, error: mieterError } = await supabase
        .from('mieter')
        .select(`
          id, 
          vorname, 
          nachname, 
          hauptmail,
          mietvertrag_mieter!inner(
            mietvertrag_id,
            mietvertrag!inner(
              id,
              status,
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
        .or(`vorname.ilike.%${searchTerm}%,nachname.ilike.%${searchTerm}%,hauptmail.ilike.%${searchTerm}%`);

      if (mieterError) throw mieterError;

      // Suche Immobilien
      const { data: immobilien, error: immobilienError } = await supabase
        .from('immobilien')
        .select('id, name, adresse, einheiten_anzahl')
        .or(`name.ilike.%${searchTerm}%,adresse.ilike.%${searchTerm}%`);

      if (immobilienError) throw immobilienError;

      // Suche Einheiten (Zählernummern, Etage, etc.)
      const { data: einheiten, error: einheitenError } = await supabase
        .from('einheiten')
        .select(`
          id,
          zaehler,
          qm,
          etage,
          einheitentyp,
          strom_zaehler,
          gas_zaehler,
          kaltwasser_zaehler,
          warmwasser_zaehler,
          immobilie_id,
          immobilien!inner(id, name, adresse)
        `)
        .or(`strom_zaehler.ilike.%${searchTerm}%,gas_zaehler.ilike.%${searchTerm}%,kaltwasser_zaehler.ilike.%${searchTerm}%,warmwasser_zaehler.ilike.%${searchTerm}%,etage.ilike.%${searchTerm}%`);

      if (einheitenError) throw einheitenError;

      return { mieter: mieter || [], immobilien: immobilien || [], einheiten: einheiten || [] };
    },
    enabled: searchTerm.length >= 2
  });

  const handleMieterClick = (mieter: any) => {
    const mietvertragId = mieter.mietvertrag_mieter[0]?.mietvertrag?.id;
    if (mietvertragId) {
      // Add loading feedback
      const button = document.querySelector(`[data-mieter-id="${mieter.id}"]`);
      if (button) {
        button.classList.add('animate-pulse', 'opacity-75');
      }
      
      setTimeout(() => {
        onMietvertragClick(mietvertragId);
        setSearchTerm("");
      }, 200);
    }
  };

  const handleImmobilieClick = (immobilieId: string, einheitId?: string) => {
    // Add loading feedback  
    const button = document.querySelector(`[data-immobilie-id="${immobilieId}"]`);
    if (button) {
      button.classList.add('animate-pulse', 'opacity-75');
    }
    
    setTimeout(() => {
      onImmobilieSelect(immobilieId, einheitId);
      setSearchTerm("");
    }, 200);
  };
  const getFirstResult = () => {
    if (!searchResults) return null;
    if (searchResults.mieter.length > 0) {
      const mieter = searchResults.mieter[0];
      const mietvertragId = mieter.mietvertrag_mieter[0]?.mietvertrag?.id;
      if (mietvertragId) {
        return { type: 'mieter' as const, mietvertragId };
      }
    }
    if (searchResults.einheiten.length > 0) {
      const einheit = searchResults.einheiten[0];
      return { type: 'einheit' as const, immobilieId: einheit.immobilie_id, einheitId: einheit.id };
    }
    if (searchResults.immobilien.length > 0) {
      return { type: 'immobilie' as const, id: searchResults.immobilien[0].id };
    }
    return null;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.length >= 2) {
      const firstResult = getFirstResult();
      if (firstResult) {
        if (firstResult.type === 'mieter' && firstResult.mietvertragId) {
          onMietvertragClick(firstResult.mietvertragId);
          setSearchTerm("");
        } else if (firstResult.type === 'einheit') {
          handleImmobilieClick(firstResult.immobilieId, firstResult.einheitId);
        } else if (firstResult.type === 'immobilie') {
          handleImmobilieClick(firstResult.id);
        }
      }
    }
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
            placeholder="Mieter, Immobilie oder Zählernummer suchen... (Enter für erstes Ergebnis)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10 modern-input font-sans"
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        {searchResults && searchTerm.length >= 2 && (
          <div className="mt-4 space-y-4 max-h-80 overflow-y-auto animate-fade-in border-t pt-4">
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
                      data-mieter-id={mieter.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-red-300 transition-all cursor-pointer transform hover:scale-[1.02]"
                      onClick={() => handleMieterClick(mieter)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {mieter.vorname} {mieter.nachname}
                            {mieter.mietvertrag_mieter[0]?.mietvertrag?.status === 'beendet' && 
                              <span className="ml-2 text-xs text-gray-500">(ehemaliger Mieter)</span>
                            }
                          </p>
                          <p className="text-sm text-gray-600">{mieter.hauptmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              mieter.mietvertrag_mieter[0]?.mietvertrag?.status === 'beendet' 
                                ? 'border-gray-400 text-gray-600' 
                                : ''
                            }`}
                          >
                            {mieter.mietvertrag_mieter[0]?.mietvertrag?.einheiten?.immobilien?.name || 'Unbekannt'}
                          </Badge>
                          {mieter.mietvertrag_mieter[0]?.mietvertrag?.status === 'beendet' && (
                            <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-700">
                              beendet
                            </Badge>
                          )}
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
                      data-immobilie-id={immobilie.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer transform hover:scale-[1.02]"
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

            {/* Einheiten Ergebnisse */}
            {searchResults.einheiten.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Einheiten ({searchResults.einheiten.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.einheiten.map((einheit: any) => {
                    const matchedZaehler = [
                      einheit.strom_zaehler && einheit.strom_zaehler.toLowerCase().includes(searchTerm.toLowerCase()) ? `Strom: ${einheit.strom_zaehler}` : null,
                      einheit.gas_zaehler && einheit.gas_zaehler.toLowerCase().includes(searchTerm.toLowerCase()) ? `Gas: ${einheit.gas_zaehler}` : null,
                      einheit.kaltwasser_zaehler && einheit.kaltwasser_zaehler.toLowerCase().includes(searchTerm.toLowerCase()) ? `Kaltwasser: ${einheit.kaltwasser_zaehler}` : null,
                      einheit.warmwasser_zaehler && einheit.warmwasser_zaehler.toLowerCase().includes(searchTerm.toLowerCase()) ? `Warmwasser: ${einheit.warmwasser_zaehler}` : null,
                    ].filter(Boolean);

                    const einheitLabel = einheit.zaehler 
                      ? `Einheit ${String(einheit.zaehler).padStart(2, '0')}` 
                      : `Einheit ${einheit.id.slice(-2)}`;

                    return (
                      <div
                        key={einheit.id}
                        className="p-3 bg-background border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all cursor-pointer transform hover:scale-[1.02]"
                        onClick={() => handleImmobilieClick(einheit.immobilie_id, einheit.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              {einheitLabel} – {(einheit as any).immobilien?.name || 'Unbekannt'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {matchedZaehler.length > 0 ? matchedZaehler.join(' · ') : einheit.etage ? `Etage: ${einheit.etage}` : ''}
                              {einheit.qm ? ` · ${einheit.qm} m²` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {einheit.einheitentyp || 'Einheit'}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {searchResults.mieter.length === 0 && searchResults.immobilien.length === 0 && searchResults.einheiten.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                Keine Ergebnisse gefunden
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
