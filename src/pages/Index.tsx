
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";

const Index = () => {
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);

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
      <div className="min-h-screen modern-dashboard-bg flex items-center justify-center">
        <div className="elegant-card p-12 rounded-3xl">
          <Loader2 className="h-12 w-12 animate-spin text-red-500 mx-auto mb-6" />
          <p className="text-gray-700 font-medium text-lg text-center">Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  if (selectedImmobilie) {
    return (
      <div className="min-h-screen modern-dashboard-bg">
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1">
            <ImmobilienDetail 
              immobilieId={selectedImmobilie}
              onBack={() => setSelectedImmobilie(null)}
              filters={{ mietstatus: "all", zahlungsstatus: "all" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="flex">
        <DashboardSidebar />
        
        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-sans font-bold text-gradient-red mb-2">
                  Immobilien Dashboard
                </h1>
                <p className="text-gray-600 text-lg font-sans">
                  Willkommen zurück! Hier ist Ihre Übersicht.
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold font-sans text-gray-800 mb-1">
                  {new Date().toLocaleDateString('de-DE', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="text-gray-500 font-sans">
                  {new Date().toLocaleTimeString('de-DE', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
            
            <DashboardStats immobilien={immobilien} />
          </div>

          {/* Property Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {immobilien?.map((immobilie, index) => (
              <div 
                key={immobilie.id} 
                className="elegant-card rounded-2xl overflow-hidden cursor-pointer group"
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
              <div className="elegant-card p-12 max-w-md mx-auto rounded-3xl">
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
    </div>
  );
};

export default Index;
