import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus,
  Trash2,
  CalendarIcon,
  Loader2,
  Euro,
  FileText,
  CreditCard,
  AlertCircle,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { BETRKV_KATEGORIEN, NICHT_UMLAGEFAEHIGE_KATEGORIEN } from "./nebenkostenKategorien";

const ALL_KATEGORIEN = [...BETRKV_KATEGORIEN, ...NICHT_UMLAGEFAEHIGE_KATEGORIEN];

interface SplitLine {
  id: string; // temp client id
  kategorieId: string;
  betrag: string;
  zeitraumVon: Date | undefined;
  zeitraumBis: Date | undefined;
  bezeichnung: string;
  existingPositionId?: string; // if editing an existing kostenposition
}

interface NebenkostenSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zahlung: any | null;
  immobilieId: string;
  selectedYear: number;
}

export function NebenkostenSplitDialog({
  open,
  onOpenChange,
  zahlung,
  immobilieId,
  selectedYear,
}: NebenkostenSplitDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<SplitLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch nebenkostenarten for this property
  const { data: nebenkostenarten } = useQuery({
    queryKey: ["nebenkostenarten-betrkv", immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nebenkostenarten")
        .select("*")
        .eq("immobilie_id", immobilieId);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing kostenpositionen for this zahlung
  const { data: existingPositionen } = useQuery({
    queryKey: ["kostenpositionen-for-zahlung", zahlung?.id],
    queryFn: async () => {
      if (!zahlung?.id) return [];
      const { data, error } = await supabase
        .from("kostenpositionen")
        .select("*")
        .eq("zahlung_id", zahlung.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!zahlung?.id,
  });

  // Initialize lines from existing positions or empty
  useEffect(() => {
    if (!open || !zahlung) return;

    if (existingPositionen && existingPositionen.length > 0) {
      // Map existing positions to lines
      const existingLines: SplitLine[] = existingPositionen.map((pos) => {
        // Find matching kategorie
        const art = nebenkostenarten?.find((n) => n.id === pos.nebenkostenart_id);
        let kategorieId = "";
        if (art) {
          const found = ALL_KATEGORIEN.find(
            (k) => art.name.toLowerCase().replace(/[^a-zäöü]/g, "") === k.name.toLowerCase().replace(/[^a-zäöü]/g, "")
          );
          if (found) kategorieId = found.id;
        }

        return {
          id: crypto.randomUUID(),
          kategorieId,
          betrag: pos.gesamtbetrag.toString(),
          zeitraumVon: pos.zeitraum_von ? new Date(pos.zeitraum_von) : undefined,
          zeitraumBis: pos.zeitraum_bis ? new Date(pos.zeitraum_bis) : undefined,
          bezeichnung: pos.bezeichnung || "",
          existingPositionId: pos.id,
        };
      });
      setLines(existingLines);
    } else {
      // Start with one empty line
      setLines([createEmptyLine()]);
    }
  }, [open, zahlung?.id, existingPositionen, nebenkostenarten]);

  function createEmptyLine(): SplitLine {
    return {
      id: crypto.randomUUID(),
      kategorieId: "",
      betrag: "",
      zeitraumVon: undefined,
      zeitraumBis: undefined,
      bezeichnung: "",
    };
  }

  const zahlungBetrag = Math.abs(zahlung?.betrag || 0);

  const assignedTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const val = parseFloat(line.betrag);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [lines]);

  const restBetrag = zahlungBetrag - assignedTotal;
  const progressPercent = zahlungBetrag > 0 ? Math.min((assignedTotal / zahlungBetrag) * 100, 100) : 0;
  const isOverBudget = assignedTotal > zahlungBetrag + 0.01; // small epsilon for floating point

  const addLine = () => {
    const newLine = createEmptyLine();
    // Pre-fill rest amount
    if (restBetrag > 0.01) {
      newLine.betrag = restBetrag.toFixed(2);
    }
    setLines((prev) => [...prev, newLine]);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const updateLine = (lineId: string, field: keyof SplitLine, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: value };
        // Auto-fill bezeichnung from kategorie if empty
        if (field === "kategorieId" && !l.bezeichnung) {
          const kat = ALL_KATEGORIEN.find((k) => k.id === value);
          if (kat) updated.bezeichnung = kat.name;
        }
        return updated;
      })
    );
  };

  const canSave = useMemo(() => {
    if (lines.length === 0) return false;
    if (isOverBudget) return false;

    return lines.every((line) => {
      const betrag = parseFloat(line.betrag);
      return (
        line.kategorieId &&
        !isNaN(betrag) &&
        betrag > 0 &&
        line.zeitraumVon &&
        line.zeitraumBis &&
        line.zeitraumBis >= line.zeitraumVon
      );
    });
  }, [lines, isOverBudget]);

  const handleSave = async () => {
    if (!zahlung || !canSave) return;
    setIsSaving(true);

    try {
      // Delete existing positions for this zahlung that are no longer in the lines
      const existingIds = lines
        .map((l) => l.existingPositionId)
        .filter(Boolean);
      
      const toDelete = existingPositionen?.filter(
        (p) => !existingIds.includes(p.id)
      ) || [];

      for (const pos of toDelete) {
        await supabase.from("kostenpositionen").delete().eq("id", pos.id);
      }

      // Upsert each line
      for (const line of lines) {
        const kategorie = ALL_KATEGORIEN.find((k) => k.id === line.kategorieId);
        if (!kategorie) continue;

        // Find or create nebenkostenart
        let nebenkostenartId = nebenkostenarten?.find(
          (n) => n.name.toLowerCase().replace(/[^a-zäöü]/g, "") === kategorie.name.toLowerCase().replace(/[^a-zäöü]/g, "")
        )?.id;

        if (!nebenkostenartId) {
          const { data: newArt, error: artError } = await supabase
            .from("nebenkostenarten")
            .insert({
              immobilie_id: immobilieId,
              name: kategorie.name,
              ist_umlagefaehig: kategorie.umlagefaehig,
              verteilerschluessel_art: kategorie.schluessel,
            })
            .select()
            .single();

          if (artError) throw artError;
          nebenkostenartId = newArt.id;
        }

        const positionData = {
          immobilie_id: immobilieId,
          zahlung_id: zahlung.id,
          nebenkostenart_id: nebenkostenartId,
          gesamtbetrag: parseFloat(line.betrag),
          zeitraum_von: format(line.zeitraumVon!, "yyyy-MM-dd"),
          zeitraum_bis: format(line.zeitraumBis!, "yyyy-MM-dd"),
          bezeichnung: line.bezeichnung || kategorie.name,
          ist_umlagefaehig: kategorie.umlagefaehig,
          quelle: "zahlung",
        };

        if (line.existingPositionId) {
          const { error } = await supabase
            .from("kostenpositionen")
            .update(positionData)
            .eq("id", line.existingPositionId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("kostenpositionen")
            .insert(positionData);
          if (error) throw error;
        }
      }

      toast({
        title: "✓ Gespeichert",
        description: `${lines.length} Kostenposition${lines.length > 1 ? "en" : ""} für diese Zahlung angelegt.`,
      });

      queryClient.invalidateQueries({ queryKey: ["kostenpositionen-betrkv", immobilieId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["kostenpositionen-for-zahlung", zahlung.id] });
      queryClient.invalidateQueries({ queryKey: ["nebenkostenarten-betrkv", immobilieId] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!zahlung) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            Zahlung aufteilen
          </DialogTitle>
        </DialogHeader>

        {/* Zahlungsinfo */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-base">
              {zahlung.empfaengername || "Unbekannter Empfänger"}
            </p>
            <Badge variant="outline" className="text-base font-bold px-3 py-1">
              {zahlungBetrag.toFixed(2)} €
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(new Date(zahlung.buchungsdatum), "dd. MMMM yyyy", { locale: de })}
            </span>
            {zahlung.iban && (
              <span className="flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                {zahlung.iban}
              </span>
            )}
          </div>
          {zahlung.verwendungszweck && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {zahlung.verwendungszweck}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verteilt</span>
            <div className="flex items-center gap-3">
              <span className={cn("font-bold", isOverBudget ? "text-destructive" : "text-foreground")}>
                {assignedTotal.toFixed(2)} €
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{zahlungBetrag.toFixed(2)} €</span>
              {restBetrag > 0.01 && !isOverBudget && (
                <Badge variant="secondary" className="text-xs">
                  Rest: {restBetrag.toFixed(2)} €
                </Badge>
              )}
            </div>
          </div>
          <Progress
            value={progressPercent}
            className={cn("h-2", isOverBudget && "[&>div]:bg-destructive")}
          />
          {isOverBudget && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Summe übersteigt den Zahlungsbetrag – bitte korrigieren.
            </p>
          )}
        </div>

        {/* Split lines */}
        <ScrollArea className="flex-1 max-h-[400px]">
          <div className="space-y-4 pr-2">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="rounded-lg border p-4 space-y-3 bg-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Position {index + 1}
                  </span>
                  {lines.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Row 1: Kategorie + Betrag */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Nebenkostenart</Label>
                    <Select
                      value={line.kategorieId}
                      onValueChange={(v) => updateLine(line.id, "kategorieId", v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Kategorie wählen..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          Umlagefähig
                        </div>
                        {BETRKV_KATEGORIEN.map((kat) => {
                          const Icon = kat.icon;
                          return (
                            <SelectItem key={kat.id} value={kat.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-green-600" />
                                {kat.name}
                              </div>
                            </SelectItem>
                          );
                        })}
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1">
                          Nicht umlagefähig
                        </div>
                        {NICHT_UMLAGEFAEHIGE_KATEGORIEN.map((kat) => {
                          const Icon = kat.icon;
                          return (
                            <SelectItem key={kat.id} value={kat.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-amber-600" />
                                {kat.name}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Betrag</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.betrag}
                        onChange={(e) => updateLine(line.id, "betrag", e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-sm pr-7"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        €
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Bezeichnung */}
                <div className="space-y-1">
                  <Label className="text-xs">Bezeichnung</Label>
                  <Input
                    value={line.bezeichnung}
                    onChange={(e) => updateLine(line.id, "bezeichnung", e.target.value)}
                    placeholder="z.B. Gebäudeversicherung 2024"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Row 3: Zeitraum */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Von</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-9 justify-start text-left text-sm font-normal",
                            !line.zeitraumVon && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {line.zeitraumVon
                            ? format(line.zeitraumVon, "dd.MM.yyyy", { locale: de })
                            : "Datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={line.zeitraumVon}
                          onSelect={(d) => updateLine(line.id, "zeitraumVon", d)}
                          initialFocus
                          locale={de}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bis</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-9 justify-start text-left text-sm font-normal",
                            !line.zeitraumBis && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {line.zeitraumBis
                            ? format(line.zeitraumBis, "dd.MM.yyyy", { locale: de })
                            : "Datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={line.zeitraumBis}
                          onSelect={(d) => updateLine(line.id, "zeitraumBis", d)}
                          initialFocus
                          locale={de}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add line button */}
        <Button
          variant="outline"
          onClick={addLine}
          className="w-full gap-2 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Weitere Position hinzufügen
          {restBetrag > 0.01 && !isOverBudget && (
            <span className="text-muted-foreground text-xs ml-1">
              (Rest: {restBetrag.toFixed(2)} €)
            </span>
          )}
        </Button>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {lines.length > 1
              ? `${lines.length} Positionen speichern`
              : "Position speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
