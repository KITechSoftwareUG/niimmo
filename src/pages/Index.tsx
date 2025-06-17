
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    mietstatus: "all",
    zahlungsstatus: "all"
  });

  const { data: immobilien, isLoading } = useQuery({
    queryKey: ['immobilien'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (selectedImmobilie) {
    return (
      <ImmobilienDetail 
        immobilieId={selectedImmobilie}
        onBack={() => setSelectedImmobilie(null)}
        filters={filters}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Immobilien-Dashboard
          </h1>
          <p className="text-gray-600">
            Übersicht aller Immobilien und deren Verwaltung
          </p>
        </div>

        <FilterPanel filters={filters} onFiltersChange={setFilters} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {immobilien?.map((immobilie) => (
            <ImmobilienCard
              key={immobilie.id}
              immobilie={immobilie}
              onClick={() => setSelectedImmobilie(immobilie.id)}
            />
          ))}
        </div>

        {immobilien?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Keine Immobilien gefunden</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
