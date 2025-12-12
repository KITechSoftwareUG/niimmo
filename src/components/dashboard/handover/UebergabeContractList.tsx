import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Building2, User, Calendar, MapPin, Clock, AlertTriangle, Link2 } from "lucide-react";
import { format, addDays, isAfter, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  priority: number;
  priorityLabel?: string;
  meetsCriteria?: boolean;
  warningMessage?: string;
}

interface UebergabeContractListProps {
  contracts: ContractWithDetails[];
  uebergabeType: "einzug" | "auszug";
  searchQuery: string;
  onContractClick: (group: ContractGroup) => void;
}

export const UebergabeContractList = ({
  contracts,
  uebergabeType,
  searchQuery,
  onContractClick,
}: UebergabeContractListProps) => {
  const today = new Date();
  const oneWeekAgo = addDays(today, -7);
  const oneMonthAgo = addDays(today, -30);

  const checkContractMeetsCriteria = (contract: ContractWithDetails): boolean => {
    if (uebergabeType === "einzug") {
      const isBeendet = contract.status === "beendet";
      const hasNoMeterReadings = !contract.strom_einzug && !contract.gas_einzug && 
        !contract.kaltwasser_einzug && !contract.warmwasser_einzug;
      const isFreshMoveIn = contract.status === "aktiv" && 
        contract.start_datum && 
        isAfter(new Date(contract.start_datum), oneMonthAgo) && 
        hasNoMeterReadings;
      return isBeendet || isFreshMoveIn;
    } else {
      const isGekuendigt = contract.status === "gekuendigt";
      const threeMonthsFromNow = addDays(today, 90);
      const isExpiringWithin3Months = contract.status === "aktiv" && 
        contract.kuendigungsdatum && 
        new Date(contract.kuendigungsdatum) <= threeMonthsFromNow &&
        new Date(contract.kuendigungsdatum) > today;
      const isRecentlyEnded = contract.status === "beendet" && 
        contract.ende_datum && 
        isAfter(new Date(contract.ende_datum), oneMonthAgo);
      return isGekuendigt || isExpiringWithin3Months || isRecentlyEnded;
    }
  };

  const getPriority = (contract: ContractWithDetails): { priority: number; label?: string } => {
    if (uebergabeType === "einzug") {
      if (contract.start_datum) {
        const startDate = new Date(contract.start_datum);
        const daysAgo = differenceInDays(today, startDate);
        
        if (daysAgo >= 0 && daysAgo <= 7 && contract.status === "aktiv") {
          return { priority: 1, label: `vor ${daysAgo} Tag${daysAgo !== 1 ? 'en' : ''} eingezogen` };
        }
        if (daysAgo >= 0 && daysAgo <= 30 && contract.status === "aktiv") {
          return { priority: 2, label: "diesen Monat eingezogen" };
        }
      }
      if (contract.status === "beendet") {
        return { priority: 3, label: "leerstehend" };
      }
      return { priority: 10 };
    } else {
      if (contract.kuendigungsdatum) {
        const endDate = new Date(contract.kuendigungsdatum);
        const daysUntil = differenceInDays(endDate, today);
        
        if (daysUntil >= 0 && daysUntil <= 7) {
          return { priority: 1, label: `in ${daysUntil} Tag${daysUntil !== 1 ? 'en' : ''}` };
        }
        if (daysUntil >= 0 && daysUntil <= 30) {
          return { priority: 2, label: "diesen Monat" };
        }
      }
      if (contract.status === "gekuendigt") {
        return { priority: 3, label: "gekündigt" };
      }
      return { priority: 10 };
    }
  };

  const getWarningMessage = (contract: ContractWithDetails): string => {
    if (uebergabeType === "einzug") {
      if (contract.status === "aktiv" && (contract.strom_einzug || contract.gas_einzug || 
          contract.kaltwasser_einzug || contract.warmwasser_einzug)) {
        return "Bereits dokumentierte Einzugs-Übergabe";
      }
      if (contract.status === "gekuendigt") {
        return "Mietvertrag ist gekündigt";
      }
    }
    return "Erfüllt nicht die Standard-Kriterien";
  };

  // Group contracts by tenant (linked contracts)
  const groupedContracts = useMemo(() => {
    const groups: ContractGroup[] = [];
    const processedIds = new Set<string>();

    // Filter based on search
    let filteredContracts = contracts;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredContracts = contracts.filter(c => {
        const mieterNames = c.mieter.map(m => `${m.vorname} ${m.nachname}`.toLowerCase()).join(" ");
        const immobilieName = c.einheit.immobilie.name.toLowerCase();
        const adresse = c.einheit.immobilie.adresse.toLowerCase();
        const etage = c.einheit.etage?.toLowerCase() || "";
        return mieterNames.includes(query) || immobilieName.includes(query) || 
               adresse.includes(query) || etage.includes(query);
      });
    }

    // Separate by criteria match
    const meetsCriteriaContracts = filteredContracts.filter(c => checkContractMeetsCriteria(c));
    const otherContracts = filteredContracts.filter(c => !checkContractMeetsCriteria(c));

    // Process contracts that meet criteria
    for (const contract of meetsCriteriaContracts) {
      if (processedIds.has(contract.id)) continue;

      const mieterIds = contract.mieter.map(m => m.id);
      const linkedContracts = meetsCriteriaContracts.filter(c => {
        if (c.id === contract.id) return false;
        const cMieterIds = c.mieter.map(m => m.id);
        return mieterIds.some(id => cMieterIds.includes(id));
      });

      const allContractsInGroup = [contract, ...linkedContracts];
      const endDates = allContractsInGroup.map(c => c.kuendigungsdatum || c.ende_datum).filter(Boolean);
      const hasDifferentEndDates = new Set(endDates).size > 1;

      const { priority, label } = getPriority(contract);

      if (linkedContracts.length > 0 && !hasDifferentEndDates) {
        groups.push({
          contracts: allContractsInGroup,
          isLinked: true,
          hasDifferentEndDates: false,
          mieterIds,
          priority,
          priorityLabel: label,
          meetsCriteria: true,
        });
        allContractsInGroup.forEach(c => processedIds.add(c.id));
      } else {
        groups.push({
          contracts: [contract],
          isLinked: linkedContracts.length > 0,
          hasDifferentEndDates,
          mieterIds,
          priority,
          priorityLabel: label,
          meetsCriteria: true,
        });
        processedIds.add(contract.id);
      }
    }

    // Process other contracts (only shown when searching)
    if (searchQuery.trim()) {
      for (const contract of otherContracts) {
        if (processedIds.has(contract.id)) continue;
        groups.push({
          contracts: [contract],
          isLinked: false,
          hasDifferentEndDates: false,
          mieterIds: contract.mieter.map(m => m.id),
          priority: 100,
          meetsCriteria: false,
          warningMessage: getWarningMessage(contract),
        });
        processedIds.add(contract.id);
      }
    }

    // Sort by priority
    return groups.sort((a, b) => a.priority - b.priority);
  }, [contracts, uebergabeType, searchQuery]);

  // Separate high-priority and other groups
  const highPriorityGroups = groupedContracts.filter(g => g.priority <= 2 && g.meetsCriteria);
  const standardGroups = groupedContracts.filter(g => g.priority > 2 && g.priority < 100 && g.meetsCriteria);
  const otherGroups = groupedContracts.filter(g => g.priority >= 100 || !g.meetsCriteria);

  const renderContractRow = (group: ContractGroup, dimmed: boolean = false) => {
    const mainContract = group.contracts[0];
    const mieterName = mainContract.mieter.map(m => `${m.vorname} ${m.nachname}`).join(", ");
    const totalMiete = (mainContract.kaltmiete || 0) + (mainContract.betriebskosten || 0);

    return (
      <button
        key={group.contracts.map(c => c.id).join("-")}
        onClick={() => onContractClick(group)}
        className={cn(
          "w-full text-left p-3 sm:p-4 rounded-xl border transition-all duration-200",
          "hover:shadow-md hover:border-primary/30",
          dimmed 
            ? "bg-gray-50/50 border-gray-200 opacity-60 hover:opacity-100" 
            : group.meetsCriteria === false 
              ? "bg-amber-50/50 border-amber-200"
              : "bg-white border-gray-200"
        )}
      >
        {/* Warning for non-matching */}
        {group.meetsCriteria === false && (
          <div className="flex items-center gap-2 mb-2 text-amber-600 text-xs bg-amber-100 rounded-lg px-2 py-1">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>{group.warningMessage}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Tenant & Priority */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="font-semibold text-gray-900 truncate">
                {mieterName || "Kein Mieter"}
              </span>
              
              {/* Priority Badge */}
              {group.priorityLabel && group.priority <= 2 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs",
                    group.priority === 1 
                      ? "bg-red-100 text-red-700" 
                      : "bg-orange-100 text-orange-700"
                  )}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {group.priorityLabel}
                </Badge>
              )}

              {/* Linked Badge */}
              {group.contracts.length > 1 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                  <Link2 className="h-3 w-3 mr-1" />
                  {group.contracts.length} Einheiten
                </Badge>
              )}
            </div>

            {/* Property Info */}
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {mainContract.einheit.immobilie.name}
                {mainContract.einheit.etage && ` – ${mainContract.einheit.etage}`}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{mainContract.einheit.immobilie.adresse}</span>
            </div>
          </div>

          {/* Right Side: Status & Dates */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            {/* Status Badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                mainContract.status === "aktiv" && "border-green-300 bg-green-50 text-green-700",
                mainContract.status === "gekuendigt" && "border-orange-300 bg-orange-50 text-orange-700",
                mainContract.status === "beendet" && "border-gray-300 bg-gray-50 text-gray-700"
              )}
            >
              {mainContract.status === "aktiv" && "Aktiv"}
              {mainContract.status === "gekuendigt" && "Gekündigt"}
              {mainContract.status === "beendet" && "Leerstehend"}
            </Badge>

            {/* Contract Duration */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>
                {mainContract.start_datum 
                  ? format(new Date(mainContract.start_datum), "dd.MM.yyyy", { locale: de })
                  : "–"
                }
                {mainContract.kuendigungsdatum && (
                  <> → {format(new Date(mainContract.kuendigungsdatum), "dd.MM.yyyy", { locale: de })}</>
                )}
                {!mainContract.kuendigungsdatum && mainContract.ende_datum && (
                  <> → {format(new Date(mainContract.ende_datum), "dd.MM.yyyy", { locale: de })}</>
                )}
                {!mainContract.kuendigungsdatum && !mainContract.ende_datum && " → unbefristet"}
              </span>
            </div>

            {/* Rent Amount */}
            {totalMiete > 0 && (
              <span className="text-xs font-medium text-gray-600">
                {totalMiete.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}/Monat
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* High Priority Section */}
      {highPriorityGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-red-100">
              <Clock className="h-4 w-4 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">Priorität</h3>
            <span className="text-xs text-gray-500">({highPriorityGroups.length})</span>
          </div>
          <div className="space-y-2">
            {highPriorityGroups.map(group => renderContractRow(group))}
          </div>
        </div>
      )}

      {/* Standard Section */}
      {standardGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-gray-100">
              <Building2 className="h-4 w-4 text-gray-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              {uebergabeType === "einzug" ? "Weitere Einzüge" : "Weitere Auszüge"}
            </h3>
            <span className="text-xs text-gray-500">({standardGroups.length})</span>
          </div>
          <div className="space-y-2">
            {standardGroups.map(group => renderContractRow(group))}
          </div>
        </div>
      )}

      {/* Other Contracts (from search) */}
      {otherGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-gray-100">
              <AlertTriangle className="h-4 w-4 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500">Sonstige Ergebnisse</h3>
            <span className="text-xs text-gray-400">({otherGroups.length})</span>
          </div>
          <div className="space-y-2">
            {otherGroups.map(group => renderContractRow(group, true))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {groupedContracts.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {searchQuery ? "Keine Suchergebnisse" : "Keine Verträge gefunden"}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchQuery
              ? `Keine Verträge für "${searchQuery}" gefunden.`
              : uebergabeType === "einzug"
                ? "Es gibt aktuell keine passenden Einzugs-Übergaben."
                : "Es gibt aktuell keine passenden Auszugs-Übergaben."
            }
          </p>
        </div>
      )}
    </div>
  );
};
