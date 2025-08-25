
import { useState } from "react";
import { Euro, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FehlendeMietzahlung } from "@/hooks/useFehlendeMietzahlungen";
import { MahnstufeIndicator } from "./MahnstufeIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FehlendeMietzahlungItemProps {
  item: FehlendeMietzahlung;
  onMietvertragClick?: (mietvertragId: string) => void;
}

export const FehlendeMietzahlungItem = ({ item, onMietvertragClick }: FehlendeMietzahlungItemProps) => {
  const [isSendingMahnung, setIsSendingMahnung] = useState(false);
  const { toast } = useToast();

  const handleClick = () => {
    if (onMietvertragClick && item.mietvertrag_id) {
      onMietvertragClick(item.mietvertrag_id);
    }
  };

  const handleSendMahnung = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindert das Triggern des Mietvertrag-Clicks
    
    setIsSendingMahnung(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mahnung', {
        body: {
          mietvertragId: item.mietvertrag_id,
          mahnstufe: item.mahnstufe,
          vertragData: item.mietvertrag,
          forderungen: [] // Wird in der Edge Function basierend auf dem Mietvertrag geladen
        }
      });

      if (error) throw error;

      toast({
        title: "Mahnung versendet",
        description: `Mahnung Stufe ${item.mahnstufe} wurde erfolgreich versendet.`,
      });
    } catch (error) {
      console.error('Fehler beim Versenden der Mahnung:', error);
      toast({
        title: "Fehler",
        description: "Mahnung konnte nicht versendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsSendingMahnung(false);
    }
  };

  return (
    <div 
      className="p-4 bg-white/60 rounded-lg border border-red-100 cursor-pointer hover:bg-white/80 transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="font-medium text-gray-800 text-lg">{item.mieter_name}</p>
          <p className="text-sm text-gray-600 mb-1">{item.immobilie_name}</p>
          <p className="text-xs text-gray-500">{item.immobilie_adresse}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-red-600 font-bold text-lg mb-1">
            <Euro className="h-4 w-4" />
            {item.fehlend_betrag.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500">Status: {item.mietvertrag_status}</p>
        </div>
      </div>

      {/* Mahnstufe und Button */}
      {item.mahnstufe > 0 && (
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 mb-3">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Mahnstufe {item.mahnstufe}</span>
            <MahnstufeIndicator stufe={item.mahnstufe} />
          </div>
          <Button
            onClick={handleSendMahnung}
            disabled={isSendingMahnung}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Send className="h-3 w-3 mr-1" />
            {isSendingMahnung ? 'Sende...' : 'Mahnung verschicken'}
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t pt-3">
        <div>
          <p className="text-gray-500">Einheit</p>
          <p className="font-medium">{item.einheit_typ}</p>
          <p className="text-xs text-gray-400">Etage {item.einheit_etage}, {item.einheit_qm}m²</p>
        </div>
        
        <div>
          <p className="text-gray-500">Kaltmiete</p>
          <p className="font-medium">€{item.kaltmiete.toLocaleString()}</p>
          <p className="text-xs text-gray-400">+ €{item.betriebskosten.toLocaleString()} NK</p>
        </div>
        
        <div>
          <p className="text-gray-500">Forderungen</p>
          <p className="font-medium text-orange-600">€{item.gesamt_forderungen.toLocaleString()}</p>
        </div>
        
        <div>
          <p className="text-gray-500">Zahlungen</p>
          <p className="font-medium text-green-600">€{item.gesamt_zahlungen.toLocaleString()}</p>
        </div>
      </div>

      {item.alle_mieter && item.alle_mieter.length > 1 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-500 mb-1">Alle Mieter:</p>
          <div className="text-sm">
            {item.alle_mieter.map((mieter, index) => (
              <span key={mieter.mieter_id} className="text-gray-600">
                {mieter.mieter?.vorname} {mieter.mieter?.nachname} ({mieter.rolle})
                {index < item.alle_mieter!.length - 1 && ', '}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
