
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { FehlendeMietzahlungen } from "@/components/dashboard/FehlendeMietzahlungen";
import { Analytics } from "@/components/dashboard/Analytics";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { ImmobilienSorting } from "@/components/dashboard/ImmobilienSorting";
import { useState, useMemo } from "react";
import { Loader2, Building2, BarChart3, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  // Query to get unit status for each property for sorting by occupancy
  const { data: einheitenStatusMap } = useQuery({
    queryKey: ['einheiten-status-all'],
    queryFn: async () => {
      if (!immobilien) return {};

      const statusMap: Record<string, number> = {};
      
      for (const immobilie of immobilien) {
        // Get all units for this property
        const { data: einheiten, error: einheitenError } = await supabase
          .from('einheiten')
          .select('id')
          .eq('immobilie_id', immobilie.id);
        
        if (einheitenError) throw einheitenError;

        if (!einheiten || einheiten.length === 0) {
          statusMap[immobilie.id] = 0;
          continue;
        }

        // Get rental contracts for these units
        const einheitIds = einheiten.map(e => e.id);
        const { data: vertraege, error: vertraegeError } = await supabase
          .from('mietvertrag')
          .select('status')
          .in('einheit_id', einheitIds);
        
        if (vertraegeError) throw vertraegeError;
        
        const aktive = vertraege?.filter(v => v.status === 'aktiv').length || 0;
        const auslastung = Math.round((aktive / immobilie.einheiten_anzahl) * 100);
        statusMap[immobilie.id] = auslastung;
      }
      
      return statusMap;
    },
    enabled: !!immobilien
  });

  // Sort immobilien based on selected criteria
  const sortedImmobilien = useMemo(() => {
    if (!immobilien) return [];

    return [...immobilien].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'einheiten_anzahl':
          aValue = a.einheiten_anzahl;
          bValue = b.einheiten_anzahl;
          break;
        case 'auslastung':
          aValue = einheitenStatusMap?.[a.id] || 0;
          bValue = einheitenStatusMap?.[b.id] || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [immobilien, sortField, sortOrder, einheitenStatusMap]);

  const handleSortChange = (field: string, order: 'asc' | 'desc') => {
    setSortField(field);
    setSortOrder(order);
  };

  const [selectedEinheit, setSelectedEinheit] = useState<string | null>(null);

  const handleImmobilieClick = (immobilieId: string, einheitId?: string) => {
    setSelectedImmobilie(immobilieId);
    setSelectedEinheit(einheitId || null);
  };

  const handleBackClick = () => {
    setSelectedImmobilie(null);
    setSelectedEinheit(null);
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

  // Analytics-Ansicht anzeigen
  if (showAnalytics) {
    return <Analytics onBack={() => setShowAnalytics(false)} />;
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
        scrollToEinheitId={selectedEinheit}
      />
    );
  }

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="glass-card p-6 rounded-2xl mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <img 
                  src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" 
                  alt="NiImmo Logo" 
                  className="h-12 w-auto"
                />
                <div>
                  <h1 className="text-2xl lg:text-3xl font-sans font-bold text-gradient-red">
                    NiImmo Dashboard
                  </h1>
                  <p className="text-gray-600 font-sans text-sm">
                    Zentrale Verwaltung für Mieter, Zahlungen und Immobilien
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button 
                  onClick={() => setShowAnalytics(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <UserMenu />
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-sans font-bold text-gray-800">Ihre Immobilien</h2>
          </div>
          
          {/* Sortierung */}
          <ImmobilienSorting onSortChange={handleSortChange} />

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {sortedImmobilien?.map((immobilie, index) => (
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

        {sortedImmobilien?.length === 0 && (
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
