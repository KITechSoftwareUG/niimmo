
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EinheitCard } from "./EinheitCard";
import { ArrowLeft, Building } from "lucide-react";
import { Loader2 } from "lucide-react";

interface ImmobilienDetailProps {
  immobilieId: string;
  onBack: () => void;
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
}

export const ImmobilienDetail = ({ immobilieId, onBack, filters }: ImmobilienDetailProps) => {
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
    queryKey: ['aktive-mietvertraege', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aktive_mietvertraege')
        .select('*')
        .eq('immobilie_id', immobilieId);
      
      if (error) throw error;
      return data;
    }
  });

  if (immobilieLoading || einheitenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Filter einheiten based on filters
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
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Übersicht
          </Button>
          
          <div className="flex items-center space-x-3 mb-2">
            <Building className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              {immobilie?.name}
            </h1>
          </div>
          
          <p className="text-gray-600">{immobilie?.adresse}</p>
          {immobilie?.beschreibung && (
            <p className="text-gray-500 mt-2">{immobilie.beschreibung}</p>
          )}
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
            <p className="text-gray-500">
              {(filters.mietstatus && filters.mietstatus !== "all") || (filters.zahlungsstatus && filters.zahlungsstatus !== "all")
                ? "Keine Einheiten entsprechen den Filterkriterien" 
                : "Keine Einheiten gefunden"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
