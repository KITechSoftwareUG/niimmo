import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EinheitCard } from "./EinheitCard";
import { ArrowLeft, Building, MapPin, Calendar, Info, Euro, Home, TrendingUp, Loader2, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useRef } from "react";
import { sortUnitsByNumber, getCurrentContract, filterActiveAndTerminatedContracts } from "@/utils/contractUtils";
import { useEditableField } from "@/hooks/useEditableField";
import { Input } from "@/components/ui/input";
import { ImmobilienDocumentsTab } from "./ImmobilienDocumentsTab";
import { ImmobilienPaymentsTab } from "./ImmobilienPaymentsTab";

interface ImmobilienDetailProps {
  immobilieId: string;
  onBack: () => void;
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
  scrollToEinheitId?: string | null;
  openMietvertragId?: string | null;
  onContractModalClose?: () => void;
}
export const ImmobilienDetail = ({
  immobilieId,
  onBack,
  scrollToEinheitId,
  openMietvertragId,
  onContractModalClose
}: ImmobilienDetailProps) => {
  const einheitRefs = useRef<{
    [key: string]: HTMLDivElement | null;
  }>({});
  
  const {
    startEditing,
    updateValue,
    cancelEdit,
    getEditingValue,
    isFieldEditing,
    saveSingleField
  } = useEditableField();
  const {
    data: immobilie,
    isLoading: immobilieLoading
  } = useQuery({
    queryKey: ['immobilie', immobilieId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('immobilien').select('*').eq('id', immobilieId).single();
      if (error) throw error;
      return data;
    }
  });
  const {
    data: einheiten,
    isLoading: einheitenLoading
  } = useQuery({
    queryKey: ['einheiten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', immobilieId);
      
      if (error) throw error;
      
      // Group units by their ID's last 2 digits and keep only the newest
      const unitsByLastDigits = (data || []).reduce((acc, unit: any) => {
        const lastTwoDigits = unit.id.slice(-2);
        if (!acc[lastTwoDigits] || new Date(unit.erstellt_am) > new Date(acc[lastTwoDigits].erstellt_am)) {
          acc[lastTwoDigits] = unit;
        }
        return acc;
      }, {} as Record<string, any>);
      
      const uniqueUnits = Object.values(unitsByLastDigits);
      
      // Use centralized sorting utility
      return sortUnitsByNumber(uniqueUnits);
    }
  });
  const {
    data: mietvertraege
  } = useQuery({
    queryKey: ['mietvertrag-detail', immobilieId, einheiten?.map(e => e.id).join(',')],
    queryFn: async () => {
      const einheitIds = einheiten?.map(e => e.id) || [];
      if (einheitIds.length === 0) return [];
      
      const { data: vertraege, error: vertraegeError } = await supabase
        .from('mietvertrag')
        .select('*')
        .in('einheit_id', einheitIds);

      if (vertraegeError) throw vertraegeError;
      
      const vertragIds = vertraege?.map(v => v.id) || [];
      if (vertragIds.length === 0) return vertraege;
      
      const { data: mietvertragMieter, error: mmError } = await supabase
        .from('mietvertrag_mieter')
        .select(`mietvertrag_id, mieter_id`)
        .in('mietvertrag_id', vertragIds);
      
      if (mmError) throw mmError;
      
      const mieterIds = mietvertragMieter?.map(mm => mm.mieter_id) || [];
      if (mieterIds.length === 0) return vertraege;
      
      const { data: mieter, error: mieterError } = await supabase
        .from('mieter')
        .select('id, vorname, nachname, hauptmail, telnr')
        .in('id', mieterIds);
      
      if (mieterError) throw mieterError;
      
      return vertraege?.map(vertrag => {
        const allMieterForVertrag = mietvertragMieter?.filter(mm => mm.mietvertrag_id === vertrag.id) || [];
        const mieterData = allMieterForVertrag.map(mvMieter => {
          const mieterInfo = mieter?.find(m => m.id === mvMieter.mieter_id);
          return mieterInfo;
        }).filter(Boolean);
        
        return { ...vertrag, mieter: mieterData };
      }) || [];
    },
    enabled: !!einheiten
  });

  // Query für alle aktiven und gekündigten Mietverträge für Finanzberechnungen
  const {
    data: alleMietvertraege
  } = useQuery({
    queryKey: ['alle-mietvertrag-immobilie', immobilieId],
    queryFn: async () => {
      const einheitIds = einheiten?.map(e => e.id) || [];
      if (einheitIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('mietvertrag')
        .select('kaltmiete, betriebskosten, status')
        .in('einheit_id', einheitIds)
        .in('status', ['aktiv', 'gekuendigt', 'beendet']); // Include all contract types
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!einheiten
  });

  // Query für Dokumente dieser Immobilie
  const { data: immobilienDokumente } = useQuery({
    queryKey: ['immobilien-dokumente', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .eq('geloescht', false)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Berechne Gesamtwerte
  const gesamtKaltmiete = alleMietvertraege?.reduce((sum, vertrag) => sum + (vertrag.kaltmiete || 0), 0) || 0;
  const gesamtBetriebskosten = alleMietvertraege?.reduce((sum, vertrag) => sum + (vertrag.betriebskosten || 0), 0) || 0;
  const gesamtWarmmiete = gesamtKaltmiete + gesamtBetriebskosten;
  const gesamtQm = einheiten?.reduce((sum, einheit) => sum + (einheit.qm || 0), 0) || 0;

  // Scroll to specific unit if scrollToEinheitId is provided with enhanced highlighting
  useEffect(() => {
    if (scrollToEinheitId && einheiten && !einheitenLoading) {
      const timer = setTimeout(() => {
        const targetElement = einheitRefs.current[scrollToEinheitId];
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          
          // Apply search highlight animation class
          targetElement.classList.add('animate-search-highlight');
          targetElement.style.border = '3px solid #ef4444';
          targetElement.style.borderRadius = '12px';
          targetElement.style.zIndex = '10';
          targetElement.style.position = 'relative';
          
          // Reset after enhanced duration
          setTimeout(() => {
            targetElement.classList.remove('animate-search-highlight');
            targetElement.style.border = '';
            targetElement.style.borderRadius = '';
            targetElement.style.zIndex = '';
            targetElement.style.position = '';
          }, 4000);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToEinheitId, einheiten, einheitenLoading]);
  const handleBackClick = () => {
    onBack();
  };
  if (immobilieLoading || einheitenLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>;
  }
  return <div className="min-h-screen p-6 bg-slate-300">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleBackClick} className="mb-4 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Übersicht
          </Button>
          
          {/* Immobilien Header */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Building className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                      {immobilie?.name}
                    </CardTitle>
                    <div className="flex items-center text-gray-600 mb-2">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{immobilie?.adresse}</span>
                    </div>
                    {immobilie?.beschreibung && <p className="text-gray-500 mt-2">{immobilie.beschreibung}</p>}
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {einheiten?.length || 0} von {immobilie?.einheiten_anzahl} Einheiten
                  </Badge>
                  {immobilie?.objekttyp && <div className="text-sm text-gray-500">
                      {immobilie.objekttyp}
                    </div>}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {/* Erweiterte Immobilien-Informationen */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {/* Flächeninformationen */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <Home className="h-6 w-6 text-blue-600" />
                    </div>
                    <p className="text-xs font-medium text-blue-600 mb-1">Gesamtfläche</p>
                    <p className="text-xl font-bold text-blue-900">{gesamtQm.toLocaleString()}</p>
                    <p className="text-xs text-blue-700">m²</p>
                  </div>
                </div>

                {/* Kaltmiete */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <Euro className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-xs font-medium text-green-600 mb-1">Kaltmiete</p>
                    <p className="text-xl font-bold text-green-900">€{gesamtKaltmiete.toLocaleString()}</p>
                    <p className="text-xs text-green-700">monatlich</p>
                  </div>
                </div>

                {/* Betriebskosten */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <TrendingUp className="h-6 w-6 text-orange-600" />
                    </div>
                    <p className="text-xs font-medium text-orange-600 mb-1">Betriebskosten</p>
                    <p className="text-xl font-bold text-orange-900">€{gesamtBetriebskosten.toLocaleString()}</p>
                    <p className="text-xs text-orange-700">monatlich</p>
                  </div>
                </div>

                {/* Warmmiete */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <Euro className="h-6 w-6 text-purple-600" />
                    </div>
                    <p className="text-xs font-medium text-purple-600 mb-1">Warmmiete</p>
                    <p className="text-xl font-bold text-purple-900">€{gesamtWarmmiete.toLocaleString()}</p>
                    <p className="text-xs text-purple-700">gesamt</p>
                  </div>
                </div>

                {/* Kaufpreis */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <Building className="h-6 w-6 text-indigo-600" />
                    </div>
                    <p className="text-xs font-medium text-indigo-600 mb-1">Kaufpreis</p>
                    
                    {isFieldEditing(immobilieId, 'kaufpreis') ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <Input
                          type="number"
                          value={getEditingValue(immobilieId, 'kaufpreis') || ''}
                          onChange={(e) => updateValue(immobilieId, 'kaufpreis', e.target.value)}
                          className="text-center h-8 text-sm"
                          placeholder="Kaufpreis"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => saveSingleField(immobilieId, 'kaufpreis', { table: 'immobilien', type: 'number' })}
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => cancelEdit(immobilieId, 'kaufpreis')}
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-indigo-900">
                          {immobilie?.kaufpreis ? `€${immobilie.kaufpreis.toLocaleString()}` : 'Nicht erfasst'}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-indigo-200"
                          onClick={() => startEditing(immobilieId, 'kaufpreis', immobilie?.kaufpreis || 0)}
                        >
                          <Pencil className="h-3 w-3 text-indigo-600" />
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-xs text-indigo-700">einmalig</p>
                  </div>
                </div>

                {/* Restschuld */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <TrendingUp className="h-6 w-6 text-red-600" />
                    </div>
                    <p className="text-xs font-medium text-red-600 mb-1">Restschuld</p>
                    <p className="text-xl font-bold text-red-900">
                      {immobilie?.restschuld ? `€${immobilie.restschuld.toLocaleString()}` : 'Nicht erfasst'}
                    </p>
                    <p className="text-xs text-red-700">aktuell</p>
                  </div>
                </div>
              </div>

              {/* Zusätzliche Immobilien-Informationen */}
              {(immobilie?.baujahr || immobilie?.["Kontonr."] || immobilie?.["Annuität"]) && <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200/60 shadow-sm">
                  <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <Info className="h-5 w-5 text-slate-600 mr-2" />
                    Weitere Informationen
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {immobilie?.baujahr && <div className="bg-white rounded-lg p-4 border border-slate-200/40 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Baujahr</p>
                            <p className="text-lg font-bold text-slate-900">{immobilie.baujahr}</p>
                          </div>
                        </div>
                      </div>}
                    {immobilie?.["Kontonr."] && <div className="bg-white rounded-lg p-4 border border-slate-200/40 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Info className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kontonummer</p>
                            <p className="text-lg font-bold text-slate-900">{immobilie["Kontonr."]}</p>
                          </div>
                        </div>
                      </div>}
                    {immobilie?.["Annuität"] && <div className="bg-white rounded-lg p-4 border border-slate-200/40 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <Euro className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Annuität</p>
                            <p className="text-lg font-bold text-slate-900">€{immobilie["Annuität"]?.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>}
                  </div>
                </div>}
            </CardContent>
          </Card>
        </div>

        {/* Tabs für Einheiten, Dokumente und Zahlungen */}
        <Tabs defaultValue="einheiten" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="einheiten">Einheiten</TabsTrigger>
            <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
            <TabsTrigger value="zahlungen">Zahlungen</TabsTrigger>
          </TabsList>

          <TabsContent value="einheiten">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {einheiten?.map((einheit, index) => {
                // Find all rental contracts for this unit
                const vertraegeForEinheit = mietvertraege?.filter(v => v.einheit_id === einheit.id) || [];
                
                // Default to the most current contract
                let vertrag = getCurrentContract(vertraegeForEinheit);
                
                // If a specific contract is requested (e.g., via search), prefer that one
                if (openMietvertragId) {
                  const targeted = vertraegeForEinheit.find(v => v.id === openMietvertragId);
                  if (targeted) {
                    vertrag = targeted;
                  }
                }
                
                return (
                  <div 
                    key={einheit.id} 
                    ref={el => einheitRefs.current[einheit.id] = el} 
                    className="transition-transform duration-300"
                  >
                    <EinheitCard 
                      einheit={einheit} 
                      vertrag={vertrag} 
                      immobilie={immobilie} 
                      openMietvertragId={openMietvertragId}
                      einheitIndex={index + 1}
                      onContractModalClose={onContractModalClose}
                    />
                  </div>
                );
              })}
            </div>
            
            {(!einheiten || einheiten.length === 0) && (
              <div className="text-center py-12">
                <div className="glass-card p-8 max-w-md mx-auto rounded-2xl">
                  <p className="text-gray-500">
                    Keine Einheiten für diese Immobilie gefunden
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dokumente">
            <ImmobilienDocumentsTab 
              immobilieId={immobilieId}
              dokumente={immobilienDokumente || []}
            />
          </TabsContent>

          <TabsContent value="zahlungen">
            <ImmobilienPaymentsTab immobilieId={immobilieId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};