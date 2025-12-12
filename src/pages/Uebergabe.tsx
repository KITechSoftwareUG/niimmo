import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogIn, LogOut, Building2, Loader2, User, MapPin, Calendar, Search, AlertTriangle, Link2 } from "lucide-react";
import { format, addMonths, isAfter, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import { UebergabeDialog } from "@/components/dashboard/handover/UebergabeDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UebergabeProps {
  onBack: () => void;
}

type UebergabeType = "einzug" | "auszug" | null;

interface ContractWithDetails {
  id: string;
  status: string;
  start_datum: string | null;
  ende_datum: string | null;
  kuendigungsdatum: string | null;
  kaltmiete: number | null;
  betriebskosten: number | null;
  strom_einzug: number | null;
  gas_einzug: number | null;
  kaltwasser_einzug: number | null;
  warmwasser_einzug: number | null;
  einheit: {
    id: string;
    etage: string | null;
    zaehler: number | null;
    immobilie: {
      id: string;
      name: string;
      adresse: string;
    };
  };
  mieter: Array<{
    id: string;
    vorname: string;
    nachname: string;
  }>;
}

interface ContractGroup {
  contracts: ContractWithDetails[];
  isLinked: boolean;
  hasDifferentEndDates: boolean;
  mieterIds: string[];
}

