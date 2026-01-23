import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Info } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KostenpositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  immobilieId: string;
  nebenkostenarten: any[];
  zahlungen: any[];
  editingPosition: any | null;
  onSuccess: () => void;
}

export function KostenpositionModal({
  open,
  onOpenChange,
  immobilieId,
  nebenkostenarten,
  zahlungen,
  editingPosition,
  onSuccess,
}: KostenpositionModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [bezeichnung, setBezeichnung] = useState("");
  const [gesamtbetrag, setGesamtbetrag] = useState("");
  const [zeitraumVon, setZeitraumVon] = useState<Date | undefined>();
  const [zeitraumBis, setZeitraumBis] = useState<Date | undefined>();
  const [nebenkostenartId, setNebenkostenartId] = useState<string>("none");
  const [zahlungId, setZahlungId] = useState<string>("none");
  const [istUmlagefaehig, setIstUmlagefaehig] = useState(true);
  const [quelle, setQuelle] = useState<string>("manuell");

  // Reset form when modal opens/closes or editingPosition changes
  useEffect(() => {
    if (open && editingPosition) {
      setBezeichnung(editingPosition.bezeichnung || "");
      setGesamtbetrag(editingPosition.gesamtbetrag?.toString() || "");
      setZeitraumVon(editingPosition.zeitraum_von ? new Date(editingPosition.zeitraum_von) : undefined);
      setZeitraumBis(editingPosition.zeitraum_bis ? new Date(editingPosition.zeitraum_bis) : undefined);
      setNebenkostenartId(editingPosition.nebenkostenart_id || "none");
      setZahlungId(editingPosition.zahlung_id || "none");
      setIstUmlagefaehig(editingPosition.ist_umlagefaehig ?? true);
      setQuelle(editingPosition.quelle || "manuell");
    } else if (open) {
      // Reset for new position
      setBezeichnung("");
      setGesamtbetrag("");
      setZeitraumVon(undefined);
      setZeitraumBis(undefined);
      setNebenkostenartId("none");
      setZahlungId("none");
      setIstUmlagefaehig(true);
      setQuelle("manuell");
    }
  }, [open, editingPosition]);

  // Auto-fill from selected Zahlung
  const handleZahlungChange = (id: string) => {
    setZahlungId(id);
    if (id !== "none") {
      const zahlung = zahlungen.find(z => z.id === id);
      if (zahlung) {
        setGesamtbetrag(Math.abs(zahlung.betrag).toString());
        setBezeichnung(zahlung.verwendungszweck || zahlung.empfaengername || "");
        setZeitraumVon(new Date(zahlung.buchungsdatum));
        setZeitraumBis(new Date(zahlung.buchungsdatum));
        setQuelle("zahlung");
      }
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!bezeichnung.trim()) {
      toast({
        title: "Bezeichnung erforderlich",
        description: "Bitte geben Sie eine Bezeichnung ein.",
        variant: "destructive",
      });
      return;
    }

    const betrag = parseFloat(gesamtbetrag);
    if (isNaN(betrag) || betrag <= 0) {
      toast({
        title: "Ungültiger Betrag",
        description: "Bitte geben Sie einen gültigen positiven Betrag ein.",
        variant: "destructive",
      });
      return;
    }

    if (!zeitraumVon || !zeitraumBis) {
      toast({
        title: "Zeitraum erforderlich",
        description: "Bitte wählen Sie den Abrechnungszeitraum.",
        variant: "destructive",
      });
      return;
    }

    if (zeitraumBis < zeitraumVon) {
      toast({
        title: "Ungültiger Zeitraum",
        description: "Das Ende-Datum muss nach dem Start-Datum liegen.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        immobilie_id: immobilieId,
        bezeichnung: bezeichnung.trim(),
        gesamtbetrag: betrag,
        zeitraum_von: format(zeitraumVon, 'yyyy-MM-dd'),
        zeitraum_bis: format(zeitraumBis, 'yyyy-MM-dd'),
        nebenkostenart_id: nebenkostenartId === "none" ? null : nebenkostenartId,
        zahlung_id: zahlungId === "none" ? null : zahlungId,
        ist_umlagefaehig: istUmlagefaehig,
        quelle: quelle,
      };

      if (editingPosition?.id) {
        // Update existing
        const { error } = await supabase
          .from('kostenpositionen')
          .update(data)
          .eq('id', editingPosition.id);

        if (error) throw error;

        toast({
          title: "Kostenposition aktualisiert",
          description: "Die Änderungen wurden gespeichert.",
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('kostenpositionen')
          .insert(data);

        if (error) throw error;

        toast({
          title: "Kostenposition erstellt",
          description: `"${bezeichnung}" wurde erfolgreich angelegt.`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving Kostenposition:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Kostenposition konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter zahlungen to show only Nichtmiete
  const availableZahlungen = zahlungen.filter(z => z.kategorie === 'Nichtmiete');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingPosition?.id ? "Kostenposition bearbeiten" : "Neue Kostenposition"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aus Zahlung erstellen */}
          <div className="space-y-2">
            <Label>Aus Zahlung erstellen (optional)</Label>
            <Select value={zahlungId} onValueChange={handleZahlungChange}>
              <SelectTrigger>
                <SelectValue placeholder="Zahlung auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Zahlung verknüpfen</SelectItem>
                {availableZahlungen.map((zahlung) => (
                  <SelectItem key={zahlung.id} value={zahlung.id}>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">
                        {zahlung.empfaengername || 'Unbekannt'}
                      </span>
                      <span className="text-muted-foreground">
                        {Math.abs(zahlung.betrag).toFixed(2)} €
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bezeichnung */}
          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung *</Label>
            <Input
              id="bezeichnung"
              value={bezeichnung}
              onChange={(e) => setBezeichnung(e.target.value)}
              placeholder="z.B. Gebäudeversicherung 2024"
            />
          </div>

          {/* Betrag */}
          <div className="space-y-2">
            <Label htmlFor="betrag">Gesamtbetrag *</Label>
            <div className="relative">
              <Input
                id="betrag"
                type="number"
                step="0.01"
                min="0"
                value={gesamtbetrag}
                onChange={(e) => setGesamtbetrag(e.target.value)}
                placeholder="0.00"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                €
              </span>
            </div>
          </div>

          {/* Zeitraum */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zeitraum von *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !zeitraumVon && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {zeitraumVon ? format(zeitraumVon, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={zeitraumVon}
                    onSelect={setZeitraumVon}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Zeitraum bis *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !zeitraumBis && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {zeitraumBis ? format(zeitraumBis, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={zeitraumBis}
                    onSelect={setZeitraumBis}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Nebenkostenart */}
          <div className="space-y-2">
            <Label>Nebenkostenart</Label>
            <Select value={nebenkostenartId} onValueChange={setNebenkostenartId}>
              <SelectTrigger>
                <SelectValue placeholder="Kostenart auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Zuordnung</SelectItem>
                {nebenkostenarten.map((art) => (
                  <SelectItem key={art.id} value={art.id}>
                    {art.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Umlagefähig Switch */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Label htmlFor="umlagefaehig" className="cursor-pointer">
                Umlagefähig auf Mieter
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px]">
                    <p>
                      Umlagefähige Kosten werden in der Betriebskostenabrechnung 
                      auf die Mieter verteilt. Nicht umlagefähige Kosten 
                      (z.B. Reparaturen, Verwaltungskosten) trägt der Eigentümer.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="umlagefaehig"
              checked={istUmlagefaehig}
              onCheckedChange={setIstUmlagefaehig}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingPosition?.id ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
