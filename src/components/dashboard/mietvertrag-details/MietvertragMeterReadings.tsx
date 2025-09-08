import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Gauge, Droplet, Thermometer, Zap, Flame } from "lucide-react";
import { useState } from "react";
import { MietvertragEditableField } from "./MietvertragEditableField";

interface MietvertragMeterReadingsProps {
  vertrag: any;
  einheit?: any;
  editingMeter: string | null;
  onEditMeter: (field: string, value: string) => void;
  onStartEditMeter: (field: string) => void;
  onCancelEditMeter: () => void;
}

export function MietvertragMeterReadings({
  vertrag,
  einheit,
  editingMeter,
  onEditMeter,
  onStartEditMeter,
  onCancelEditMeter
}: MietvertragMeterReadingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatMeterValue = (value: number | null) => {
    return value ? value.toString() : "0";
  };

  const meterReadings = [
    {
      key: "kaltwasser",
      icon: Droplet,
      color: "text-blue-500",
      label: "Kaltwasser",
      number: einheit?.kaltwasser_zaehler,
      einzug: vertrag.kaltwasser_einzug,
      auszug: vertrag.kaltwasser_auszug
    },
    {
      key: "warmwasser", 
      icon: Thermometer,
      color: "text-orange-500",
      label: "Warmwasser",
      number: einheit?.warmwasser_zaehler,
      einzug: vertrag.warmwasser_einzug,
      auszug: vertrag.warmwasser_auszug
    },
    {
      key: "strom",
      icon: Zap,
      color: "text-yellow-500", 
      label: "Strom",
      number: einheit?.strom_zaehler,
      einzug: vertrag.strom_einzug,
      auszug: vertrag.strom_auszug
    },
    {
      key: "gas",
      icon: Flame,
      color: "text-red-500",
      label: "Gas",
      number: einheit?.gas_zaehler,
      einzug: vertrag.gas_einzug,
      auszug: vertrag.gas_auszug
    }
  ];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center space-x-2">
                <Gauge className="h-5 w-5 text-primary" />
                <CardTitle>Zählerstände</CardTitle>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {meterReadings.map((meter) => {
              const IconComponent = meter.icon;
              return (
                <div key={meter.key} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <IconComponent className={`h-4 w-4 ${meter.color}`} />
                    <span className="font-medium">{meter.label}</span>
                    {meter.number && (
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        Nr: {meter.number}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <MietvertragEditableField
                      label="Bei Einzug"
                      value={Number(meter.einzug || 0)}
                      isEditing={editingMeter === `${meter.key}_einzug`}
                      onEdit={() => onStartEditMeter(`${meter.key}_einzug`)}
                      onSave={(value) => onEditMeter(`${meter.key}_einzug`, value)}
                      onCancel={onCancelEditMeter}
                      type="number"
                      step="0.01"
                      formatter={formatMeterValue}
                    />
                    
                    <MietvertragEditableField
                      label="Bei Auszug"
                      value={Number(meter.auszug || 0)}
                      isEditing={editingMeter === `${meter.key}_auszug`}
                      onEdit={() => onStartEditMeter(`${meter.key}_auszug`)}
                      onSave={(value) => onEditMeter(`${meter.key}_auszug`, value)}
                      onCancel={onCancelEditMeter}
                      type="number"
                      step="0.01"
                      formatter={formatMeterValue}
                    />
                  </div>
                  
                  {meter.einzug && meter.auszug && Number(meter.auszug) > Number(meter.einzug) && (
                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                      Verbrauch: {(Number(meter.auszug) - Number(meter.einzug)).toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}