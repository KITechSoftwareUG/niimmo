import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Euro, Calendar } from "lucide-react";

interface CreateForderungModalProps {
  isOpen: boolean;
  onClose: () => void;
  mietvertragId: string;
  currentKaltmiete?: number;
  currentBetriebskosten?: number;
}

export const CreateForderungModal = ({
  isOpen,
  onClose,
  mietvertragId,
  currentKaltmiete = 0,
  currentBetriebskosten = 0
}: CreateForderungModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [sollmonat, setSollmonat] = useState("");
  const [sollbetrag, setSollbetrag] = useState("");

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const totalRent = currentKaltmiete + currentBetriebskosten;

  const months = [
    { value: "01", label: "Januar" },
    { value: "02", label: "Februar" },
    { value: "03", label: "März" },
    { value: "04", label: "April" },
    { value: "05", label: "Mai" },
    { value: "06", label: "Juni" },
    { value: "07", label: "Juli" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Dezember" }
  ];

  const years = [currentYear - 1, currentYear, nextYear];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sollmonat || !sollbetrag) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive",
      });
      return;
    }

    const betrag = parseFloat(sollbetrag);
    if (isNaN(betrag) || betrag <= 0) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen gültigen Betrag ein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('mietforderungen')
        .insert({
          mietvertrag_id: mietvertragId,
          sollmonat: sollmonat,
          sollbetrag: betrag
        });

      if (error) throw error;

      toast({
        title: "Erfolgreich erstellt",
        description: `Forderung für ${sollmonat} über ${betrag.toLocaleString()}€ wurde erstellt.`,
      });

      // Reset form
      setSollmonat("");
      setSollbetrag("");
      onClose();

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['mietforderungen', mietvertragId] });

    } catch (error) {
      console.error('Error creating forderung:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCurrentRent = () => {
    setSollbetrag(totalRent.toString());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <span>Neue Forderung erstellen</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sollmonat" className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Monat</span>
              </Label>
              <Select value={sollmonat} onValueChange={setSollmonat}>
                <SelectTrigger>
                  <SelectValue placeholder="Monat wählen" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => 
                    months.map(month => {
                      const monthValue = `${year}-${month.value}`;
                      return (
                        <SelectItem key={monthValue} value={monthValue}>
                          {month.label} {year}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sollbetrag" className="flex items-center space-x-2">
                <Euro className="h-4 w-4" />
                <span>Betrag</span>
              </Label>
              <div className="space-y-2">
                <Input
                  id="sollbetrag"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sollbetrag}
                  onChange={(e) => setSollbetrag(e.target.value)}
                  placeholder="Betrag eingeben"
                  className="text-right"
                />
                {totalRent > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseCurrentRent}
                    className="w-full text-xs"
                  >
                    Aktuelle Miete verwenden ({totalRent.toLocaleString()}€)
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Erstelle..." : "Forderung erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};