import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, KeyRound, ClipboardCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface UebergabeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: {
    id: string;
    nummer?: string;
    etage?: string;
  };
  immobilie?: {
    name: string;
    adresse: string;
  };
  mieterName?: string;
  kuendigungsdatum?: string;
  onSuccess?: () => void;
}

export const UebergabeDialog = ({
  isOpen,
  onClose,
  vertragId,
  einheit,
  immobilie,
  mieterName,
  kuendigungsdatum,
  onSuccess,
}: UebergabeDialogProps) => {
  const [uebergabeDatum, setUebergabeDatum] = useState<Date | undefined>(
    kuendigungsdatum ? new Date(kuendigungsdatum) : undefined
  );
  const [schluesselAnzahl, setSchluesselAnzahl] = useState<string>("");
  const [zaehlerstaende, setZaehlerstaende] = useState({
    strom: "",
    gas: "",
    wasser: "",
    warmwasser: "",
  });
  const [protokollNotizen, setProtokollNotizen] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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
      // Update the contract with move-out meter readings
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
        .eq("id", vertragId);

      if (updateError) throw updateError;

      toast({
        title: "Übergabe erfolgreich",
        description: "Die Wohnungsübergabe wurde dokumentiert.",
      });

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
      {/* Property and Unit Info */}
      <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
        <p className="text-sm font-medium">{immobilie?.name}</p>
        <p className="text-xs text-muted-foreground">{immobilie?.adresse}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Einheit {einheit?.nummer || einheit?.id?.slice(0, 8)}
          {einheit?.etage && ` (${einheit.etage})`}
        </p>
        {mieterName && (
          <p className="text-xs mt-1">
            <span className="text-muted-foreground">Mieter:</span>{" "}
            <span className="font-medium">{mieterName}</span>
          </p>
        )}
      </div>

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

      {/* Zählerstände */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Zählerstände bei Auszug</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Strom (kWh)</Label>
            <Input
              type="number"
              placeholder="0"
              value={zaehlerstaende.strom}
              onChange={(e) =>
                setZaehlerstaende((prev) => ({ ...prev, strom: e.target.value }))
              }
              className="h-12 sm:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Gas (m³)</Label>
            <Input
              type="number"
              placeholder="0"
              value={zaehlerstaende.gas}
              onChange={(e) =>
                setZaehlerstaende((prev) => ({ ...prev, gas: e.target.value }))
              }
              className="h-12 sm:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Kaltwasser (m³)</Label>
            <Input
              type="number"
              placeholder="0"
              value={zaehlerstaende.wasser}
              onChange={(e) =>
                setZaehlerstaende((prev) => ({ ...prev, wasser: e.target.value }))
              }
              className="h-12 sm:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Warmwasser (m³)</Label>
            <Input
              type="number"
              placeholder="0"
              value={zaehlerstaende.warmwasser}
              onChange={(e) =>
                setZaehlerstaende((prev) => ({ ...prev, warmwasser: e.target.value }))
              }
              className="h-12 sm:h-10"
            />
          </div>
        </div>
      </div>

      {/* Protokollnotizen */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
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
            "Übergabe abschließen"
          )}
        </Button>
      </div>
    </div>
  );

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" />
              Übergabe (Auszug)
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
            <KeyRound className="h-5 w-5 text-primary" />
            Übergabe (Auszug)
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
