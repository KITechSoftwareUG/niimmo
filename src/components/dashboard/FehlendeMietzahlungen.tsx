
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Euro, Calendar, User, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useRueckstaende } from "@/hooks/useRueckstaende";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FehlendeMietzahlungenProps {
  onMietvertragClick?: (mietvertragId: string) => void;
}

type SortOption = 'object' | 'amount' | 'mahnstufe' | 'tenant';
type SortDirection = 'asc' | 'desc';

export const FehlendeMietzahlungen = ({ onMietvertragClick }: FehlendeMietzahlungenProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { data: fehlendeMietzahlungen, isLoading, error } = useRueckstaende();

  const sortedFehlendeMietzahlungen = useMemo(() => {
    if (!fehlendeMietzahlungen) return [];
    
    const sorted = [...fehlendeMietzahlungen].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'object':
          comparison = a.immobilie_name.localeCompare(b.immobilie_name);
          break;
        case 'amount':
          comparison = a.fehlend_betrag - b.fehlend_betrag;
          break;
        case 'mahnstufe':
          comparison = (a.mahnstufe || 0) - (b.mahnstufe || 0);
          break;
        case 'tenant':
          comparison = a.mieter_name.localeCompare(b.mieter_name);
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [fehlendeMietzahlungen, sortBy, sortDirection]);

  const gesamtRueckstand = fehlendeMietzahlungen?.reduce((sum, item) => sum + item.fehlend_betrag, 0) || 0;

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  const handleMietvertragClick = (mietvertragId: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    onMietvertragClick?.(mietvertragId);
  };

  const handleSort = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection(newSortBy === 'amount' || newSortBy === 'mahnstufe' ? 'desc' : 'asc');
    }
  };

  const getSortIcon = (option: SortOption) => {
    if (sortBy !== option) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="glass-card p-6 rounded-2xl border border-red-100 bg-red-50/30">
        <CollapsibleTrigger className="w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-800">Rückstände</h2>
                <p className="text-sm text-gray-600">
                  {fehlendeMietzahlungen?.length || 0} Mietvertrag{(fehlendeMietzahlungen?.length || 0) !== 1 ? 'e' : ''} mit offenen Forderungen
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {gesamtRueckstand > 0 && (
                <div className="text-right mr-4">
                  <p className="text-sm text-gray-600">Gesamtrückstand</p>
                  <p className="text-xl font-bold text-red-600">{formatBetrag(gesamtRueckstand)}</p>
                </div>
              )}
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {/* Sorting Controls */}
          {fehlendeMietzahlungen && fehlendeMietzahlungen.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 items-center justify-between border-b border-red-200 pb-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={sortBy === 'object' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('object')}
                  className="gap-1"
                >
                  Objekt {getSortIcon('object')}
                </Button>
                <Button
                  variant={sortBy === 'amount' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('amount')}
                  className="gap-1"
                >
                  Betrag {getSortIcon('amount')}
                </Button>
                <Button
                  variant={sortBy === 'mahnstufe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('mahnstufe')}
                  className="gap-1"
                >
                  Mahnstufe {getSortIcon('mahnstufe')}
                </Button>
                <Button
                  variant={sortBy === 'tenant' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('tenant')}
                  className="gap-1"
                >
                  Mieter {getSortIcon('tenant')}
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                {sortedFehlendeMietzahlungen.length} Einträge sortiert nach{' '}
                {sortBy === 'object' && 'Objekt'}
                {sortBy === 'amount' && 'Betrag'}
                {sortBy === 'mahnstufe' && 'Mahnstufe'}
                {sortBy === 'tenant' && 'Mieter'}
                {' '}({sortDirection === 'asc' ? 'aufsteigend' : 'absteigend'})
              </div>
            </div>
          )}
          
          {/* Contract List */}
          {sortedFehlendeMietzahlungen && sortedFehlendeMietzahlungen.length > 0 ? (
            <div className="space-y-4 animate-fade-in">
              {sortedFehlendeMietzahlungen.map((rueckstand) => (
                <Card 
                  key={rueckstand.mietvertrag_id} 
                  className="border border-red-200 bg-white/50 hover:bg-white/80 transition-all duration-200 cursor-pointer hover-scale"
                  onClick={(e) => handleMietvertragClick(rueckstand.mietvertrag_id, e)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        {/* Property and Unit Info */}
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {rueckstand.immobilie_name}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {rueckstand.einheit_typ} - {rueckstand.einheit_etage}
                          </Badge>
                        </div>
                        
                        {/* Address */}
                        <p className="text-sm text-gray-600">{rueckstand.immobilie_adresse}</p>
                        
                        {/* Tenant Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{rueckstand.mieter_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Euro className="h-4 w-4" />
                            <span>Kaltmiete: {formatBetrag(rueckstand.kaltmiete)}</span>
                          </div>
                          {rueckstand.einheit_qm > 0 && (
                            <span>{rueckstand.einheit_qm} m²</span>
                          )}
                        </div>

                        {/* Payment Summary */}
                        <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
                          <div>
                            <p className="text-gray-600">Forderungen</p>
                            <p className="font-medium">{formatBetrag(rueckstand.gesamt_forderungen)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Miete-Zahlungen</p>
                            <p className="font-medium text-green-600">{formatBetrag(rueckstand.miete_zahlungen)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Rückstand</p>
                            <p className="font-bold text-red-600">{formatBetrag(rueckstand.fehlend_betrag)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Section */}
                      <div className="flex flex-col items-end gap-2 ml-4">
                        {/* Mahnstufe */}
                        {rueckstand.mahnstufe > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            Mahnstufe {rueckstand.mahnstufe}
                          </Badge>
                        )}
                        
                        {/* View Button */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => handleMietvertragClick(rueckstand.mietvertrag_id, e)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Summary Footer */}
              <div className="pt-4 border-t border-red-200">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {sortedFehlendeMietzahlungen.length} Mietvertrag{sortedFehlendeMietzahlungen.length !== 1 ? 'e' : ''} mit Rückständen
                  </p>
                  <p className="font-semibold text-red-600">
                    Gesamtrückstand: {formatBetrag(gesamtRueckstand)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 animate-fade-in">
              <div className="p-6 bg-green-50 rounded-lg border border-green-200 inline-block">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-green-100 rounded-full">
                    <Euro className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-green-700 font-medium text-lg">Keine Rückstände</p>
                  <p className="text-green-600 text-sm">Alle Mietverträge sind auf dem aktuellen Stand</p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
