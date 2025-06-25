
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Square, Users, Calendar, Euro, User } from "lucide-react";
import { useState } from "react";
import { MietvertragDetailView } from "./MietvertragDetailView";

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
    mieter?: Array<{
      id: string;
      Vorname: string;
      Nachname: string;
      rolle: string;
    }>;
  } | null;
  immobilie?: {
    name: string;
    adresse: string;
  };
}

export const EinheitCard = ({ einheit, vertrag, immobilie }: EinheitCardProps) => {
  const [showMietvertragDetail, setShowMietvertragDetail] = useState(false);

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

  const getShortId = (id: string) => {
    return id.length > 8 ? `...${id.slice(-8)}` : id;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMietvertragDetail(true);
  };

  if (showMietvertragDetail) {
    return (
      <MietvertragDetailView
        einheitId={einheit.id}
        onBack={() => setShowMietvertragDetail(false)}
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
                  <span className="text-sm font-medium">
                    {vertrag.mieter.length === 1 ? 'Mieter:' : 'Mieter:'}
                  </span>
                </div>
                <div className="pl-6 space-y-1">
                  {vertrag.mieter.slice(0, 2).map((mieter, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {mieter.Vorname} {mieter.Nachname}
                        </span>
                      </div>
                      {mieter.rolle && (
                        <Badge variant="outline" className="text-xs ml-2">
                          {mieter.rolle}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {vertrag.mieter.length > 2 && (
                    <div className="text-xs text-gray-500 pl-5">
                      +{vertrag.mieter.length - 2} weitere
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rent Information */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="text-sm font-medium text-gray-700 mb-2">Mietinformationen</div>
              
              {vertrag.kaltmiete && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Kaltmiete</span>
                  </div>
                  <span className="text-sm font-medium text-gray-800">{vertrag.kaltmiete}€</span>
                </div>
              )}

              {vertrag.betriebskosten && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Betriebskosten</span>
                  </div>
                  <span className="text-sm font-medium text-gray-800">{vertrag.betriebskosten}€</span>
                </div>
              )}

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
          </>
        )}
      </CardContent>
    </Card>
  );
};
