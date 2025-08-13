
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EinheitCard } from "./EinheitCard";
import { ArrowLeft, Building, MapPin, Calendar, Info, Euro, Home, TrendingUp } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef } from "react";

interface ImmobilienDetailProps {
  immobilieId: string;
  onBack: () => void;
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
  scrollToEinheitId?: string | null;
}

export const ImmobilienDetail = ({ immobilieId, onBack, scrollToEinheitId }: ImmobilienDetailProps) => {
  const einheitRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { data: immobilie, isLoading: immobilieLoading } = useQuery({
    queryKey: ['immobilie', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('*')
        .eq('id', immobilieId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ['einheiten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('id', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: mietvertraege } = useQuery({
    queryKey: ['mietvertrag-detail', immobilieId],
    queryFn: async () => {
      const einheitIds = einheiten?.map(e => e.id) || [];
      if (einheitIds.length === 0) return [];

      const { data: vertraege, error: vertraegeError } = await supabase
        .from('mietvertrag')
        .select('*')
        .in('einheit_id', einheitIds)
        .neq('status', 'beendet'); // Beendete Mietverträge ausschließen
      
      if (vertraegeError) throw vertraegeError;

      const vertragIds = vertraege?.map(v => v.id) || [];
      if (vertragIds.length === 0) return vertraege;

      const { data: mietvertragMieter, error: mmError } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mietvertrag_id,
          mieter_id
        `)
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
        
        return {
          ...vertrag,
          mieter: mieterData
        };
      }) || [];
    },
    enabled: !!einheiten
  });

  // Query für alle aktiven und gekündigten Mietverträge für Finanzberechnungen
  const { data: alleMietvertraege } = useQuery({
    queryKey: ['alle-mietvertrag-immobilie', immobilieId],
    queryFn: async () => {
      const einheitIds = einheiten?.map(e => e.id) || [];
      if (einheitIds.length === 0) return [];

      const { data, error } = await supabase
        .from('mietvertrag')
        .select('kaltmiete, betriebskosten, status')
        .in('einheit_id', einheitIds)
        .in('status', ['aktiv', 'gekuendigt']);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!einheiten
  });

  // Berechne Gesamtwerte
  const gesamtKaltmiete = alleMietvertraege?.reduce((sum, vertrag) => sum + (vertrag.kaltmiete || 0), 0) || 0;
  const gesamtBetriebskosten = alleMietvertraege?.reduce((sum, vertrag) => sum + (vertrag.betriebskosten || 0), 0) || 0;
  const gesamtWarmmiete = gesamtKaltmiete + gesamtBetriebskosten;
  const gesamtQm = einheiten?.reduce((sum, einheit) => sum + (einheit.qm || 0), 0) || 0;

  // Scroll to specific unit if scrollToEinheitId is provided
  useEffect(() => {
    if (scrollToEinheitId && einheiten && !einheitenLoading) {
      const timer = setTimeout(() => {
        const targetElement = einheitRefs.current[scrollToEinheitId];
        if (targetElement) {
          targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
          // Add a temporary highlight effect
          targetElement.style.transform = 'scale(1.02)';
          targetElement.style.transition = 'transform 0.3s ease';
          setTimeout(() => {
            targetElement.style.transform = 'scale(1)';
          }, 1000);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToEinheitId, einheiten, einheitenLoading]);

  const handleBackClick = () => {
    onBack();
  };

  if (immobilieLoading || einheitenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBackClick}
            className="mb-4 hover:bg-gray-100 transition-colors"
          >
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
                    {immobilie?.beschreibung && (
                      <p className="text-gray-500 mt-2">{immobilie.beschreibung}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {einheiten?.length || 0} von {immobilie?.einheiten_anzahl} Einheiten
                  </Badge>
                  {immobilie?.objekttyp && (
                    <div className="text-sm text-gray-500">
                      {immobilie.objekttyp}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {/* Erweiterte Immobilien-Informationen */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Flächeninformationen */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Home className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-600">Gesamtfläche</p>
                      <p className="text-2xl font-bold text-blue-800">{gesamtQm.toLocaleString()} m²</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">Alle Einheiten</p>
                </div>

                {/* Kaltmiete */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Euro className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-600">Kaltmiete</p>
                      <p className="text-2xl font-bold text-green-800">€{gesamtKaltmiete.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-green-600">Monatlich gesamt</p>
                </div>

                {/* Betriebskosten */}
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-600">Betriebskosten</p>
                      <p className="text-2xl font-bold text-orange-800">€{gesamtBetriebskosten.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-orange-600">Monatlich gesamt</p>
                </div>

                {/* Warmmiete */}
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Euro className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-600">Warmmiete</p>
                      <p className="text-2xl font-bold text-purple-800">€{gesamtWarmmiete.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600">Kalt + Betriebs.</p>
                </div>
              </div>

              {/* Bestehende Informationen */}
              {(immobilie?.baujahr || immobilie?.["Kontonr."] || immobilie?.["Annuität"]) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  {immobilie?.baujahr && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Baujahr:</strong> {immobilie.baujahr}
                      </span>
                    </div>
                  )}
                  {immobilie?.["Kontonr."] && (
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Kontonr.:</strong> {immobilie["Kontonr."]}
                      </span>
                    </div>
                  )}
                  {immobilie?.["Annuität"] && (
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Annuität:</strong> €{immobilie["Annuität"]?.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {einheiten?.map((einheit) => {
            // Find the most current rental contract for this unit
            // Priority: 1. Active contracts, 2. Most recent terminated, 3. Most recent by start date
            const vertraegeForEinheit = mietvertraege?.filter(v => v.einheit_id === einheit.id) || [];
            
            let vertrag = null;
            if (vertraegeForEinheit.length > 0) {
              // First, try to find an active contract
              const activeVertrag = vertraegeForEinheit.find(v => v.status === 'aktiv');
              
              if (activeVertrag) {
                vertrag = activeVertrag;
              } else {
                // If no active contract, find the most recent one by start date
                vertrag = vertraegeForEinheit.reduce((latest, current) => {
                  const latestDate = latest.start_datum ? new Date(latest.start_datum) : new Date(0);
                  const currentDate = current.start_datum ? new Date(current.start_datum) : new Date(0);
                  return currentDate > latestDate ? current : latest;
                });
              }
            }
            
            return (
              <div 
                key={einheit.id}
                ref={(el) => einheitRefs.current[einheit.id] = el}
                className="transition-transform duration-300"
              >
                <EinheitCard
                  einheit={einheit}
                  vertrag={vertrag}
                  immobilie={immobilie}
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
      </div>
    </div>
  );
};
