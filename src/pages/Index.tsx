
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { FehlendeMietzahlungen } from "@/components/dashboard/FehlendeMietzahlungen";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";

const Index = () => {
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    mietstatus: "all",
    zahlungsstatus: "all"
  });

  const { data: immobilien, isLoading, refetch } = useQuery({
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== "all").length;
  };

  const handleImmobilieClick = (immobilieId: string) => {
    setSelectedImmobilie(immobilieId);
  };

  const handleBackClick = () => {
    setSelectedImmobilie(null);
    // Refresh the immobilien data when going back
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen modern-dashboard-bg flex items-center justify-center">
        <div className="glass-card p-12 rounded-3xl">
          <Loader2 className="h-12 w-12 animate-spin text-red-500 mx-auto mb-6" />
          <p className="text-gray-700 font-sans font-medium text-lg text-center">Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  if (selectedImmobilie) {
    return (
      <ImmobilienDetail 
        immobilieId={selectedImmobilie}
        onBack={handleBackClick}
        filters={filters}
      />
    );
  }

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <img 
                src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" 
                alt="NiImmo Gruppe Logo" 
                className="h-16 w-auto mr-4"
              />
              <div>
                <h1 className="text-5xl font-sans font-bold text-gradient-red mb-2">
                  NiImmo Dashboard
                </h1>
                <p className="text-xl font-sans text-gray-600">
                  Immobilien Verwaltung
                </p>
              </div>
            </div>
            <div className="text-gray-500 font-sans">
              {new Date().toLocaleDateString('de-DE', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} • {new Date().toLocaleTimeString('de-DE', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
          
          <DashboardStats immobilien={immobilien} />
        </div>

        {/* Fehlende Mietzahlungen Übersicht */}
        <div className="mb-8">
          <FehlendeMietzahlungen />
        </div>

        {/* Filter Panel */}
        <FilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          activeFiltersCount={getActiveFiltersCount()}
        />

        {/* Immobilien Grid */}
        <div className="mb-6">
          <h2 className="text-2xl font-sans font-bold text-gray-800 mb-6">Ihre Immobilien</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {immobilien?.map((immobilie, index) => (
              <div 
                key={immobilie.id} 
                className="glass-card rounded-2xl overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer"
                style={{animationDelay: `${index * 0.1}s`}}
                onClick={() => handleImmobilieClick(immobilie.id)}
              >
                <ImmobilienCard
                  immobilie={immobilie}
                  onClick={() => handleImmobilieClick(immobilie.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {immobilien?.length === 0 && (
          <div className="text-center py-20">
            <div className="glass-card p-12 max-w-md mx-auto rounded-3xl">
              <div className="relative mb-8">
                <Building2 className="h-20 w-20 text-red-300 mx-auto floating-animation" />
              </div>
              <h3 className="text-2xl font-sans font-semibold text-gray-700 mb-4">
                Keine Immobilien gefunden
              </h3>
              <p className="text-gray-500 font-sans leading-relaxed">
                Beginnen Sie mit der Verwaltung Ihres Portfolios
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
