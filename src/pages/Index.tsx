
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { useState } from "react";
import { Loader2, Building2, Sparkles } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center luxury-gradient">
        <div className="glass-card p-8 rounded-2xl">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white font-medium text-lg">Dashboard wird geladen...</p>
        </div>
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
      {/* Luxurious Header with enhanced gradients */}
      <div className="luxury-gradient text-white py-16 px-6 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white rounded-full filter blur-3xl animate-float"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-white rounded-full filter blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-20 left-1/3 w-28 h-28 bg-white rounded-full filter blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-6">
              <div className="p-4 glass-card rounded-2xl floating-animation">
                <img 
                  src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" 
                  alt="NiImmo Gruppe Logo" 
                  className="h-20 w-auto"
                />
              </div>
              <div>
                <h1 className="text-6xl font-display font-bold mb-4 text-shadow elegant-text text-white">
                  Immobilien Dashboard
                </h1>
                <p className="text-red-100 text-xl font-medium tracking-wide">
                  Professionelle Verwaltung Ihrer Immobilienportfolios
                </p>
                <div className="flex items-center mt-3 space-x-2">
                  <Sparkles className="h-5 w-5 text-red-200" />
                  <span className="text-red-200 text-sm font-medium">
                    Premium Management System
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="glass-card p-6 rounded-2xl">
                <Building2 className="h-16 w-16 text-white mx-auto mb-2" />
                <div className="text-3xl font-bold text-white">
                  {immobilien?.length || 0}
                </div>
                <div className="text-red-100 text-sm font-medium">
                  Immobilien
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with enhanced styling */}
      <div className="relative px-6 py-12" style={{
        background: 'linear-gradient(135deg, rgba(255, 250, 250, 0.9) 0%, rgba(255, 245, 245, 0.8) 50%, rgba(254, 242, 242, 0.9) 100%)'
      }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <FilterPanel filters={filters} onFiltersChange={setFilters} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {immobilien?.map((immobilie, index) => (
              <div 
                key={immobilie.id} 
                className="premium-card rounded-2xl overflow-hidden cursor-pointer group"
                style={{animationDelay: `${index * 0.1}s`}}
                onClick={() => setSelectedImmobilie(immobilie.id)}
              >
                <ImmobilienCard
                  immobilie={immobilie}
                  onClick={() => setSelectedImmobilie(immobilie.id)}
                />
              </div>
            ))}
          </div>

          {immobilien?.length === 0 && (
            <div className="text-center py-20">
              <div className="premium-card p-12 max-w-md mx-auto rounded-3xl">
                <div className="relative mb-6">
                  <Building2 className="h-20 w-20 text-red-300 mx-auto animate-pulse-glow" />
                  <div className="absolute inset-0 bg-red-100 rounded-full filter blur-xl opacity-50"></div>
                </div>
                <h3 className="text-2xl font-display font-semibold text-gray-700 mb-2">
                  Keine Immobilien gefunden
                </h3>
                <p className="text-gray-500">
                  Beginnen Sie mit der Verwaltung Ihres Portfolios
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
