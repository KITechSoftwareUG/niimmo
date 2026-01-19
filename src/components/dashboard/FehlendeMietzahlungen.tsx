
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

  const { rueckstaende, guthaben, sortedFehlendeMietzahlungen } = useMemo(() => {
    if (!fehlendeMietzahlungen) return { rueckstaende: [], guthaben: [], sortedFehlendeMietzahlungen: [] };
    
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
    
    // 5. Split into Rückstände and Guthaben
    const rueckstaendeList = sorted.filter(item => !item.ist_guthaben);
    const guthabenList = sorted.filter(item => item.ist_guthaben);
    
    return {
      rueckstaende: rueckstaendeList,
      guthaben: guthabenList,
      sortedFehlendeMietzahlungen: sorted
    };
  }, [fehlendeMietzahlungen, sortBy, sortDirection, amountFilter, minAmountFilter]);

  const gesamtRueckstandBetrag = rueckstaende.reduce((sum, item) => sum + item.fehlend_betrag, 0);
  const gesamtGuthabenBetrag = guthaben.reduce((sum, item) => sum + item.fehlend_betrag, 0);

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
      <div id="rueckstaende-section" className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-red-100 bg-red-50/30">
        <CollapsibleTrigger className="w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              </div>
              <div className="text-left min-w-0">
                <h2 className="text-sm sm:text-lg font-semibold text-gray-800">Rückstände & Guthaben</h2>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {fehlendeMietzahlungen?.length || 0} Vertrag{(fehlendeMietzahlungen?.length || 0) !== 1 ? 'e' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {(gesamtRueckstandBetrag > 0 || gesamtGuthabenBetrag > 0) && (
                <div className="text-right mr-2 sm:mr-4 hidden xs:flex gap-2 sm:gap-4">
                  {gesamtRueckstandBetrag > 0 && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Rückstände</p>
                      <p className="text-sm sm:text-xl font-bold text-red-600">
                        {formatBetrag(gesamtRueckstandBetrag)}
                      </p>
                    </div>
                  )}
                  {gesamtGuthabenBetrag > 0 && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Guthaben</p>
                      <p className="text-sm sm:text-xl font-bold text-green-600">
                        {formatBetrag(gesamtGuthabenBetrag)}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {/* Mobile Summary - Shows on small screens */}
          {(gesamtRueckstandBetrag > 0 || gesamtGuthabenBetrag > 0) && (
            <div className="flex xs:hidden gap-3 mb-3 p-2 bg-white/50 rounded-lg">
              {gesamtRueckstandBetrag > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-600">Rückstände</p>
                  <p className="text-sm font-bold text-red-600">{formatBetrag(gesamtRueckstandBetrag)}</p>
                </div>
              )}
              {gesamtGuthabenBetrag > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-600">Guthaben</p>
                  <p className="text-sm font-bold text-green-600">{formatBetrag(gesamtGuthabenBetrag)}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Sorting Controls */}
          {fehlendeMietzahlungen && fehlendeMietzahlungen.length > 0 && (
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-b border-red-200 pb-3 sm:pb-4">
              {/* Sort Buttons - Horizontal scroll on mobile */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                <Button
                  variant={sortBy === 'object' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('object')}
                  className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  Objekt {getSortIcon('object')}
                </Button>
                <Button
                  variant={sortBy === 'amount' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('amount')}
                  className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  Betrag {getSortIcon('amount')}
                </Button>
                <Button
                  variant={sortBy === 'mahnstufe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('mahnstufe')}
                  className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  Mahnstufe {getSortIcon('mahnstufe')}
                </Button>
                <Button
                  variant={sortBy === 'tenant' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('tenant')}
                  className="gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                >
                  Mieter {getSortIcon('tenant')}
                </Button>
              </div>
              
              {/* Filter Controls */}
              <div className="flex gap-2 items-center overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 flex-shrink-0">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                </div>
                
                <Select value={amountFilter} onValueChange={(value: AmountFilter) => setAmountFilter(value)}>
                  <SelectTrigger className="w-24 sm:w-32 h-8 text-xs sm:text-sm flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="debt">Rückstände</SelectItem>
                    <SelectItem value="credit">Guthaben</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={minAmountFilter} onValueChange={(value: MinAmountFilter) => setMinAmountFilter(value)}>
                  <SelectTrigger className="w-24 sm:w-36 h-8 text-xs sm:text-sm flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle €</SelectItem>
                    <SelectItem value="over100">&gt;100€</SelectItem>
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
          
          {/* Contract List - Grouped by Rückstände and Guthaben */}
          {sortedFehlendeMietzahlungen && sortedFehlendeMietzahlungen.length > 0 ? (
            <div className="space-y-6 animate-fade-in">
              {/* Rückstände Section */}
              {rueckstaende.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                      <h3 className="font-semibold text-red-900 text-sm sm:text-base">Rückstände</h3>
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        {rueckstaende.length} Vertrag{rueckstaende.length !== 1 ? 'e' : ''}
                      </Badge>
                    </div>
                    <p className="font-bold text-red-600 text-sm sm:text-base">
                      {formatBetrag(gesamtRueckstandBetrag)}
                    </p>
                  </div>
                  
                  {rueckstaende.map((rueckstand) => (
                    <Card 
                      key={rueckstand.mietvertrag_id}
                      id={`rueckstand-${rueckstand.mietvertrag_id}`}
                      className="border border-red-200 bg-white/50 hover:bg-white/80 transition-all duration-200 cursor-pointer hover-scale"
                      onClick={(e) => handleMietvertragClick(rueckstand.mietvertrag_id, e)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 space-y-2 min-w-0">
                            {/* Property and Unit Info */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                {rueckstand.immobilie_name}
                              </h3>
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {rueckstand.einheit_typ} - {rueckstand.einheit_etage}
                              </Badge>
                              {/* Vertragsstatus anzeigen wenn nicht aktiv */}
                              {rueckstand.mietvertrag_status !== 'Aktiv' && (
                                <Badge 
                                  variant="secondary" 
                                  className={`text-[10px] sm:text-xs ${
                                    rueckstand.mietvertrag_status === 'Gekündigt' 
                                      ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                      : 'bg-gray-100 text-gray-700 border-gray-200'
                                  }`}
                                >
                                  {rueckstand.mietvertrag_status}
                                </Badge>
                              )}
                              {/* Mahnstufe - Show inline on mobile */}
                              {rueckstand.mahnstufe > 0 && (
                                <Badge variant="destructive" className="text-[10px] sm:text-xs sm:hidden">
                                  Mahnstufe {rueckstand.mahnstufe}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Address */}
                            <p className="text-xs sm:text-sm text-gray-600 truncate">{rueckstand.immobilie_adresse}</p>
                            
                            {/* Tenant Info - Stack on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{rueckstand.mieter_name}</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-4">
                                <div className="flex items-center gap-1">
                                  <Euro className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                  <span className="whitespace-nowrap">Kaltmiete: {formatBetrag(rueckstand.kaltmiete)}</span>
                                </div>
                                {rueckstand.einheit_qm > 0 && (
                                  <span className="whitespace-nowrap">{rueckstand.einheit_qm} m²</span>
                                )}
                              </div>
                            </div>

                            {/* Financial grid - 2 cols on mobile, 3 on desktop */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 pt-2 text-xs sm:text-sm">
                              <div>
                                <p className="text-gray-600">Forderungen</p>
                                <p className="font-medium">{formatBetrag(rueckstand.gesamt_forderungen)}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Zahlungen</p>
                                <p className="font-medium text-green-600">{formatBetrag(rueckstand.gesamt_zahlungen)}</p>
                              </div>
                              <div className="col-span-2 sm:col-span-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                                <p className="text-gray-600">Rückstand</p>
                                <p className="font-bold text-red-600 text-sm sm:text-base">
                                  {formatBetrag(rueckstand.fehlend_betrag)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Section - Hidden on mobile, details accessible via card click */}
                          <div className="hidden sm:flex flex-col items-end gap-2 ml-4 flex-shrink-0">
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
                </div>
              )}

              {/* Guthaben Section */}
              {guthaben.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      <h3 className="font-semibold text-green-900 text-sm sm:text-base">Guthaben</h3>
                      <Badge className="text-[10px] sm:text-xs bg-green-600">
                        {guthaben.length} Vertrag{guthaben.length !== 1 ? 'e' : ''}
                      </Badge>
                    </div>
                    <p className="font-bold text-green-600 text-sm sm:text-base">
                      {formatBetrag(gesamtGuthabenBetrag)}
                    </p>
                  </div>
                  
                  {guthaben.map((guthabenItem) => (
                    <Card 
                      key={guthabenItem.mietvertrag_id}
                      id={`rueckstand-${guthabenItem.mietvertrag_id}`}
                      className="border border-green-200 bg-white/50 hover:bg-white/80 transition-all duration-200 cursor-pointer hover-scale"
                      onClick={(e) => handleMietvertragClick(guthabenItem.mietvertrag_id, e)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 space-y-2 min-w-0">
                            {/* Property and Unit Info */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                {guthabenItem.immobilie_name}
                              </h3>
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {guthabenItem.einheit_typ} - {guthabenItem.einheit_etage}
                              </Badge>
                              {/* Vertragsstatus anzeigen wenn nicht aktiv */}
                              {guthabenItem.mietvertrag_status !== 'Aktiv' && (
                                <Badge 
                                  variant="secondary" 
                                  className={`text-[10px] sm:text-xs ${
                                    guthabenItem.mietvertrag_status === 'Gekündigt' 
                                      ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                      : 'bg-gray-100 text-gray-700 border-gray-200'
                                  }`}
                                >
                                  {guthabenItem.mietvertrag_status}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Address */}
                            <p className="text-xs sm:text-sm text-gray-600 truncate">{guthabenItem.immobilie_adresse}</p>
                            
                            {/* Tenant Info - Stack on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{guthabenItem.mieter_name}</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-4">
                                <div className="flex items-center gap-1">
                                  <Euro className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                  <span className="whitespace-nowrap">Kaltmiete: {formatBetrag(guthabenItem.kaltmiete)}</span>
                                </div>
                                {guthabenItem.einheit_qm > 0 && (
                                  <span className="whitespace-nowrap">{guthabenItem.einheit_qm} m²</span>
                                )}
                              </div>
                            </div>

                            {/* Financial grid - 2 cols on mobile, 3 on desktop */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 pt-2 text-xs sm:text-sm">
                              <div>
                                <p className="text-gray-600">Forderungen</p>
                                <p className="font-medium">{formatBetrag(guthabenItem.gesamt_forderungen)}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Zahlungen</p>
                                <p className="font-medium text-green-600">{formatBetrag(guthabenItem.gesamt_zahlungen)}</p>
                              </div>
                              <div className="col-span-2 sm:col-span-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                                <p className="text-gray-600">Guthaben</p>
                                <p className="font-bold text-green-600 text-sm sm:text-base">
                                  {formatBetrag(guthabenItem.fehlend_betrag)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Section - Hidden on mobile */}
                          <div className="hidden sm:flex flex-col items-end gap-2 ml-4 flex-shrink-0">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => handleMietvertragClick(guthabenItem.mietvertrag_id, e)}
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
                </div>
              )}
              
              {/* Summary Footer */}
              <div className="pt-4 border-t border-gray-300">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <p className="text-xs sm:text-sm text-gray-600">
                    {sortedFehlendeMietzahlungen.length} Mietvertrag{sortedFehlendeMietzahlungen.length !== 1 ? 'e' : ''} mit Rückständen oder Guthaben
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    {rueckstaende.length > 0 && (
                      <p className="font-semibold text-red-600 text-xs sm:text-sm">
                        Rückstände: {formatBetrag(gesamtRueckstandBetrag)}
                      </p>
                    )}
                    {guthaben.length > 0 && (
                      <p className="font-semibold text-green-600 text-xs sm:text-sm">
                        Guthaben: {formatBetrag(gesamtGuthabenBetrag)}
                      </p>
                    )}
                  </div>
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
