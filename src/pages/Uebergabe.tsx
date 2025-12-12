import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogIn, LogOut, Building2, Loader2, User, MapPin, Calendar } from "lucide-react";
import { format, addMonths, isAfter, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import { UebergabeDialog } from "@/components/dashboard/handover/UebergabeDialog";
import { cn } from "@/lib/utils";

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
    vorname: string;
    nachname: string;
  }>;
}

export const Uebergabe = ({ onBack }: UebergabeProps) => {
  const [uebergabeType, setUebergabeType] = useState<UebergabeType>(null);
  const [selectedContract, setSelectedContract] = useState<ContractWithDetails | null>(null);
  const [showDialog, setShowDialog] = useState(false);

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
            .select('mieter:mieter_id (vorname, nachname)')
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

  // Filter contracts based on type
  const filteredContracts = contracts?.filter(contract => {
    const today = new Date();
    const threeMonthsFromNow = addMonths(today, 3);

    if (uebergabeType === "einzug") {
      // EINZUG: Leerstehende Einheiten (beendet) oder frische Verträge ohne Einzugs-Zählerstände
      const isBeendet = contract.status === "beendet";
      const isFreshWithoutReadings = contract.status === "aktiv" && 
        !contract.strom_einzug && 
        !contract.gas_einzug && 
        !contract.kaltwasser_einzug && 
        !contract.warmwasser_einzug;
      
      return isBeendet || isFreshWithoutReadings;
    } else if (uebergabeType === "auszug") {
      // AUSZUG: gekündigt, innerhalb 3 Monate auslaufend, oder frisch beendet
      const isGekuendigt = contract.status === "gekuendigt";
      
      // Check if contract expires within 3 months
      const isExpiringWithin3Months = contract.status === "aktiv" && 
        contract.kuendigungsdatum && 
        isBefore(new Date(contract.kuendigungsdatum), threeMonthsFromNow) &&
        isAfter(new Date(contract.kuendigungsdatum), today);
      
      // Recently ended (within last month)
      const isRecentlyEnded = contract.status === "beendet" && 
        contract.ende_datum && 
        isAfter(new Date(contract.ende_datum), addMonths(today, -1));

      return isGekuendigt || isExpiringWithin3Months || isRecentlyEnded;
    }
    return false;
  }) || [];

  const handleContractClick = (contract: ContractWithDetails) => {
    setSelectedContract(contract);
    setShowDialog(true);
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setSelectedContract(null);
  };

  const handleSuccess = () => {
    refetch();
    handleDialogClose();
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
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUebergabeType(null)}
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
                <LogIn className={cn("h-5 w-5", uebergabeType === "einzug" ? "text-green-600" : "text-orange-600")} />
              ) : (
                <LogOut className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-sans font-bold text-gradient-red">
                {uebergabeType === "einzug" ? "Einzug-Übergabe" : "Auszug-Übergabe"}
              </h1>
              <p className="text-gray-600 font-sans text-xs sm:text-sm">
                {filteredContracts.length} {filteredContracts.length === 1 ? "Vertrag" : "Verträge"} gefunden
              </p>
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
        {!isLoading && filteredContracts.length === 0 && (
          <div className="text-center py-12">
            <div className="glass-card p-8 max-w-md mx-auto rounded-2xl">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Keine Verträge gefunden
              </h3>
              <p className="text-gray-500 text-sm">
                {uebergabeType === "einzug" 
                  ? "Es gibt aktuell keine leerstehenden Einheiten oder neue Verträge ohne Einzugs-Übergabe."
                  : "Es gibt aktuell keine gekündigten oder bald auslaufenden Verträge."
                }
              </p>
            </div>
          </div>
        )}

        {/* Contract Cards */}
        {!isLoading && filteredContracts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredContracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => handleContractClick(contract)}
                className="glass-card p-4 sm:p-5 rounded-xl hover:shadow-lg transition-all duration-200 text-left group"
              >
                {/* Property Info */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn(
                    "p-2 rounded-lg flex-shrink-0",
                    uebergabeType === "einzug" ? "bg-green-50" : "bg-orange-50"
                  )}>
                    <Building2 className={cn(
                      "h-5 w-5",
                      uebergabeType === "einzug" ? "text-green-600" : "text-orange-600"
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {contract.einheit.immobilie.name}
                    </h3>
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{contract.einheit.immobilie.adresse}</span>
                    </div>
                  </div>
                </div>

                {/* Unit Info */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Einheit:</span>{" "}
                    {contract.einheit.etage || "–"} / Nr. {contract.einheit.zaehler || "–"}
                  </div>
                </div>

                {/* Tenant Info */}
                {contract.mieter.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700 truncate">
                      {contract.mieter.map(m => `${m.vorname} ${m.nachname}`).join(", ")}
                    </span>
                  </div>
                )}

                {/* Status & Dates */}
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    "px-2 py-1 rounded-full font-medium",
                    contract.status === "aktiv" && "bg-green-100 text-green-700",
                    contract.status === "gekuendigt" && "bg-orange-100 text-orange-700",
                    contract.status === "beendet" && "bg-gray-100 text-gray-700"
                  )}>
                    {contract.status === "aktiv" && "Aktiv"}
                    {contract.status === "gekuendigt" && "Gekündigt"}
                    {contract.status === "beendet" && "Beendet"}
                  </span>
                  
                  {contract.kuendigungsdatum && (
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(contract.kuendigungsdatum), "dd.MM.yyyy", { locale: de })}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Übergabe Dialog */}
      {selectedContract && (
        <UebergabeDialog
          isOpen={showDialog}
          onClose={handleDialogClose}
          vertragId={selectedContract.id}
          einheit={{
            id: selectedContract.einheit.id,
            nummer: selectedContract.einheit.zaehler?.toString(),
            etage: selectedContract.einheit.etage || undefined
          }}
          immobilie={{
            name: selectedContract.einheit.immobilie.name,
            adresse: selectedContract.einheit.immobilie.adresse
          }}
          mieterName={selectedContract.mieter.map(m => `${m.vorname} ${m.nachname}`).join(", ")}
          kuendigungsdatum={selectedContract.kuendigungsdatum || undefined}
          onSuccess={handleSuccess}
          isEinzug={uebergabeType === "einzug"}
        />
      )}
    </div>
  );
};

export default Uebergabe;
