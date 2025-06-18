
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
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
    <div className="min-h-screen">
      {/* Header with gradient background */}
      <div className="gradient-bg text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" 
                alt="NiImmo Gruppe Logo" 
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  Immobilien-Dashboard
                </h1>
                <p className="text-red-100 text-lg">
                  Übersicht aller Immobilien und deren Verwaltung
                </p>
              </div>
            </div>
            <Building2 className="h-12 w-12 text-red-100" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="bg-gradient-to-b from-red-50 to-white min-h-screen px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <FilterPanel filters={filters} onFiltersChange={setFilters} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {immobilien?.map((immobilie) => (
              <div key={immobilie.id} className="card-shadow rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-105">
                <ImmobilienCard
                  immobilie={immobilie}
                  onClick={() => setSelectedImmobilie(immobilie.id)}
                />
              </div>
            ))}
          </div>

          {immobilien?.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-white rounded-lg shadow-sm p-8 max-w-md mx-auto">
                <Building2 className="h-16 w-16 text-red-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Keine Immobilien gefunden</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
