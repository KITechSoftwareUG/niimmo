import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, KeyRound, ClipboardList, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractInfo {
  id: string;
  einheit: {
    id: string;
    nummer?: string;
    etage?: string;
    immobilie: {
      name: string;
      adresse: string;
    };
  };
  kuendigungsdatum?: string;
}

interface UebergabeDialogProps {
  isEinzug?: boolean;
  isOpen: boolean;
  onClose: () => void;
  vertragIds: string[];
  contracts: ContractInfo[];
  mieterName?: string;
  onSuccess?: () => void;
}

interface ZaehlerstaendePerContract {
  [contractId: string]: {
    strom: string;
    gas: string;
    wasser: string;
    warmwasser: string;
  };
}

export const UebergabeDialog = ({
  isOpen,
  onClose,
  vertragIds,
  contracts,
  mieterName,
  onSuccess,
  isEinzug = false,
}: UebergabeDialogProps) => {
  const [uebergabeDatum, setUebergabeDatum] = useState<Date | undefined>(
    contracts[0]?.kuendigungsdatum ? new Date(contracts[0].kuendigungsdatum) : undefined
  );
  const [schluesselAnzahl, setSchluesselAnzahl] = useState<string>("");
  const [zaehlerstaendePerContract, setZaehlerstaendePerContract] = useState<ZaehlerstaendePerContract>(() => {
    const initial: ZaehlerstaendePerContract = {};
    contracts.forEach(c => {
      initial[c.id] = { strom: "", gas: "", wasser: "", warmwasser: "" };
    });
    return initial;
  });
  const [protokollNotizen, setProtokollNotizen] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const updateZaehlerstand = (contractId: string, field: string, value: string) => {
    setZaehlerstaendePerContract(prev => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!uebergabeDatum) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Übergabedatum aus.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update all contracts
      for (const contract of contracts) {
        const zaehlerstaende = zaehlerstaendePerContract[contract.id] || { strom: "", gas: "", wasser: "", warmwasser: "" };
        
        if (isEinzug) {
          const { error: updateError } = await supabase
            .from("mietvertrag")
            .update({
              strom_einzug: zaehlerstaende.strom ? parseFloat(zaehlerstaende.strom) : null,
              gas_einzug: zaehlerstaende.gas ? parseFloat(zaehlerstaende.gas) : null,
              kaltwasser_einzug: zaehlerstaende.wasser ? parseFloat(zaehlerstaende.wasser) : null,
              warmwasser_einzug: zaehlerstaende.warmwasser ? parseFloat(zaehlerstaende.warmwasser) : null,
              start_datum: format(uebergabeDatum, "yyyy-MM-dd"),
            })
            .eq("id", contract.id);

          if (updateError) throw updateError;
        } else {
          const { error: updateError } = await supabase
            .from("mietvertrag")
            .update({
              strom_auszug: zaehlerstaende.strom ? parseFloat(zaehlerstaende.strom) : null,
              gas_auszug: zaehlerstaende.gas ? parseFloat(zaehlerstaende.gas) : null,
              kaltwasser_auszug: zaehlerstaende.wasser ? parseFloat(zaehlerstaende.wasser) : null,
              warmwasser_auszug: zaehlerstaende.warmwasser ? parseFloat(zaehlerstaende.warmwasser) : null,
              status: "beendet",
              ende_datum: format(uebergabeDatum, "yyyy-MM-dd"),
            })
            .eq("id", contract.id);

          if (updateError) throw updateError;
        }
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving handover:", error);
      toast({
        title: "Fehler",
        description: "Die Übergabe konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6 p-1">
      {/* Tenant Info */}
      {mieterName && (
        <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Mieter</p>
          <p className="text-sm font-medium">{mieterName}</p>
        </div>
      )}

      {/* Contracts Info */}
      {contracts.length > 1 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium mb-2">
            {contracts.length} verbundene Einheiten werden gemeinsam übergeben:
          </p>
          <ul className="space-y-1">
            {contracts.map(c => (
              <li key={c.id} className="text-xs text-blue-600 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {c.einheit.immobilie.name} - {c.einheit.etage || "–"} / Nr. {c.einheit.nummer || "–"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Übergabedatum */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Übergabedatum *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-12 sm:h-10",
                !uebergabeDatum && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {uebergabeDatum ? (
                format(uebergabeDatum, "PPP", { locale: de })
              ) : (
                <span>Datum auswählen</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={uebergabeDatum}
              onSelect={setUebergabeDatum}
              initialFocus
              locale={de}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Schlüsselübergabe */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Anzahl übergebener Schlüssel
        </Label>
        <Input
          type="number"
          placeholder="z.B. 3"
          value={schluesselAnzahl}
          onChange={(e) => setSchluesselAnzahl(e.target.value)}
          className="h-12 sm:h-10"
        />
      </div>

      {/* Zählerstände per Contract */}
      {contracts.map((contract, idx) => (
        <div key={contract.id} className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            {contracts.length > 1 && (
              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                {contract.einheit.immobilie.name} - {contract.einheit.etage || "–"}
              </span>
            )}
            Zählerstände bei {isEinzug ? "Einzug" : "Auszug"}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Strom (kWh)</Label>
              <Input
                type="number"
                placeholder="0"
                value={zaehlerstaendePerContract[contract.id]?.strom || ""}
                onChange={(e) => updateZaehlerstand(contract.id, "strom", e.target.value)}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Gas (m³)</Label>
              <Input
                type="number"
                placeholder="0"
                value={zaehlerstaendePerContract[contract.id]?.gas || ""}
                onChange={(e) => updateZaehlerstand(contract.id, "gas", e.target.value)}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kaltwasser (m³)</Label>
              <Input
                type="number"
                placeholder="0"
                value={zaehlerstaendePerContract[contract.id]?.wasser || ""}
                onChange={(e) => updateZaehlerstand(contract.id, "wasser", e.target.value)}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Warmwasser (m³)</Label>
              <Input
                type="number"
                placeholder="0"
                value={zaehlerstaendePerContract[contract.id]?.warmwasser || ""}
                onChange={(e) => updateZaehlerstand(contract.id, "warmwasser", e.target.value)}
                className="h-12 sm:h-10"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Protokollnotizen */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Übergabeprotokoll Notizen
        </Label>
        <Textarea
          placeholder="Zustand der Wohnung, Mängel, Besonderheiten..."
          value={protokollNotizen}
          onChange={(e) => setProtokollNotizen(e.target.value)}
          className="min-h-[100px] resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full sm:w-auto h-12 sm:h-10"
          disabled={isSubmitting}
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleSubmit}
          className="w-full sm:w-auto h-12 sm:h-10"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Speichern...
            </>
          ) : (
            contracts.length > 1 
              ? `${contracts.length} Übergaben abschließen` 
              : "Übergabe abschließen"
          )}
        </Button>
      </div>
    </div>
  );

  const dialogTitle = isEinzug ? "Übergabe (Einzug)" : "Übergabe (Auszug)";
  const DialogIcon = isEinzug ? KeyRound : KeyRound;

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <DialogIcon className={cn("h-5 w-5", isEinzug ? "text-green-600" : "text-orange-600")} />
              {dialogTitle}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DialogIcon className={cn("h-5 w-5", isEinzug ? "text-green-600" : "text-orange-600")} />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
