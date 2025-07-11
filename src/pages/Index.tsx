import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { FehlendeMietzahlungen } from "@/components/dashboard/FehlendeMietzahlungen";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";

const Index = () => {
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);

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
        filters={{
          mietstatus: "all",
          zahlungsstatus: "all"
        }}
      />
    );
  }

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="glass-card p-6 rounded-2xl mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img 
                  src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" 
                  alt="NiImmo Logo" 
                  className="h-12 w-auto"
                />
                <div>
                  <h1 className="text-3xl font-sans font-bold text-gradient-red">
                    NiImmo Dashboard
                  </h1>
                  <p className="text-gray-600 font-sans text-sm">
                    Zentrale Verwaltung für Mieter, Zahlungen und Immobilien
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <UserMenu />
                <div className="text-right">
                  <div className="text-sm text-gray-500 font-sans mb-1">System Status</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-sans text-gray-700">Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DashboardStats immobilien={immobilien} />
        </div>

        {/* Suchfunktion */}
        <SearchPanel onImmobilieSelect={handleImmobilieClick} />

        {/* Fehlende Mietzahlungen Übersicht */}
        <div className="mb-6">
          <FehlendeMietzahlungen />
        </div>

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
