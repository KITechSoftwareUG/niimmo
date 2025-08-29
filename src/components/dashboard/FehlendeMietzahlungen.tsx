
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFehlendeMietzahlungen } from "@/hooks/useFehlendeMietzahlungen";
import { FehlendeMietzahlungenHeader } from "./FehlendeMietzahlungenHeader";
import { FehlendeMietzahlungItem } from "./FehlendeMietzahlungItem";

interface FehlendeMietzahlungenProps {
  onMietvertragClick?: (mietvertragId: string) => void;
}

export const FehlendeMietzahlungen = ({ onMietvertragClick }: FehlendeMietzahlungenProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: fehlendeMietzahlungen } = useFehlendeMietzahlungen();

  const gesamtFehlend = fehlendeMietzahlungen?.reduce((sum, item) => sum + item.fehlend_betrag, 0) || 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="glass-card p-6 rounded-2xl border border-red-100 bg-red-50/30">
        <CollapsibleTrigger className="w-full">
        <FehlendeMietzahlungenHeader 
          gesamtFehlend={gesamtFehlend}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
        />
        </CollapsibleTrigger>

        <CollapsibleContent>
          {fehlendeMietzahlungen && fehlendeMietzahlungen.length > 0 ? (
            <>
              <div className="space-y-4 mb-4">
                {fehlendeMietzahlungen.map((item) => (
                  <FehlendeMietzahlungItem key={item.mietvertrag_id} item={item} onMietvertragClick={onMietvertragClick} />
                ))}
              </div>
              
                <div className="pt-4 border-t border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Gesamtrückstand: <span className="text-red-600 font-bold">€{gesamtFehlend.toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 inline-block">
                <p className="text-green-700 font-medium text-lg">✓ Alle Rückstände sind beglichen</p>
                <p className="text-green-600 text-sm mt-1">Keine offenen Forderungen gefunden</p>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
