import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Calendar, Check } from "lucide-react";

interface Tenant {
  id: string;
  vorname: string;
  nachname: string;
  hauptmail?: string;
  telnr?: string;
  geburtsdatum?: string;
}

interface TenantSelectionCardProps {
  tenant: Tenant;
  isSelected: boolean;
  onToggle: (tenantId: string) => void;
  showDetails?: boolean;
}

export const TenantSelectionCard = ({ 
  tenant, 
  isSelected, 
  onToggle, 
  showDetails = true 
}: TenantSelectionCardProps) => {
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('de-DE');
    } catch {
      return null;
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-primary/5 border-primary shadow-md ring-1 ring-primary/20' 
          : 'hover:bg-muted/50 hover:shadow-sm'
      }`}
      onClick={() => onToggle(tenant.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          {/* Checkbox */}
          <Checkbox
            checked={isSelected}
            onChange={() => onToggle(tenant.id)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          
          {/* Tenant Icon */}
          <div className={`p-2 rounded-full ${
            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <User className="h-4 w-4" />
          </div>
          
          {/* Tenant Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={`font-medium truncate ${
                isSelected ? 'text-primary' : 'text-foreground'
              }`}>
                {tenant.vorname} {tenant.nachname}
              </h4>
              
              {isSelected && (
                <div className="flex-shrink-0 ml-2">
                  <div className="p-1 bg-primary rounded-full">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
            
            {showDetails && (
              <div className="mt-2 space-y-1">
                {/* Email */}
                {tenant.hauptmail && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{tenant.hauptmail}</span>
                  </div>
                )}
                
                {/* Phone */}
                {tenant.telnr && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{tenant.telnr}</span>
                  </div>
                )}
                
                {/* Birth Date */}
                {tenant.geburtsdatum && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Geb. {formatDate(tenant.geburtsdatum)}</span>
                  </div>
                )}
                
                {/* No additional info badge */}
                {!tenant.hauptmail && !tenant.telnr && !tenant.geburtsdatum && (
                  <Badge variant="outline" className="text-xs">
                    Minimale Daten
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};