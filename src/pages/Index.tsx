import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImmobilienCard } from "@/components/dashboard/ImmobilienCard";
import { ImmobilienDetail } from "@/components/dashboard/ImmobilienDetail";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { FehlendeMietzahlungen } from "@/components/dashboard/FehlendeMietzahlungen";
import { Analytics } from "@/components/dashboard/Analytics";
import { ZahlungenUebersicht } from "@/components/dashboard/ZahlungenUebersicht";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { EditableMietUebersichtModal } from "@/components/dashboard/EditableMietUebersichtModal";
import { RentIncreaseList } from "@/components/dashboard/rent-increase/RentIncreaseList";
import { PaymentManagement } from "@/components/controlboard/PaymentManagement";
import { Uebergabe } from "@/pages/Uebergabe";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

import { useState, useMemo } from "react";
import { Loader2, Building2, BarChart3, Euro, Settings, KeyRound, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sortPropertiesByName } from "@/utils/contractUtils";
const Index = () => {
  const { isAdmin, isHausmeister, isLoading: roleLoading } = useUserRole();
  const [selectedImmobilie, setSelectedImmobilie] = useState<string | null>(null);
  const [selectedEinheit, setSelectedEinheit] = useState<string | null>(null);
  const [selectedMietvertrag, setSelectedMietvertrag] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [showZahlungen, setShowZahlungen] = useState<boolean>(false);
  const [showMietUebersicht, setShowMietUebersicht] = useState<boolean>(false);
  const [navigationSource, setNavigationSource] = useState<'dashboard' | 'immobilie' | 'search'>('dashboard');
  const [rueckstaendeOpen, setRueckstaendeOpen] = useState<boolean>(false);
  const [rentIncreaseOpen, setRentIncreaseOpen] = useState<boolean>(false);
  const [listSource, setListSource] = useState<'rueckstaende' | 'rentincrease' | null>(null);
  const [scrollToContractId, setScrollToContractId] = useState<string | null>(null);
  const [showControlboard, setShowControlboard] = useState<boolean>(false);
  const [showUebergabe, setShowUebergabe] = useState<boolean>(false);
  const {
    data: immobilien,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['immobilien'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('immobilien').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Query to get unit status for each property for sorting by occupancy
  const {
    data: einheitenStatusMap
  } = useQuery({
    queryKey: ['einheiten-status-all'],
    queryFn: async () => {
      if (!immobilien) return {};
      const statusMap: Record<string, number> = {};
      for (const immobilie of immobilien) {
        // Get all units for this property
        const {
          data: einheiten,
          error: einheitenError
        } = await supabase.from('einheiten').select('id').eq('immobilie_id', immobilie.id);
        if (einheitenError) throw einheitenError;
        if (!einheiten || einheiten.length === 0) {
          statusMap[immobilie.id] = 0;
          continue;
        }

        // Get rental contracts for these units
        const einheitIds = einheiten.map(e => e.id);
        const {
          data: vertraege,
          error: vertraegeError
        } = await supabase.from('mietvertrag').select('status').in('einheit_id', einheitIds);
        if (vertraegeError) throw vertraegeError;
        const aktive = vertraege?.filter(v => v.status === 'aktiv').length || 0;
        const auslastung = Math.round(aktive / immobilie.einheiten_anzahl * 100);
        statusMap[immobilie.id] = auslastung;
      }
      return statusMap;
    },
    enabled: !!immobilien
  });

  // Sort immobilien using centralized utility
  const sortedImmobilien = useMemo(() => {
    if (!immobilien) return [];
    return sortPropertiesByName(immobilien);
  }, [immobilien]);
  const handleImmobilieClick = (immobilieId: string, einheitId?: string) => {
    setSelectedImmobilie(immobilieId);
    setSelectedEinheit(einheitId || null);
    setSelectedMietvertrag(null);
    setNavigationSource('immobilie');
  };
  const handleBackClick = () => {
    // Return to dashboard lists for dashboard-originated navigations
    if (navigationSource === 'dashboard' || listSource) {
      setSelectedImmobilie(null);
      setSelectedEinheit(null);
      setSelectedMietvertrag(null);
      setNavigationSource('dashboard');

      // Ensure the originating list is open and scroll to specific contract card
      setTimeout(() => {
        if (listSource === 'rueckstaende') {
          setRueckstaendeOpen(true);
          // Scroll to specific contract card if we have the ID
          if (scrollToContractId) {
            setTimeout(() => {
              const element = document.getElementById(`rueckstand-${scrollToContractId}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100); // Wait for list to open
          } else {
            document.getElementById('rueckstaende-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else if (listSource === 'rentincrease') {
          setRentIncreaseOpen(true);
          // Scroll to specific contract card if we have the ID
          if (scrollToContractId) {
            setTimeout(() => {
              const element = document.getElementById(`rentincrease-${scrollToContractId}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100); // Wait for list to open
          } else {
            document.getElementById('rentincrease-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        setListSource(null);
        setScrollToContractId(null);
      }, 0);
    } else if (navigationSource === 'search') {
      // Coming from search, go back to dashboard and scroll to search
      setSelectedImmobilie(null);
      setSelectedEinheit(null);
      setSelectedMietvertrag(null);
      setNavigationSource('dashboard');
      // Scroll to search panel after returning
      setTimeout(() => {
        document.getElementById('search-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      // Coming from immobilie view
      if (selectedMietvertrag) {
        // Close contract view/modal within immobilie context
        setSelectedMietvertrag(null);
      } else {
        // Go back to main dashboard overview
        setSelectedImmobilie(null);
        setSelectedEinheit(null);
        setNavigationSource('dashboard');
      }
    }
    // Refresh the immobilien data when going back
    refetch();
  };
  const handleNavigateToContract = (immobilieId: string, einheitId: string, mietvertragId: string) => {
    setSelectedImmobilie(immobilieId);
    setSelectedEinheit(einheitId);
    setSelectedMietvertrag(mietvertragId);
    setNavigationSource('dashboard');
  };

  const handleMietvertragClick = async (mietvertragId: string) => {
    const { data: mietvertrag } = await supabase
      .from('mietvertrag')
      .select(`einheit_id, einheiten (immobilie_id)`)
      .eq('id', mietvertragId)
      .maybeSingle(); // Use maybeSingle to handle cases where no data exists
      
    if (mietvertrag?.einheit_id && mietvertrag.einheiten?.immobilie_id) {
      setSelectedImmobilie(mietvertrag.einheiten.immobilie_id);
      setSelectedEinheit(mietvertrag.einheit_id);
      setSelectedMietvertrag(mietvertragId);
      setScrollToContractId(mietvertragId); // Store for scroll-back
      setNavigationSource('dashboard');
    }
  };

  const handleSearchMietvertragClick = async (mietvertragId: string) => {
    const { data: mietvertrag } = await supabase
      .from('mietvertrag')
      .select(`einheit_id, einheiten (immobilie_id)`)
      .eq('id', mietvertragId)
      .maybeSingle();
      
    if (mietvertrag?.einheit_id && mietvertrag.einheiten?.immobilie_id) {
      setSelectedImmobilie(mietvertrag.einheiten.immobilie_id);
      setSelectedEinheit(mietvertrag.einheit_id);
      setSelectedMietvertrag(mietvertragId);
      setNavigationSource('search');
    }
  };

  const handleSearchImmobilieClick = (immobilieId: string, einheitId?: string) => {
    setSelectedImmobilie(immobilieId);
    setSelectedEinheit(einheitId || null);
    setSelectedMietvertrag(null);
    setNavigationSource('search');
  };

  const handleRentIncreaseContractClick = async (mietvertragId: string) => {
    const { data: mietvertrag } = await supabase
      .from('mietvertrag')
      .select(`einheit_id, einheiten (immobilie_id)`)
      .eq('id', mietvertragId)
      .maybeSingle();
      
    if (mietvertrag?.einheit_id && mietvertrag.einheiten?.immobilie_id) {
      setSelectedImmobilie(mietvertrag.einheiten.immobilie_id);
      setSelectedEinheit(mietvertrag.einheit_id);
      setSelectedMietvertrag(mietvertragId);
      setScrollToContractId(mietvertragId); // Store for scroll-back
      setNavigationSource('dashboard');
    }
  };

  if (isLoading || roleLoading) {
    return <div className="min-h-screen modern-dashboard-bg flex items-center justify-center">
        <div className="glass-card p-12 rounded-3xl">
          <Loader2 className="h-12 w-12 animate-spin text-red-500 mx-auto mb-6" />
          <p className="text-gray-700 font-sans font-medium text-lg text-center">Dashboard wird geladen...</p>
        </div>
      </div>;
  }

  // Analytics-Ansicht anzeigen
  if (showAnalytics) {
    return <Analytics onBack={() => setShowAnalytics(false)} />;
  }

  // Zahlungen-Ansicht anzeigen
  if (showZahlungen) {
    return <ZahlungenUebersicht onBack={() => setShowZahlungen(false)} />;
  }

  // Controlboard-Ansicht anzeigen
  if (showControlboard) {
    return <PaymentManagement onBack={() => setShowControlboard(false)} />;
  }

  // Übergabe-Ansicht anzeigen
  if (showUebergabe) {
    return <Uebergabe onBack={() => setShowUebergabe(false)} />;
  }


  if (selectedImmobilie) {
    return <ImmobilienDetail 
      immobilieId={selectedImmobilie} 
      onBack={handleBackClick} 
      filters={{
        mietstatus: "all",
        zahlungsstatus: "all",
        vertragsart: "all"
      }} 
      scrollToEinheitId={selectedEinheit} 
      openMietvertragId={selectedMietvertrag} 
      onContractModalClose={() => {
        // If user came from a dashboard list (Rückstände or Mieterhöhungen), go back to that list
        if (listSource) {
          handleBackClick();
        } else {
          setSelectedMietvertrag(null);
        }
      }}
      isHausmeister={isHausmeister}
    />;
  }
  return <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
            <div className="flex flex-col gap-4">
              {/* Logo & Title Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <img src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" alt="NiImmo Logo" className="h-8 sm:h-12 w-auto" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-sans font-bold text-gradient-red">
                        NiImmo
                      </h1>
                      {isHausmeister && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                          <Wrench className="h-3 w-3 mr-1" />
                          Hausmeister
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-600 font-sans text-xs sm:text-sm hidden sm:block">
                      {isHausmeister ? "Zähler & Einheiten" : "Zentrale Verwaltung"}
                    </p>
                  </div>
                </div>
                <UserMenu />
              </div>
              
              {/* Action Buttons - Only for Admin */}
              {isAdmin && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
                  <Button 
                    onClick={() => setShowAnalytics(true)} 
                    variant="ghost"
                    size="sm"
                    className="bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-gray-200/50 text-gray-700 hover:text-gray-900 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                  >
                    <BarChart3 className="h-4 w-4 mr-1.5" />
                    Analytics
                  </Button>
                  <Button 
                    onClick={() => setShowControlboard(true)} 
                    variant="ghost"
                    size="sm"
                    className="bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-gray-200/50 text-gray-700 hover:text-gray-900 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                  >
                    <Settings className="h-4 w-4 mr-1.5" />
                    Controlboard
                  </Button>
                  <Button 
                    onClick={() => setShowZahlungen(true)} 
                    variant="ghost"
                    size="sm"
                    className="bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-gray-200/50 text-gray-700 hover:text-gray-900 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                  >
                    <Euro className="h-4 w-4 mr-1.5" />
                    Zahlungen
                  </Button>
                  <Button 
                    onClick={() => setShowUebergabe(true)} 
                    variant="ghost"
                    size="sm"
                    className="bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-gray-200/50 text-gray-700 hover:text-gray-900 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                  >
                    <KeyRound className="h-4 w-4 mr-1.5" />
                    Übergabe
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Dashboard Stats - Only for Admin */}
          {isAdmin && (
            <DashboardStats 
              immobilien={immobilien} 
              onNavigateToContract={handleNavigateToContract}
              onShowMietUebersicht={() => setShowMietUebersicht(true)}
            />
          )}
        </div>

        {/* Fehlende Mietzahlungen Übersicht - Only for Admin */}
        {isAdmin && (
          <div className="mb-6">
            <FehlendeMietzahlungen 
              open={rueckstaendeOpen}
              onOpenChange={setRueckstaendeOpen}
              onMietvertragClick={(id) => { setListSource('rueckstaende'); setRueckstaendeOpen(true); handleMietvertragClick(id); }} 
            />
          </div>
        )}

        {/* Mögliche Mieterhöhungen - Only for Admin */}
        {isAdmin && (
          <div className="mb-6">
            <RentIncreaseList 
              open={rentIncreaseOpen}
              onOpenChange={setRentIncreaseOpen}
              onContractClick={(id) => { setListSource('rentincrease'); setRentIncreaseOpen(true); handleRentIncreaseContractClick(id); }}
            />
          </div>
        )}

        {/* Suchfunktion */}
        <div id="search-panel">
          <SearchPanel 
            onImmobilieSelect={handleSearchImmobilieClick}
            onMietvertragClick={handleSearchMietvertragClick}
          />
        </div>

        {/* Immobilien Grid */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-2xl font-sans font-bold text-gray-800">Ihre Immobilien</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {sortedImmobilien?.map((immobilie, index) => (
              <div 
                key={immobilie.id} 
                className="glass-card rounded-2xl overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer" 
                style={{ animationDelay: `${index * 0.1}s` }} 
                onClick={() => handleImmobilieClick(immobilie.id)}
              >
                <ImmobilienCard immobilie={immobilie} onClick={() => handleImmobilieClick(immobilie.id)} />
              </div>
            ))}
          </div>
        </div>

        {sortedImmobilien?.length === 0 && <div className="text-center py-20">
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
          </div>}
      </div>
      
      {/* Mietübersicht Modal - Only for Admin */}
      {isAdmin && (
        <EditableMietUebersichtModal 
          open={showMietUebersicht} 
          onOpenChange={setShowMietUebersicht} 
        />
      )}
    </div>;
};
export default Index;