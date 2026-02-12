
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, User, Building, ArrowRight, Home, FileText } from "lucide-react";
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
      if (!searchTerm || searchTerm.length < 2) return { mietvertraege: [], immobilien: [], einheiten: [] };

      // Suche Mieter
      const { data: mieter, error: mieterError } = await supabase
        .from('mieter')
        .select(`
          id, vorname, nachname, hauptmail,
          mietvertrag_mieter!inner(
            mietvertrag_id,
            mietvertrag!inner(
              id, status, einheit_id,
              einheiten!inner(
                immobilie_id, etage,
                immobilien!inner(id, name, adresse)
              )
            )
          )
        `)
        .or(`vorname.ilike.%${searchTerm}%,nachname.ilike.%${searchTerm}%,hauptmail.ilike.%${searchTerm}%`);

      if (mieterError) throw mieterError;

      // Gruppiere nach Mietvertrag
      const contractMap = new Map<string, any>();
      for (const m of mieter || []) {
        for (const mm of m.mietvertrag_mieter) {
          const vertragId = mm.mietvertrag?.id;
          if (!vertragId) continue;
          if (!contractMap.has(vertragId)) {
            contractMap.set(vertragId, {
              mietvertragId: vertragId,
              status: mm.mietvertrag.status,
              einheit: mm.mietvertrag.einheiten,
              immobilie: mm.mietvertrag.einheiten?.immobilien,
              alleMieter: [],
            });
          }
        }
      }

      // Lade ALLE Mieter für die gefundenen Verträge
      const contractIds = Array.from(contractMap.keys());
      if (contractIds.length > 0) {
        const { data: alleMieterVertraege } = await supabase
          .from('mietvertrag_mieter')
          .select('mietvertrag_id, mieter(id, vorname, nachname)')
          .in('mietvertrag_id', contractIds);

        for (const mv of alleMieterVertraege || []) {
          const entry = contractMap.get(mv.mietvertrag_id);
          if (entry && mv.mieter) {
            const mieterData = mv.mieter as any;
            if (!entry.alleMieter.find((x: any) => x.id === mieterData.id)) {
              entry.alleMieter.push({ id: mieterData.id, vorname: mieterData.vorname, nachname: mieterData.nachname });
            }
          }
        }
      }

      const mietvertraege = Array.from(contractMap.values());

      // Suche Immobilien
      const { data: immobilien, error: immobilienError } = await supabase
        .from('immobilien')
        .select('id, name, adresse, einheiten_anzahl')
        .or(`name.ilike.%${searchTerm}%,adresse.ilike.%${searchTerm}%`);

      if (immobilienError) throw immobilienError;

      // Suche Einheiten
      const { data: einheiten, error: einheitenError } = await supabase
        .from('einheiten')
        .select(`
          id, zaehler, qm, etage, einheitentyp,
          strom_zaehler, gas_zaehler, kaltwasser_zaehler, warmwasser_zaehler,
          immobilie_id,
          immobilien!inner(id, name, adresse)
        `)
        .or(`strom_zaehler.ilike.%${searchTerm}%,gas_zaehler.ilike.%${searchTerm}%,kaltwasser_zaehler.ilike.%${searchTerm}%,warmwasser_zaehler.ilike.%${searchTerm}%,etage.ilike.%${searchTerm}%`);

      if (einheitenError) throw einheitenError;

      return { mietvertraege, immobilien: immobilien || [], einheiten: einheiten || [] };
    },
    enabled: searchTerm.length >= 2
  });

  const handleMietvertragClick = (mietvertragId: string) => {
    onMietvertragClick(mietvertragId);
    setSearchTerm("");
  };

  const handleImmobilieClick = (immobilieId: string, einheitId?: string) => {
    onImmobilieSelect(immobilieId, einheitId);
    setSearchTerm("");
  };

  const getFirstResult = () => {
    if (!searchResults) return null;
    if (searchResults.mietvertraege.length > 0) {
      return { type: 'mietvertrag' as const, mietvertragId: searchResults.mietvertraege[0].mietvertragId };
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
        if (firstResult.type === 'mietvertrag' && firstResult.mietvertragId) {
          handleMietvertragClick(firstResult.mietvertragId);
        } else if (firstResult.type === 'einheit') {
          handleImmobilieClick(firstResult.immobilieId, firstResult.einheitId);
        } else if (firstResult.type === 'immobilie') {
          handleImmobilieClick(firstResult.id);
        }
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktiv':
        return <Badge className="text-xs bg-green-100 text-green-700 border-green-300">aktiv</Badge>;
      case 'gekuendigt':
        return <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">gekündigt</Badge>;
      case 'beendet':
        return <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">beendet</Badge>;
      default:
        return null;
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
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        </div>

        {searchResults && searchTerm.length >= 2 && (
          <div className="mt-4 space-y-4 max-h-80 overflow-y-auto animate-fade-in border-t pt-4">
            {/* Mietverträge (gruppiert nach Vertrag mit allen Mietern) */}
            {(searchResults.mietvertraege?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Mietverträge ({searchResults.mietvertraege.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.mietvertraege.map((vertrag: any) => (
                    <div
                      key={vertrag.mietvertragId}
                      className="p-3 bg-background border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all cursor-pointer transform hover:scale-[1.02]"
                      onClick={() => handleMietvertragClick(vertrag.mietvertragId)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {vertrag.alleMieter.map((m: any) => `${m.vorname} ${m.nachname}`).join(', ')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {vertrag.immobilie?.name || 'Unbekannt'}
                            {vertrag.einheit?.etage ? ` · ${vertrag.einheit.etage}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(vertrag.status)}
                          <Badge variant="outline" className="text-xs">
                            {vertrag.immobilie?.name || 'Unbekannt'}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Immobilien ({searchResults.immobilien.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.immobilien.map((immobilie) => (
                    <div
                      key={immobilie.id}
                      data-immobilie-id={immobilie.id}
                      className="p-3 bg-background border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all cursor-pointer transform hover:scale-[1.02]"
                      onClick={() => handleImmobilieClick(immobilie.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{immobilie.name}</p>
                          <p className="text-sm text-muted-foreground">{immobilie.adresse}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {immobilie.einheiten_anzahl} Einheiten
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
                              {einheitLabel} – {einheit.immobilien?.name || 'Unbekannt'}
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

            {(searchResults.mietvertraege?.length ?? 0) === 0 && (searchResults.immobilien?.length ?? 0) === 0 && (searchResults.einheiten?.length ?? 0) === 0 && (
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
