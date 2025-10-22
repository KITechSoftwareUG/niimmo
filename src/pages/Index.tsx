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
import { InvoiceTool } from "@/components/dashboard/InvoiceTool";

import { useState, useMemo } from "react";
import { Loader2, Building2, BarChart3, Euro, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sortPropertiesByName } from "@/utils/contractUtils";
const Index = () => {
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
  const [showInvoiceTool, setShowInvoiceTool] = useState<boolean>(false);
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

  if (isLoading) {
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


  if (selectedImmobilie) {
    return <ImmobilienDetail immobilieId={selectedImmobilie} onBack={handleBackClick} filters={{
      mietstatus: "all",
      zahlungsstatus: "all"
    }} scrollToEinheitId={selectedEinheit} openMietvertragId={selectedMietvertrag} onContractModalClose={() => {
      // If user came from a dashboard list (Rückstände or Mieterhöhungen), go back to that list
      if (listSource) {
        handleBackClick();
      } else {
        setSelectedMietvertrag(null);
      }
    }} />;
  }
  return <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="glass-card p-6 rounded-2xl mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" alt="NiImmo Logo" className="h-12 w-auto" />
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
                <Button onClick={() => setShowAnalytics(true)} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
                <Button 
                  onClick={() => setShowInvoiceTool(true)} 
                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Rechnungstool
                </Button>
                <Button onClick={() => setShowZahlungen(true)} className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto">
                  <Euro className="h-4 w-4 mr-2" />
                  Zahlungen
                </Button>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <UserMenu />
                </div>
              </div>
            </div>
          </div>
          
          <DashboardStats 
            immobilien={immobilien} 
            onNavigateToContract={handleNavigateToContract}
            onShowMietUebersicht={() => setShowMietUebersicht(true)}
          />
        </div>

        {/* Fehlende Mietzahlungen Übersicht */}
        <div className="mb-6">
          <FehlendeMietzahlungen 
            open={rueckstaendeOpen}
            onOpenChange={setRueckstaendeOpen}
            onMietvertragClick={(id) => { setListSource('rueckstaende'); setRueckstaendeOpen(true); handleMietvertragClick(id); }} 
          />
        </div>

        {/* Mögliche Mieterhöhungen */}
        <div className="mb-6">
          <RentIncreaseList 
            open={rentIncreaseOpen}
            onOpenChange={setRentIncreaseOpen}
            onContractClick={(id) => { setListSource('rentincrease'); setRentIncreaseOpen(true); handleRentIncreaseContractClick(id); }}
          />
        </div>

        {/* Suchfunktion */}
        <div id="search-panel">
          <SearchPanel 
            onImmobilieSelect={handleSearchImmobilieClick}
            onMietvertragClick={handleSearchMietvertragClick}
          />
        </div>

        {/* Immobilien Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-sans font-bold text-gray-800">Ihre Immobilien</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
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
      
      <EditableMietUebersichtModal 
        open={showMietUebersicht} 
        onOpenChange={setShowMietUebersicht} 
      />

      <InvoiceTool 
        open={showInvoiceTool} 
        onOpenChange={setShowInvoiceTool}
      />
    </div>;
};
export default Index;