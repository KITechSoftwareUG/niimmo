
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Euro, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { useRueckstaende } from "@/hooks/useRueckstaende";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FehlendeMietzahlungenStatusGroup } from "./FehlendeMietzahlungenStatusGroup";

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
type StatusFilter = 'all' | 'aktiv' | 'gekuendigt' | 'beendet';

export const FehlendeMietzahlungen = ({ onMietvertragClick, open, defaultOpen, onOpenChange }: FehlendeMietzahlungenProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [sortBy, setSortBy] = useState<SortOption>('amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('all');
  const [minAmountFilter, setMinAmountFilter] = useState<MinAmountFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: fehlendeMietzahlungen, isLoading, error } = useRueckstaende();

  const { rueckstaende, guthaben, sortedFehlendeMietzahlungen, statusCounts } = useMemo(() => {
    if (!fehlendeMietzahlungen) return { rueckstaende: { aktiv: [], gekuendigt: [], beendet: [] }, guthaben: { aktiv: [], gekuendigt: [], beendet: [] }, sortedFehlendeMietzahlungen: [], statusCounts: { aktiv: 0, gekuendigt: 0, beendet: 0 } };
    
    // 1. Filter out zero amounts and very small amounts (< 0.01 EUR) first
    let filtered = fehlendeMietzahlungen.filter(item => Math.abs(item.fehlend_betrag) >= 0.01);
    
    // Count status before other filters
    const statusCounts = {
      aktiv: filtered.filter(item => item.mietvertrag_status === 'Aktiv').length,
      gekuendigt: filtered.filter(item => item.mietvertrag_status === 'Gekündigt').length,
      beendet: filtered.filter(item => item.mietvertrag_status === 'Beendet').length
    };
    
    // 2. Apply status filter
    if (statusFilter !== 'all') {
      const statusMap: Record<StatusFilter, string> = {
        all: '',
        aktiv: 'Aktiv',
        gekuendigt: 'Gekündigt',
        beendet: 'Beendet'
      };
      filtered = filtered.filter(item => item.mietvertrag_status === statusMap[statusFilter]);
    }
    
    // 3. Apply amount type filter (debt/credit)
    if (amountFilter === 'debt') {
      filtered = filtered.filter(item => !item.ist_guthaben);
    } else if (amountFilter === 'credit') {
      filtered = filtered.filter(item => item.ist_guthaben);
    }
    
    // 4. Apply minimum amount filter (>100€)
    if (minAmountFilter === 'over100') {
      filtered = filtered.filter(item => item.fehlend_betrag > 100);
    }
    
    // 5. Sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'object':
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
    
    // 6. Split into Rückstände and Guthaben, grouped by status
    const rueckstaendeList = sorted.filter(item => !item.ist_guthaben);
    const guthabenList = sorted.filter(item => item.ist_guthaben);
    
    const groupByStatus = (list: typeof sorted) => ({
      aktiv: list.filter(item => item.mietvertrag_status === 'Aktiv'),
      gekuendigt: list.filter(item => item.mietvertrag_status === 'Gekündigt'),
      beendet: list.filter(item => item.mietvertrag_status === 'Beendet')
    });
    
    return {
      rueckstaende: groupByStatus(rueckstaendeList),
      guthaben: groupByStatus(guthabenList),
      sortedFehlendeMietzahlungen: sorted,
      statusCounts
    };
  }, [fehlendeMietzahlungen, sortBy, sortDirection, amountFilter, minAmountFilter, statusFilter]);

  const allRueckstaende = [...rueckstaende.aktiv, ...rueckstaende.gekuendigt, ...rueckstaende.beendet];
  const allGuthaben = [...guthaben.aktiv, ...guthaben.gekuendigt, ...guthaben.beendet];

  const gesamtRueckstandBetrag = allRueckstaende.reduce((sum, item) => sum + item.fehlend_betrag, 0);
  const gesamtGuthabenBetrag = allGuthaben.reduce((sum, item) => sum + item.fehlend_betrag, 0);

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
                
                <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                  <SelectTrigger className="w-28 sm:w-36 h-8 text-xs sm:text-sm flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status ({statusCounts.aktiv + statusCounts.gekuendigt + statusCounts.beendet})</SelectItem>
                    <SelectItem value="aktiv">Aktiv ({statusCounts.aktiv})</SelectItem>
                    <SelectItem value="gekuendigt">Gekündigt ({statusCounts.gekuendigt})</SelectItem>
                    <SelectItem value="beendet">Beendet ({statusCounts.beendet})</SelectItem>
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
                  {sortedFehlendeMietzahlungen.length} Einträge {amountFilter !== 'all' || minAmountFilter !== 'all' || statusFilter !== 'all' ? '(gefiltert) ' : ''}sortiert nach{' '}
                  {sortBy === 'object' && 'Objekt'}
                  {sortBy === 'amount' && 'Betrag'}
                  {sortBy === 'mahnstufe' && 'Mahnstufe'}
                  {sortBy === 'tenant' && 'Mieter'}
                  {' '}({sortDirection === 'asc' ? 'aufsteigend' : 'absteigend'})
                </div>
                
                {/* Reset Filter Button */}
                {(amountFilter !== 'all' || minAmountFilter !== 'all' || statusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAmountFilter('all');
                      setMinAmountFilter('all');
                      setStatusFilter('all');
                    }}
                    className="text-xs"
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Contract List - Grouped by Rückstände and Guthaben, then by Status */}
          {sortedFehlendeMietzahlungen && sortedFehlendeMietzahlungen.length > 0 ? (
            <div className="space-y-6 animate-fade-in">
              {/* Rückstände Section */}
              {allRueckstaende.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                      <h3 className="font-semibold text-red-900 text-sm sm:text-base">Rückstände</h3>
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        {allRueckstaende.length} Vertrag{allRueckstaende.length !== 1 ? 'e' : ''}
                      </Badge>
                    </div>
                    <p className="font-bold text-red-600 text-sm sm:text-base">
                      {formatBetrag(gesamtRueckstandBetrag)}
                    </p>
                  </div>
                  
                  {/* Grouped by status */}
                  <div className="space-y-4">
                    <FehlendeMietzahlungenStatusGroup
                      status="aktiv"
                      items={rueckstaende.aktiv}
                      onMietvertragClick={handleMietvertragClick}
                      formatBetrag={formatBetrag}
                    />
                    <FehlendeMietzahlungenStatusGroup
                      status="gekuendigt"
                      items={rueckstaende.gekuendigt}
                      onMietvertragClick={handleMietvertragClick}
                      formatBetrag={formatBetrag}
                    />
                    <FehlendeMietzahlungenStatusGroup
                      status="beendet"
                      items={rueckstaende.beendet}
                      onMietvertragClick={handleMietvertragClick}
                      formatBetrag={formatBetrag}
                    />
                  </div>
                </div>
              )}

              {/* Guthaben Section */}
              {allGuthaben.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      <h3 className="font-semibold text-green-900 text-sm sm:text-base">Guthaben</h3>
                      <Badge className="text-[10px] sm:text-xs bg-green-600">
                        {allGuthaben.length} Vertrag{allGuthaben.length !== 1 ? 'e' : ''}
                      </Badge>
                    </div>
                    <p className="font-bold text-green-600 text-sm sm:text-base">
                      {formatBetrag(gesamtGuthabenBetrag)}
                    </p>
                  </div>
                  
                  {/* Grouped by status */}
                  <div className="space-y-4">
                    <FehlendeMietzahlungenStatusGroup
                      status="aktiv"
                      items={guthaben.aktiv}
                      isGuthaben
                      onMietvertragClick={handleMietvertragClick}
                      formatBetrag={formatBetrag}
                    />
                    <FehlendeMietzahlungenStatusGroup
                      status="gekuendigt"
                      items={guthaben.gekuendigt}
                      isGuthaben
                      onMietvertragClick={handleMietvertragClick}
                      formatBetrag={formatBetrag}
                    />
                    <FehlendeMietzahlungenStatusGroup
                      status="beendet"
                      items={guthaben.beendet}
                      isGuthaben
                      onMietvertragClick={handleMietvertragClick}
                      formatBetrag={formatBetrag}
                    />
                  </div>
                </div>
              )}
              
              {/* Summary Footer */}
              <div className="pt-4 border-t border-gray-300">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <p className="text-xs sm:text-sm text-gray-600">
                    {sortedFehlendeMietzahlungen.length} Mietvertrag{sortedFehlendeMietzahlungen.length !== 1 ? 'e' : ''} mit Rückständen oder Guthaben
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    {allRueckstaende.length > 0 && (
                      <p className="font-semibold text-red-600 text-xs sm:text-sm">
                        Rückstände: {formatBetrag(gesamtRueckstandBetrag)}
                      </p>
                    )}
                    {allGuthaben.length > 0 && (
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
