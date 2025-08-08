
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Square, Users, Calendar, Euro, User, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { EinheitHistorieView } from "./EinheitHistorieView";
import { supabase } from "@/integrations/supabase/client";

interface EinheitCardProps {
  einheit: {
    id: string;
    nummer?: string;
    etage?: string;
    qm?: number;
  };
  vertrag?: {
    id: string;
    status: string;
    kaltmiete?: number;
    warmmiete?: number;
    betriebskosten?: number;
    start_datum?: string;
    ende_datum?: string;
    kuendigungsdatum?: string;
    mieter?: Array<{
      id: string;
      vorname: string;
      nachname: string;
      rolle: string;
    }>;
  } | null;
  immobilie?: {
    name: string;
    adresse: string;
  };
}

export const EinheitCard = ({ einheit, vertrag, immobilie }: EinheitCardProps) => {
  const [showHistorie, setShowHistorie] = useState(false);

  // Check if contract should be automatically ended
  useEffect(() => {
    const checkAndUpdateContractStatus = async () => {
      if (vertrag && vertrag.status === 'gekündigt' && vertrag.kuendigungsdatum) {
        const terminationDate = new Date(vertrag.kuendigungsdatum);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        terminationDate.setHours(0, 0, 0, 0);
        
        if (terminationDate <= today) {
          try {
            await supabase
              .from('mietvertrag')
              .update({ status: 'beendet' })
              .eq('id', vertrag.id);
          } catch (error) {
            console.error('Error updating contract status:', error);
          }
        }
      }
    };

    checkAndUpdateContractStatus();
  }, [vertrag]);

  const getStatusColor = () => {
    if (!vertrag) return "bg-red-100 border-red-200";
    
    if (vertrag.status === 'aktiv') return "bg-green-100 border-green-200";
    if (vertrag.status === 'gekündigt') return "bg-yellow-100 border-yellow-500";
    if (vertrag.status === 'beendet') return "bg-red-100 border-red-200";
    
    return "bg-gray-100 border-gray-200";
  };

  const getStatusBadge = () => {
    if (!vertrag) return <Badge variant="destructive">Leerstehend</Badge>;
    
    if (vertrag.status === 'aktiv') {
      return <Badge className="bg-green-600">Aktiv</Badge>;
    }
    if (vertrag.status === 'gekündigt') {
      return <Badge variant={undefined} className="bg-yellow-600 text-white hover:bg-yellow-700 border-transparent">Gekündigt</Badge>;
    }
    if (vertrag.status === 'beendet') {
      return <Badge variant="destructive">Beendet</Badge>;
    }
    
    return <Badge>{vertrag.status}</Badge>;
  };

  const getEinheitNumber = (id: string) => {
    // Extract numeric part from UUID and use last 2 digits
    const numericPart = id.replace(/[^0-9]/g, '');
    const lastTwoDigits = numericPart.slice(-2);
    return parseInt(lastTwoDigits) || 1; // Default to 1 if no digits found
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowHistorie(true);
  };

  if (showHistorie) {
    return (
      <EinheitHistorieView
        einheitId={einheit.id}
        onBack={() => setShowHistorie(false)}
        einheit={einheit}
        immobilie={immobilie}
      />
    );
  }

  return (
    <Card 
      className={`transition-all hover:shadow-lg cursor-pointer border-l-4 ${getStatusColor()}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Home className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">
              {einheit.nummer ? `Einheit ${einheit.nummer}` : `Einheit ${getEinheitNumber(einheit.id)}`}
            </CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        
        {einheit.etage && (
          <p className="text-sm text-gray-600">{einheit.etage}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {einheit.qm && (
          <div className="flex items-center space-x-2">
            <Square className="h-4 w-4 text-gray-500" />
            <span className="text-sm">{einheit.qm} m²</span>
          </div>
        )}

        {vertrag && (
          <>
            {/* Mieter - Zugeordnet über Mietvertrag */}
            {vertrag.mieter && vertrag.mieter.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">
                    {vertrag.mieter.length === 1 ? 'Mieter:' : 'Mieter:'}
                  </span>
                </div>
                <div className="pl-6 space-y-2">
                  {vertrag.mieter.slice(0, 2).map((mieter, index) => (
                    <div key={index} className="flex items-center p-2 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3 text-blue-600" />
                        <span className="text-sm text-gray-700 font-medium">
                          {mieter.vorname} {mieter.nachname}
                        </span>
                      </div>
                    </div>
                  ))}
                  {vertrag.mieter.length > 2 && (
                    <div className="text-xs text-gray-500 pl-5 bg-gray-50 rounded p-2">
                      +{vertrag.mieter.length - 2} weitere Mieter
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mietinformationen */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="text-sm font-medium text-gray-700 mb-2">Mietinformationen</div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Euro className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Kaltmiete</span>
                </div>
                <span className="text-sm font-medium text-gray-800">{vertrag.kaltmiete || 0}€</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Euro className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Betriebskosten</span>
                </div>
                <span className="text-sm font-medium text-gray-800">{vertrag.betriebskosten || 0}€</span>
              </div>

              {vertrag.warmmiete && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-600 font-medium">Warmmiete</span>
                  </div>
                  <span className="text-sm font-bold text-orange-600">{vertrag.warmmiete}€</span>
                </div>
              )}
            </div>

            {vertrag.start_datum && (
              <div className="flex items-center space-x-2 pt-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  seit {new Date(vertrag.start_datum).toLocaleDateString('de-DE')}
                </span>
              </div>
            )}

            {vertrag.status === 'gekündigt' && vertrag.kuendigungsdatum && (
              <div className="flex items-center space-x-2 pt-1">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 font-medium">
                  Kündigungsdatum: {new Date(vertrag.kuendigungsdatum).toLocaleDateString('de-DE')}
                </span>
              </div>
            )}
          </>
        )}

        {/* Wenn keine Mieter zugeordnet sind */}
        {(!vertrag || !vertrag.mieter || vertrag.mieter.length === 0) && (
          <div className="flex items-center space-x-2 text-gray-500 bg-gray-50 p-2 rounded-lg">
            <Users className="h-4 w-4" />
            <span className="text-sm">
              {vertrag ? 'Keine Mieter zugeordnet' : 'Leerstehend - Kein Mietvertrag'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
