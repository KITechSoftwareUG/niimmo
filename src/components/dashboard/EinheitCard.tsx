
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Square, Users, Calendar, Euro, User } from "lucide-react";
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
    mieter?: Array<{
      id: string;
      Vorname: string;
      Nachname: string;
      rolle: string;
    }>;
  } | null;
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
}

export const EinheitCard = ({ einheit, vertrag, filters }: EinheitCardProps) => {
  const [showDetail, setShowDetail] = useState(false);

  const getStatusColor = () => {
    if (!vertrag) return "bg-red-100 border-red-200";
    
    if (vertrag.status === 'aktiv') return "bg-green-100 border-green-200";
    if (vertrag.status === 'gekündigt') return "bg-yellow-100 border-yellow-200";
    
    return "bg-gray-100 border-gray-200";
  };

  const getStatusBadge = () => {
    if (!vertrag) return <Badge variant="destructive">Leerstehend</Badge>;
    
    if (vertrag.status === 'aktiv') {
      return <Badge className="bg-green-600">Aktiv</Badge>;
    }
    if (vertrag.status === 'gekündigt') {
      return <Badge variant="secondary" className="bg-yellow-600 text-white">Gekündigt</Badge>;
    }
    
    return <Badge>{vertrag.status}</Badge>;
  };

  const shouldShow = () => {
    if (filters.mietstatus !== "all") {
      const currentStatus = vertrag?.status || 'leerstehend';
      if (currentStatus !== filters.mietstatus) return false;
    }
    return true;
  };

  if (!shouldShow()) return null;

  if (showDetail && vertrag) {
    return (
      <MietvertragDetail 
        vertragId={vertrag.id}
        onBack={() => setShowDetail(false)}
      />
    );
  }

  const getShortId = (id: string) => {
    return id.length > 8 ? `...${id.slice(-8)}` : id;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (vertrag) {
      setShowDetail(true);
    }
  };

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
              {einheit.nummer ? `Einheit ${einheit.nummer}` : `Einheit ${getShortId(einheit.id)}`}
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
            {vertrag.mieter && vertrag.mieter.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Mieter:</span>
                </div>
                <div className="pl-6 space-y-1">
                  {vertrag.mieter.map((mieter, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {mieter.Vorname} {mieter.Nachname}
                      </span>
                      {mieter.rolle && (
                        <Badge variant="outline" className="text-xs">
                          {mieter.rolle}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
};
