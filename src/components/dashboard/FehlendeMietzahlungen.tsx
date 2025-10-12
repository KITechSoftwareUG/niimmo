
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Euro, Calendar, User, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { useRueckstaende } from "@/hooks/useRueckstaende";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FehlendeMietzahlungenProps {
  onMietvertragClick?: (mietvertragId: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type SortOption = 'object' | 'amount' | 'mahnstufe' | 'tenant';
type SortDirection = 'asc' | 'desc';
type AmountFilter = 'all' | 'debt' | 'credit';
type MinAmountFilter = 'all' | 'over100';

export const FehlendeMietzahlungen = ({ onMietvertragClick, open, defaultOpen, onOpenChange }: FehlendeMietzahlungenProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [sortBy, setSortBy] = useState<SortOption>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('all');
  const [minAmountFilter, setMinAmountFilter] = useState<MinAmountFilter>('all');
  const { data: fehlendeMietzahlungen, isLoading, error } = useRueckstaende();

  const sortedFehlendeMietzahlungen = useMemo(() => {
    if (!fehlendeMietzahlungen) return [];
    
    // 1. Filter out zero amounts and very small amounts (< 0.01 EUR) first
    let filtered = fehlendeMietzahlungen.filter(item => Math.abs(item.fehlend_betrag) >= 0.01);
    
    // 2. Apply amount type filter (debt/credit)
    if (amountFilter === 'debt') {
      filtered = filtered.filter(item => !item.ist_guthaben);
    } else if (amountFilter === 'credit') {
      filtered = filtered.filter(item => item.ist_guthaben);
    }
    
    // 3. Apply minimum amount filter (>100€)
    if (minAmountFilter === 'over100') {
      filtered = filtered.filter(item => item.fehlend_betrag > 100);
    }
    
    // 4. Sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'object':
          // Use numeric sorting for object names (e.g., "Objekt 1", "Objekt 2", "Objekt 10")
          comparison = a.immobilie_name.localeCompare(b.immobilie_name, undefined, {
            numeric: true,
            sensitivity: 'base'
          });
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
  }, [fehlendeMietzahlungen, sortBy, sortDirection, amountFilter, minAmountFilter]);

  const gesamtRueckstand = fehlendeMietzahlungen?.reduce((sum, item) => {
    return sum + (item.ist_guthaben ? -item.fehlend_betrag : item.fehlend_betrag);
  }, 0) || 0;

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
      <div id="rueckstaende-section" className="glass-card p-6 rounded-2xl border border-red-100 bg-red-50/30">
        <CollapsibleTrigger className="w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-800">Rückstände & Guthaben</h2>
                <p className="text-sm text-gray-600">
                  {fehlendeMietzahlungen?.length || 0} Mietvertrag{(fehlendeMietzahlungen?.length || 0) !== 1 ? 'e' : ''} mit Rückständen oder Guthaben
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {gesamtRueckstand !== 0 && (
                <div className="text-right mr-4">
                  <p className="text-sm text-gray-600">
                    {gesamtRueckstand > 0 ? 'Gesamtrückstand' : 'Gesamtguthaben'}
                  </p>
                  <p className={`text-xl font-bold ${gesamtRueckstand > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatBetrag(Math.abs(gesamtRueckstand))}
                  </p>
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
              
              {/* Filter Controls */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Filter className="h-4 w-4" />
                  <span>Filter:</span>
                </div>
                
                <Select value={amountFilter} onValueChange={(value: AmountFilter) => setAmountFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="debt">Nur Rückstände</SelectItem>
                    <SelectItem value="credit">Nur Guthaben</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={minAmountFilter} onValueChange={(value: MinAmountFilter) => setMinAmountFilter(value)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Beträge</SelectItem>
                    <SelectItem value="over100">Über 100€</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <div className="text-xs text-gray-500">
                  {sortedFehlendeMietzahlungen.length} Einträge {amountFilter !== 'all' || minAmountFilter !== 'all' ? '(gefiltert) ' : ''}sortiert nach{' '}
                  {sortBy === 'object' && 'Objekt'}
                  {sortBy === 'amount' && 'Betrag'}
                  {sortBy === 'mahnstufe' && 'Mahnstufe'}
                  {sortBy === 'tenant' && 'Mieter'}
                  {' '}({sortDirection === 'asc' ? 'aufsteigend' : 'absteigend'})
                </div>
                
                {/* Reset Filter Button */}
                {(amountFilter !== 'all' || minAmountFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAmountFilter('all');
                      setMinAmountFilter('all');
                    }}
                    className="text-xs"
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Contract List */}
          {sortedFehlendeMietzahlungen && sortedFehlendeMietzahlungen.length > 0 ? (
            <div className="space-y-4 animate-fade-in">
              {sortedFehlendeMietzahlungen.map((rueckstand) => (
                <Card 
                  key={rueckstand.mietvertrag_id}
                  id={`rueckstand-${rueckstand.mietvertrag_id}`}
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

                        <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
                          <div>
                            <p className="text-gray-600">Forderungen</p>
                            <p className="font-medium">{formatBetrag(rueckstand.gesamt_forderungen)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Zahlungen</p>
                            <p className="font-medium text-green-600">{formatBetrag(rueckstand.gesamt_zahlungen)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">{rueckstand.ist_guthaben ? 'Guthaben' : 'Rückstand'}</p>
                            <p className={`font-bold ${rueckstand.ist_guthaben ? 'text-green-600' : 'text-red-600'}`}>
                              {rueckstand.ist_guthaben ? 'Guthaben: ' : 'Rückstand: '}
                              {formatBetrag(rueckstand.fehlend_betrag)}
                               {/* Alle Forderungen sind nun fällig - kein Text mehr nötig */}
                            </p>
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
                    {sortedFehlendeMietzahlungen.length} Mietvertrag{sortedFehlendeMietzahlungen.length !== 1 ? 'e' : ''} mit Rückständen oder Guthaben
                  </p>
                  <p className={`font-semibold ${gesamtRueckstand > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {gesamtRueckstand > 0 ? 'Gesamtrückstand' : 'Gesamtguthaben'}: {formatBetrag(Math.abs(gesamtRueckstand))}
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
                  <p className="text-green-700 font-medium text-lg">Keine Rückstände oder Guthaben</p>
                  <p className="text-green-600 text-sm">Alle Mietverträge sind ausgeglichen</p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
