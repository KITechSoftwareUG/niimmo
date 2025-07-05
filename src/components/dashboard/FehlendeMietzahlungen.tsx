
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFehlendeMietzahlungen } from "@/hooks/useFehlendeMietzahlungen";
import { FehlendeMietzahlungenHeader } from "./FehlendeMietzahlungenHeader";
import { FehlendeMietzahlungItem } from "./FehlendeMietzahlungItem";

export const FehlendeMietzahlungen = () => {
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
                  <FehlendeMietzahlungItem key={item.mietvertrag_id} item={item} />
                ))}
              </div>
              
              <div className="pt-3 border-t border-red-200">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Gesamt fehlend:</span>
                  <span className="text-lg font-bold text-red-600">
                    €{gesamtFehlend.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">✓ Alle Mietzahlungen sind vollständig</p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
