
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EinheitCard } from "./EinheitCard";
import { FilterPanel } from "./FilterPanel";
import { ArrowLeft, Building, MapPin, Calendar, Info } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface ImmobilienDetailProps {
  immobilieId: string;
  onBack: () => void;
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
}

export const ImmobilienDetail = ({ immobilieId, onBack, filters: initialFilters }: ImmobilienDetailProps) => {
  const [filters, setFilters] = useState(initialFilters);

  const { data: immobilie, isLoading: immobilieLoading } = useQuery({
    queryKey: ['immobilie', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('*')
        .eq('id', immobilieId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ['einheiten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('etage', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: mietvertraege } = useQuery({
    queryKey: ['mietvertraege-detail', immobilieId],
    queryFn: async () => {
      const einheitIds = einheiten?.map(e => e.id) || [];
      if (einheitIds.length === 0) return [];

      const { data: vertraege, error: vertraegeError } = await supabase
        .from('mietvertraege')
        .select('*')
        .in('einheit_id', einheitIds);
      
      if (vertraegeError) throw vertraegeError;

      const vertragIds = vertraege?.map(v => v.id) || [];
      if (vertragIds.length === 0) return vertraege;

      const { data: mietvertragMieter, error: mmError } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mietvertrag_id,
          rolle,
          mieter_id
        `)
        .in('mietvertrag_id', vertragIds);
      
      if (mmError) throw mmError;

      const mieterIds = mietvertragMieter?.map(mm => mm.mieter_id) || [];
      if (mieterIds.length === 0) return vertraege;

      const { data: mieter, error: mieterError } = await supabase
        .from('mieter')
        .select('id, Vorname, Nachname')
        .in('id', mieterIds);
      
      if (mieterError) throw mieterError;

      return vertraege?.map(vertrag => {
        const allMieterForVertrag = mietvertragMieter?.filter(mm => mm.mietvertrag_id === vertrag.id) || [];
        const mieterData = allMieterForVertrag.map(mvMieter => {
          const mieterInfo = mieter?.find(m => m.id === mvMieter.mieter_id);
          return {
            ...mieterInfo,
            rolle: mvMieter.rolle
          };
        }).filter(Boolean);
        
        return {
          ...vertrag,
          mieter: mieterData
        };
      }) || [];
    },
    enabled: !!einheiten
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== "all").length;
  };

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onBack();
  };

  if (immobilieLoading || einheitenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  let filteredEinheiten = einheiten || [];
  
  if (filters.mietstatus && filters.mietstatus !== "all") {
    const einheitenMitStatus = filteredEinheiten.map(einheit => {
      const vertrag = mietvertraege?.find(v => v.einheit_id === einheit.id);
      return { ...einheit, mietstatus: vertrag?.status || 'leerstehend' };
    });
    
    filteredEinheiten = einheitenMitStatus.filter(e => e.mietstatus === filters.mietstatus);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBackClick}
            className="mb-4 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Übersicht
          </Button>
          
          {/* Immobilien Header */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Building className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                      {immobilie?.name}
                    </CardTitle>
                    <div className="flex items-center text-gray-600 mb-2">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{immobilie?.adresse}</span>
                    </div>
                    {immobilie?.beschreibung && (
                      <p className="text-gray-500 mt-2">{immobilie.beschreibung}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {immobilie?.einheiten_anzahl} Einheiten
                  </Badge>
                  {immobilie?.objekttyp && (
                    <div className="text-sm text-gray-500">
                      {immobilie.objekttyp}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            {(immobilie?.baujahr || immobilie?.["Kontonr."] || immobilie?.["Annuität"]) && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  {immobilie?.baujahr && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Baujahr:</strong> {immobilie.baujahr}
                      </span>
                    </div>
                  )}
                  {immobilie?.["Kontonr."] && (
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Kontonr.:</strong> {immobilie["Kontonr."]}
                      </span>
                    </div>
                  )}
                  {immobilie?.["Annuität"] && (
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Annuität:</strong> €{immobilie["Annuität"]?.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          <FilterPanel 
            filters={filters}
            onFilterChange={handleFilterChange}
            activeFiltersCount={getActiveFiltersCount()}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEinheiten.map((einheit) => {
            const vertrag = mietvertraege?.find(v => v.einheit_id === einheit.id);
            return (
              <EinheitCard
                key={einheit.id}
                einheit={einheit}
                vertrag={vertrag}
                filters={filters}
              />
            );
          })}
        </div>

        {filteredEinheiten.length === 0 && (
          <div className="text-center py-12">
            <div className="glass-card p-8 max-w-md mx-auto rounded-2xl">
              <p className="text-gray-500">
                {getActiveFiltersCount() > 0
                  ? "Keine Einheiten entsprechen den Filterkriterien" 
                  : "Keine Einheiten gefunden"
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
