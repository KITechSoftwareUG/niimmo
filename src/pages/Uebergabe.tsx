import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogIn, LogOut, Loader2, Search, AlertTriangle } from "lucide-react";
import { UebergabeDialog } from "@/components/dashboard/handover/UebergabeDialog";
import { UebergabeContractList } from "@/components/dashboard/handover/UebergabeContractList";
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
  meetsCriteria?: boolean;
  warningMessage?: string;
}

export const Uebergabe = ({ onBack }: UebergabeProps) => {
  const [uebergabeType, setUebergabeType] = useState<UebergabeType>(null);
  const [selectedContracts, setSelectedContracts] = useState<ContractWithDetails[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWarningContract, setShowWarningContract] = useState<ContractGroup | null>(null);

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
      if (!data || data.length === 0) return [] as ContractWithDetails[];

      // Bulk-fetch all mieter assignments in one query instead of N queries
      const contractIds = data.map(c => c.id);
      const { data: allMieterData } = await supabase
        .from('mietvertrag_mieter')
        .select('mietvertrag_id, mieter:mieter_id (id, vorname, nachname)')
        .in('mietvertrag_id', contractIds);

      // Build a lookup map: mietvertrag_id -> mieter[]
      const mieterByContract = new Map<string, Array<{ id: string; vorname: string; nachname: string }>>();
      (allMieterData || []).forEach(entry => {
        if (!entry.mieter) return;
        const list = mieterByContract.get(entry.mietvertrag_id) || [];
        list.push(entry.mieter as any);
        mieterByContract.set(entry.mietvertrag_id, list);
      });

      return data.map(contract => ({
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
        mieter: mieterByContract.get(contract.id) || []
      })) as ContractWithDetails[];
    }
  });

  const handleContractClick = (group: ContractGroup) => {
    if (group.meetsCriteria === false) {
      setShowWarningContract(group);
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
      proceedWithContracts(showWarningContract.contracts);
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
                  Wählen Sie den Mietvertrag für die Übergabe
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Mieter, Objekt oder Adresse suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11"
                autoFocus
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

        {/* Contract List */}
        {!isLoading && contracts && (
          <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl">
            <UebergabeContractList
              contracts={contracts}
              uebergabeType={uebergabeType}
              searchQuery={searchQuery}
              onContractClick={handleContractClick}
            />
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
              <h3 className="text-lg font-semibold text-gray-800">Hinweis</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {showWarningContract.warningMessage || `Dieser Mietvertrag erfüllt nicht die üblichen Kriterien für eine ${uebergabeType === "einzug" ? "Einzugs" : "Auszugs"}-Übergabe.`}
              <br /><br />
              Möchten Sie trotzdem fortfahren?
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
