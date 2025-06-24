
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Home, Square, Users, Calendar, Euro, User, Building, MapPin } from "lucide-react";

interface EinheitenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const EinheitenDetailModal = ({ 
  isOpen, 
  onClose, 
  einheit, 
  vertrag, 
  immobilie 
}: EinheitenDetailModalProps) => {
  const getStatusColor = () => {
    if (!vertrag) return "bg-red-100 text-red-800";
    if (vertrag.status === 'aktiv') return "bg-green-100 text-green-800";
    if (vertrag.status === 'gekündigt') return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Home className="h-5 w-5 text-blue-600" />
              <span>
                {einheit.nummer ? `Einheit ${einheit.nummer}` : `Einheit ${getShortId(einheit.id)}`}
              </span>
            </div>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Immobilie Info */}
          {immobilie && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Building className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-blue-900">{immobilie.name}</h3>
              </div>
              <div className="flex items-center space-x-2 text-sm text-blue-700">
                <MapPin className="h-3 w-3" />
                <span>{immobilie.adresse}</span>
              </div>
            </div>
          )}

          {/* Einheit Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Einheitendetails</h3>
              
              {einheit.etage && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600">Etage:</span>
                  <span className="text-sm text-gray-900">{einheit.etage}</span>
                </div>
              )}

              {einheit.qm && (
                <div className="flex items-center space-x-2">
                  <Square className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-900">{einheit.qm} m²</span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">ID:</span>
                <span className="text-xs text-gray-500 font-mono">{getShortId(einheit.id)}</span>
              </div>
            </div>

            {/* Mietvertrag Details */}
            {vertrag && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Mietdetails</h3>
                
                {vertrag.kaltmiete && (
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      <span className="font-medium">Kaltmiete:</span> {vertrag.kaltmiete}€
                    </span>
                  </div>
                )}

                {vertrag.warmmiete && (
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      <span className="font-medium">Warmmiete:</span> {vertrag.warmmiete}€
                    </span>
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
              </div>
            )}
          </div>

          {/* Mieter */}
          {vertrag && vertrag.mieter && vertrag.mieter.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">
                  {vertrag.mieter.length === 1 ? 'Mieter' : 'Mieter'}
                </h3>
              </div>
              
              <div className="space-y-2">
                {vertrag.mieter.map((mieter, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {mieter.Vorname} {mieter.Nachname}
                      </span>
                    </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
