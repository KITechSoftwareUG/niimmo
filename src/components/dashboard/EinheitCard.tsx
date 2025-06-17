
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Square, Users, Calendar, Euro, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { MietvertragDetail } from "./MietvertragDetail";

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
    start_datum?: string;
    ende_datum?: string;
    mieter_name?: string;
  } | null;
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
}

export const EinheitCard = ({ einheit, vertrag, filters }: EinheitCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  
  const { data: letzteZahlung } = useQuery({
    queryKey: ['letzte-zahlung', vertrag?.id],
    queryFn: async () => {
      if (!vertrag?.id) return null;
      
      const { data, error } = await supabase
        .from('mietzahlungen')
        .select('*')
        .eq('mietvertrag_id', vertrag.id)
        .order('monat', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!vertrag?.id
  });

  const getStatusColor = () => {
    if (!vertrag) return "bg-red-100 border-red-200";
    
    const isZahlungOffen = letzteZahlung && !letzteZahlung.bezahlt_am;
    
    if (vertrag.status === 'aktiv' && !isZahlungOffen) return "bg-green-100 border-green-200";
    if (vertrag.status === 'gekündigt') return "bg-yellow-100 border-yellow-200";
    if (isZahlungOffen) return "bg-red-100 border-red-200";
    
    return "bg-gray-100 border-gray-200";
  };

  const getStatusBadge = () => {
    if (!vertrag) return <Badge variant="destructive">Leerstehend</Badge>;
    
    const isZahlungOffen = letzteZahlung && !letzteZahlung.bezahlt_am;
    
    if (vertrag.status === 'aktiv' && !isZahlungOffen) {
      return <Badge className="bg-green-600">Aktiv & Bezahlt</Badge>;
    }
    if (vertrag.status === 'gekündigt') {
      return <Badge variant="secondary" className="bg-yellow-600 text-white">Gekündigt</Badge>;
    }
    if (isZahlungOffen) {
      return <Badge variant="destructive">Zahlung offen</Badge>;
    }
    
    return <Badge>{vertrag.status}</Badge>;
  };

  // Apply filters
  const zahlungsstatusFilter = () => {
    if (!filters.zahlungsstatus) return true;
    
    if (filters.zahlungsstatus === 'bezahlt') {
      return letzteZahlung?.bezahlt_am;
    }
    if (filters.zahlungsstatus === 'offen') {
      return letzteZahlung && !letzteZahlung.bezahlt_am;
    }
    return true;
  };

  if (!zahlungsstatusFilter()) return null;

  if (showDetail && vertrag) {
    return (
      <MietvertragDetail 
        vertragId={vertrag.id}
        onBack={() => setShowDetail(false)}
      />
    );
  }

  return (
    <Card 
      className={`transition-all hover:shadow-lg cursor-pointer border-l-4 ${getStatusColor()}`}
      onClick={() => vertrag && setShowDetail(true)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Home className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">
              {einheit.nummer ? `Einheit ${einheit.nummer}` : `Einheit ${einheit.id.slice(0, 8)}`}
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
            {vertrag.mieter_name && (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{vertrag.mieter_name}</span>
              </div>
            )}

            {vertrag.kaltmiete && (
              <div className="flex items-center space-x-2">
                <Euro className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">{vertrag.kaltmiete}€ / Monat</span>
              </div>
            )}

            {vertrag.start_datum && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  seit {new Date(vertrag.start_datum).toLocaleDateString('de-DE')}
                </span>
              </div>
            )}

            {letzteZahlung && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Letzte Zahlung:</span>
                <div className="flex items-center space-x-1">
                  {letzteZahlung.bezahlt_am ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-xs">
                    {new Date(letzteZahlung.monat).toLocaleDateString('de-DE', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