export const Uebergabe = ({ onBack }: UebergabeProps) => {
  const [uebergabeType, setUebergabeType] = useState<UebergabeType>(null);
  const [selectedContracts, setSelectedContracts] = useState<ContractWithDetails[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWarningContract, setShowWarningContract] = useState<ContractWithDetails | null>(null);

  // Fetch all contracts with details
  const { data: contracts, isLoading, refetch } = useQuery({
    queryKey: ['uebergabe-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          status,
          start_datum,
          ende_datum,
          kuendigungsdatum,
          kaltmiete,
          betriebskosten,
          strom_einzug,
          gas_einzug,
          kaltwasser_einzug,
          warmwasser_einzug,
          einheiten!inner (
            id,
            etage,
            zaehler,
            immobilien!inner (
              id,
              name,
              adresse
            )
          )
        `)
        .order('start_datum', { ascending: false });

      if (error) throw error;

      // Fetch mieter for each contract
      const contractsWithMieter = await Promise.all(
        (data || []).map(async (contract) => {
          const { data: mieterData } = await supabase
            .from('mietvertrag_mieter')
            .select('mieter:mieter_id (id, vorname, nachname)')
            .eq('mietvertrag_id', contract.id);

          return {
            ...contract,
            einheit: {
              id: contract.einheiten.id,
              etage: contract.einheiten.etage,
              zaehler: contract.einheiten.zaehler,
              immobilie: {
                id: contract.einheiten.immobilien.id,
                name: contract.einheiten.immobilien.name,
                adresse: contract.einheiten.immobilien.adresse,
              }
            },
            mieter: mieterData?.map(m => m.mieter).filter(Boolean) || []
          };
        })
      );

      return contractsWithMieter as ContractWithDetails[];
    }
  });

  // Check if a contract meets the criteria
  const checkContractMeetsCriteria = (contract: ContractWithDetails): boolean => {
    const today = new Date();
    const threeMonthsFromNow = addMonths(today, 3);

    if (uebergabeType === "einzug") {
      const isBeendet = contract.status === "beendet";
      const isFreshWithoutReadings = contract.status === "aktiv" && 
        !contract.strom_einzug && 
        !contract.gas_einzug && 
        !contract.kaltwasser_einzug && 
        !contract.warmwasser_einzug;
      return isBeendet || isFreshWithoutReadings;
    } else if (uebergabeType === "auszug") {
      const isGekuendigt = contract.status === "gekuendigt";
      const isExpiringWithin3Months = contract.status === "aktiv" && 
        contract.kuendigungsdatum && 
        isBefore(new Date(contract.kuendigungsdatum), threeMonthsFromNow) &&
        isAfter(new Date(contract.kuendigungsdatum), today);
      const isRecentlyEnded = contract.status === "beendet" && 
        contract.ende_datum && 
        isAfter(new Date(contract.ende_datum), addMonths(today, -1));
      return isGekuendigt || isExpiringWithin3Months || isRecentlyEnded;
    }
    return false;
  };

  // Group linked contracts by mieter
  const groupedContracts = useMemo(() => {
    if (!contracts || !uebergabeType) return [];

    const groups: ContractGroup[] = [];
    const processedContractIds = new Set<string>();

    // Filter contracts based on type (but keep all for search)
    const relevantContracts = contracts.filter(c => checkContractMeetsCriteria(c));

    for (const contract of relevantContracts) {
      if (processedContractIds.has(contract.id)) continue;

      const mieterIds = contract.mieter.map(m => m.id);
      
      // Find other contracts with the same tenants that also meet criteria
      const linkedContracts = relevantContracts.filter(c => {
        if (c.id === contract.id) return false;
        const cMieterIds = c.mieter.map(m => m.id);
        return mieterIds.some(id => cMieterIds.includes(id));
      });

      // Check if end dates are different
      const allContractsInGroup = [contract, ...linkedContracts];
      const endDates = allContractsInGroup.map(c => c.kuendigungsdatum || c.ende_datum).filter(Boolean);
      const hasDifferentEndDates = new Set(endDates).size > 1;

      if (linkedContracts.length > 0 && !hasDifferentEndDates) {
        // Group them together
        groups.push({
          contracts: allContractsInGroup,
          isLinked: true,
          hasDifferentEndDates: false,
          mieterIds
        });
        allContractsInGroup.forEach(c => processedContractIds.add(c.id));
      } else if (linkedContracts.length > 0 && hasDifferentEndDates) {
        // Show separately with hint
        groups.push({
          contracts: [contract],
          isLinked: true,
          hasDifferentEndDates: true,
          mieterIds
        });
        processedContractIds.add(contract.id);
      } else {
        // Single contract
        groups.push({
          contracts: [contract],
          isLinked: false,
          hasDifferentEndDates: false,
          mieterIds
        });
        processedContractIds.add(contract.id);
      }
    }

    return groups;
  }, [contracts, uebergabeType]);

  // Search through all contracts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !contracts) return [];
    
    const query = searchQuery.toLowerCase();
    return contracts.filter(contract => {
      const mieterNames = contract.mieter.map(m => `${m.vorname} ${m.nachname}`.toLowerCase()).join(" ");
      const immobilieName = contract.einheit.immobilie.name.toLowerCase();
      const adresse = contract.einheit.immobilie.adresse.toLowerCase();
      const etage = contract.einheit.etage?.toLowerCase() || "";
      
      return mieterNames.includes(query) || 
             immobilieName.includes(query) || 
             adresse.includes(query) ||
             etage.includes(query);
    });
  }, [searchQuery, contracts]);

  // Combine grouped and search results
  const displayItems = useMemo(() => {
    if (searchQuery.trim()) {
      // Show search results with warning for non-matching criteria
      return searchResults.map(contract => ({
        contracts: [contract],
        isLinked: false,
        hasDifferentEndDates: false,
        mieterIds: contract.mieter.map(m => m.id),
        meetsCriteria: checkContractMeetsCriteria(contract)
      }));
    }
    return groupedContracts.map(g => ({ ...g, meetsCriteria: true }));
  }, [searchQuery, searchResults, groupedContracts, uebergabeType]);

  const handleContractClick = (group: { contracts: ContractWithDetails[]; meetsCriteria?: boolean }) => {
    if (group.meetsCriteria === false) {
      // Show warning but allow to proceed
      setShowWarningContract(group.contracts[0]);
    } else {
      proceedWithContracts(group.contracts);
    }
  };

  const proceedWithContracts = (contracts: ContractWithDetails[]) => {
    setSelectedContracts(contracts);
    setShowDialog(true);
    setShowWarningContract(null);
  };

  const handleWarningProceed = () => {
    if (showWarningContract) {
      proceedWithContracts([showWarningContract]);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setSelectedContracts([]);
  };

  const handleSuccess = () => {
    refetch();
    handleDialogClose();
    toast.success(
      selectedContracts.length > 1 
        ? `${selectedContracts.length} Übergaben erfolgreich dokumentiert`
        : "Übergabe erfolgreich dokumentiert"
    );
  };

  // Selection screen
  if (!uebergabeType) {
    return (
      <div className="min-h-screen modern-dashboard-bg">
        <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="hover:bg-white/50"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-sans font-bold text-gradient-red">
                  Übergabe
                </h1>
                <p className="text-gray-600 font-sans text-xs sm:text-sm">
                  Wählen Sie den Übergabetyp
                </p>
              </div>
            </div>
          </div>

          {/* Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            <button
              onClick={() => setUebergabeType("einzug")}
              className="glass-card p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-all duration-300 group text-left"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 sm:p-4 rounded-xl bg-green-100 group-hover:bg-green-200 transition-colors">
                  <LogIn className="h-6 sm:h-8 w-6 sm:w-8 text-green-600" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">EINZUG</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base">
                Übergabe an neuen Mieter. Zeigt leerstehende Einheiten und frische Mietverträge ohne dokumentierte Einzugs-Übergabe.
              </p>
            </button>

            <button
              onClick={() => setUebergabeType("auszug")}
              className="glass-card p-6 sm:p-8 rounded-2xl hover:shadow-xl transition-all duration-300 group text-left"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 sm:p-4 rounded-xl bg-orange-100 group-hover:bg-orange-200 transition-colors">
                  <LogOut className="h-6 sm:h-8 w-6 sm:w-8 text-orange-600" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">AUSZUG</h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base">
                Rücknahme vom Mieter. Zeigt gekündigte Verträge, bald auslaufende Verträge und kürzlich beendete Mietverhältnisse.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Contract list screen
  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUebergabeType(null);
                  setSearchQuery("");
                }}
                className="hover:bg-white/50"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
              <div className={cn(
                "p-2 rounded-lg",
                uebergabeType === "einzug" ? "bg-green-100" : "bg-orange-100"
              )}>
                {uebergabeType === "einzug" ? (
                  <LogIn className="h-5 w-5 text-green-600" />
                ) : (
                  <LogOut className="h-5 w-5 text-orange-600" />
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-sans font-bold text-gradient-red">
                  {uebergabeType === "einzug" ? "Einzug-Übergabe" : "Auszug-Übergabe"}
                </h1>
                <p className="text-gray-600 font-sans text-xs sm:text-sm">
                  {displayItems.length} {displayItems.length === 1 ? "Eintrag" : "Einträge"} gefunden
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Mieter, Immobilie suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayItems.length === 0 && (
          <div className="text-center py-12">
            <div className="glass-card p-8 max-w-md mx-auto rounded-2xl">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {searchQuery ? "Keine Suchergebnisse" : "Keine Verträge gefunden"}
              </h3>
              <p className="text-gray-500 text-sm">
                {searchQuery
                  ? `Keine Verträge für "${searchQuery}" gefunden.`
                  : uebergabeType === "einzug" 
                    ? "Es gibt aktuell keine leerstehenden Einheiten oder neue Verträge ohne Einzugs-Übergabe."
                    : "Es gibt aktuell keine gekündigten oder bald auslaufenden Verträge."
                }
              </p>
            </div>
          </div>
        )}

        {/* Contract Cards */}
        {!isLoading && displayItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {displayItems.map((group, groupIndex) => (
              <button
                key={group.contracts.map(c => c.id).join("-")}
                onClick={() => handleContractClick(group)}
                className={cn(
                  "glass-card p-4 sm:p-5 rounded-xl hover:shadow-lg transition-all duration-200 text-left group",
                  group.meetsCriteria === false && "border-2 border-amber-300 bg-amber-50/30"
                )}
              >
                {/* Warning for non-matching criteria */}
                {group.meetsCriteria === false && (
                  <div className="flex items-center gap-2 mb-3 text-amber-600 text-xs bg-amber-100 rounded-lg p-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Erfüllt nicht die Kriterien für {uebergabeType === "einzug" ? "Einzug" : "Auszug"}</span>
                  </div>
                )}

                {/* Linked Contracts Badge */}
                {group.contracts.length > 1 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700">
                      <Link2 className="h-3 w-3" />
                      {group.contracts.length} verbundene Einheiten
                    </Badge>
                  </div>
                )}

                {/* Hint for different end dates */}
                {group.isLinked && group.hasDifferentEndDates && (
                  <div className="flex items-center gap-2 mb-3 text-blue-600 text-xs bg-blue-50 rounded-lg p-2">
                    <Link2 className="h-4 w-4 flex-shrink-0" />
                    <span>Diese Mieter haben weitere Einheiten mit anderem Enddatum</span>
                  </div>
                )}

                {/* Contracts in Group */}
                {group.contracts.map((contract, idx) => (
                  <div 
                    key={contract.id} 
                    className={cn(
                      idx > 0 && "mt-3 pt-3 border-t border-gray-200"
                    )}
                  >
                    {/* Property Info */}
                    <div className="flex items-start gap-3 mb-2">
                      <div className={cn(
                        "p-2 rounded-lg flex-shrink-0",
                        uebergabeType === "einzug" ? "bg-green-50" : "bg-orange-50"
                      )}>
                        <Building2 className={cn(
                          "h-4 w-4",
                          uebergabeType === "einzug" ? "text-green-600" : "text-orange-600"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-800 truncate text-sm">
                          {contract.einheit.immobilie.name}
                        </h3>
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{contract.einheit.immobilie.adresse}</span>
                        </div>
                      </div>
                    </div>

                    {/* Unit Info */}
                    <div className="bg-gray-50 rounded-lg p-2 mb-2">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Einheit:</span>{" "}
                        {contract.einheit.etage || "–"} / Nr. {contract.einheit.zaehler || "–"}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Tenant Info (shown once for group) */}
                {group.contracts[0].mieter.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700 truncate">
                      {group.contracts[0].mieter.map(m => `${m.vorname} ${m.nachname}`).join(", ")}
                    </span>
                  </div>
                )}

                {/* Status & Dates */}
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    "px-2 py-1 rounded-full font-medium",
                    group.contracts[0].status === "aktiv" && "bg-green-100 text-green-700",
                    group.contracts[0].status === "gekuendigt" && "bg-orange-100 text-orange-700",
                    group.contracts[0].status === "beendet" && "bg-gray-100 text-gray-700"
                  )}>
                    {group.contracts[0].status === "aktiv" && "Aktiv"}
                    {group.contracts[0].status === "gekuendigt" && "Gekündigt"}
                    {group.contracts[0].status === "beendet" && "Beendet"}
                  </span>
                  
                  {group.contracts[0].kuendigungsdatum && (
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(group.contracts[0].kuendigungsdatum), "dd.MM.yyyy", { locale: de })}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Warning Dialog for non-matching contracts */}
      {showWarningContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Warnung</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Dieser Mietvertrag erfüllt nicht die üblichen Kriterien für eine {uebergabeType === "einzug" ? "Einzugs" : "Auszugs"}-Übergabe. Möchten Sie trotzdem fortfahren?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowWarningContract(null)}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleWarningProceed}
                className="bg-amber-500 hover:bg-amber-600"
              >
                Trotzdem fortfahren
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Übergabe Dialog */}
      {selectedContracts.length > 0 && (
        <UebergabeDialog
          isOpen={showDialog}
          onClose={handleDialogClose}
          vertragIds={selectedContracts.map(c => c.id)}
          contracts={selectedContracts.map(c => ({
            id: c.id,
            einheit: {
              id: c.einheit.id,
              nummer: c.einheit.zaehler?.toString(),
              etage: c.einheit.etage || undefined,
              immobilie: {
                name: c.einheit.immobilie.name,
                adresse: c.einheit.immobilie.adresse
              }
            },
            kuendigungsdatum: c.kuendigungsdatum || undefined
          }))}
          mieterName={selectedContracts[0].mieter.map(m => `${m.vorname} ${m.nachname}`).join(", ")}
          onSuccess={handleSuccess}
          isEinzug={uebergabeType === "einzug"}
        />
      )}
    </div>
  );
};

export default Uebergabe;
