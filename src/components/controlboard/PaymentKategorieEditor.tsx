import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentKategorieEditorProps {
  paymentId: string;
  currentKategorie: string | null;
  currentImmobilieId: string | null;
  onUpdate?: () => void;
  compact?: boolean;
}

const KATEGORIEN = [
  { value: "Miete", label: "Miete", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "Nebenkosten", label: "Nebenkosten", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "Nichtmiete", label: "Nichtmiete", color: "bg-gray-100 text-gray-800 border-gray-200" },
  { value: "Mietkaution", label: "Mietkaution", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "Rücklastschrift", label: "Rücklastschrift", color: "bg-red-100 text-red-800 border-red-200" },
  { value: "Ignorieren", label: "Ignorieren", color: "bg-orange-100 text-orange-800 border-orange-200" },
];

export function PaymentKategorieEditor({ 
  paymentId, 
  currentKategorie, 
  currentImmobilieId,
  onUpdate,
  compact = false 
}: PaymentKategorieEditorProps) {
  const [selectedKategorie, setSelectedKategorie] = useState(currentKategorie || "");
  const [selectedImmobilie, setSelectedImmobilie] = useState(currentImmobilieId || "");
  const [showImmobilienSelect, setShowImmobilienSelect] = useState(currentKategorie === "Nebenkosten");
  const queryClient = useQueryClient();

  // Fetch all properties
  const { data: immobilien } = useQuery({
    queryKey: ['immobilien-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('immobilien')
        .select('id, name, adresse')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ kategorie, immobilieId }: { kategorie: string; immobilieId: string | null }) => {
      const { error } = await supabase
        .from('zahlungen')
        .update({ 
          kategorie: kategorie as any,
          immobilie_id: immobilieId,
          // Clear mietvertrag_id if switching to Nebenkosten or Nichtmiete
          mietvertrag_id: ["Nebenkosten", "Nichtmiete", "Ignorieren"].includes(kategorie) ? null : undefined
        })
        .eq('id', paymentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zahlungen-overview'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-payments'] });
      onUpdate?.();
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error("Fehler beim Aktualisieren der Kategorie");
    }
  });

  const handleKategorieChange = (value: string) => {
    setSelectedKategorie(value);
    
    if (value === "Nebenkosten") {
      setShowImmobilienSelect(true);
      // Don't save yet - wait for property selection
    } else {
      setShowImmobilienSelect(false);
      setSelectedImmobilie("");
      // Save immediately for other categories
      updateMutation.mutate({ kategorie: value, immobilieId: null });
      toast.success(`Kategorie auf "${value}" geändert`);
    }
  };

  const handleImmobilieChange = (immobilieId: string) => {
    setSelectedImmobilie(immobilieId);
    // Save with property assignment
    updateMutation.mutate({ kategorie: "Nebenkosten", immobilieId });
    const immobilie = immobilien?.find(i => i.id === immobilieId);
    toast.success(`Als Nebenkosten zu "${immobilie?.name}" zugeordnet`);
  };

  const getKategorieColor = (kat: string) => {
    return KATEGORIEN.find(k => k.value === kat)?.color || "bg-gray-100 text-gray-800";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Select value={selectedKategorie} onValueChange={handleKategorieChange}>
          <SelectTrigger className={cn(
            "h-7 text-xs border px-2 py-0 min-w-[100px]",
            getKategorieColor(selectedKategorie)
          )}>
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            {KATEGORIEN.map((kat) => (
              <SelectItem key={kat.value} value={kat.value}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", kat.color.split(" ")[0])} />
                  {kat.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showImmobilienSelect && (
          <Select value={selectedImmobilie} onValueChange={handleImmobilieChange}>
            <SelectTrigger className="h-7 text-xs min-w-[120px] bg-blue-50 border-blue-200">
              <Building2 className="h-3 w-3 mr-1 text-blue-600" />
              <SelectValue placeholder="Immobilie..." />
            </SelectTrigger>
            <SelectContent className="bg-white z-50">
              {immobilien?.map((immo) => (
                <SelectItem key={immo.id} value={immo.id}>
                  <div className="flex flex-col">
                    <span className="font-medium text-xs">{immo.name}</span>
                    <span className="text-[10px] text-muted-foreground">{immo.adresse}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {updateMutation.isPending && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}

        {currentImmobilieId && selectedKategorie === "Nebenkosten" && !updateMutation.isPending && (
          <Check className="h-3 w-3 text-green-600" />
        )}
      </div>
    );
  }

  // Full-size version
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={selectedKategorie} onValueChange={handleKategorieChange}>
          <SelectTrigger className={cn(
            "w-40 border",
            getKategorieColor(selectedKategorie)
          )}>
            <SelectValue placeholder="Kategorie wählen..." />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            {KATEGORIEN.map((kat) => (
              <SelectItem key={kat.value} value={kat.value}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", kat.color.split(" ")[0])} />
                  {kat.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {updateMutation.isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showImmobilienSelect && (
        <Select value={selectedImmobilie} onValueChange={handleImmobilieChange}>
          <SelectTrigger className="w-full bg-blue-50 border-blue-200">
            <Building2 className="h-4 w-4 mr-2 text-blue-600" />
            <SelectValue placeholder="Immobilie auswählen..." />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            {immobilien?.map((immo) => (
              <SelectItem key={immo.id} value={immo.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{immo.name}</span>
                  <span className="text-xs text-muted-foreground">{immo.adresse}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {currentImmobilieId && selectedKategorie === "Nebenkosten" && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <span>Zugeordnet zu: {immobilien?.find(i => i.id === currentImmobilieId)?.name}</span>
        </div>
      )}
    </div>
  );
}
