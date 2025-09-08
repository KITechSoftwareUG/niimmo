import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Calendar, Gauge, Droplet, Zap, Flame, Thermometer, Edit2, Save, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MietvertragInfoProps {
  vertrag: any;
  einheit: any;
  immobilie: any;
}

export const MietvertragInfo = ({ vertrag, einheit, immobilie }: MietvertragInfoProps) => {
  const [isZaehlerstaendeExpanded, setIsZaehlerstaendeExpanded] = useState(false);
  const [isEditingReadings, setIsEditingReadings] = useState(false);
  const [editedReadings, setEditedReadings] = useState({
    kaltwasser_einzug: vertrag?.kaltwasser_einzug || '',
    warmwasser_einzug: vertrag?.warmwasser_einzug || '',
    strom_einzug: vertrag?.strom_einzug || '',
    gas_einzug: vertrag?.gas_einzug || '',
    kaltwasser_auszug: vertrag?.kaltwasser_auszug || '',
    warmwasser_auszug: vertrag?.warmwasser_auszug || '',
    strom_auszug: vertrag?.strom_auszug || '',
    gas_auszug: vertrag?.gas_auszug || ''
  });
  const { toast } = useToast();

  const handleSaveReadings = async () => {
    try {
      const { error } = await supabase
        .from('mietvertrag')
        .update(editedReadings)
        .eq('id', vertrag.id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Zählerstände wurden aktualisiert.",
      });
      setIsEditingReadings(false);
    } catch (error) {
      console.error('Error updating readings:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Zählerstände.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditedReadings({
      kaltwasser_einzug: vertrag?.kaltwasser_einzug || '',
      warmwasser_einzug: vertrag?.warmwasser_einzug || '',
      strom_einzug: vertrag?.strom_einzug || '',
      gas_einzug: vertrag?.gas_einzug || '',
      kaltwasser_auszug: vertrag?.kaltwasser_auszug || '',
      warmwasser_auszug: vertrag?.warmwasser_auszug || '',
      strom_auszug: vertrag?.strom_auszug || '',
      gas_auszug: vertrag?.gas_auszug || ''
    });
    setIsEditingReadings(false);
  };

  return (
    <div className="space-y-6">
      {/* Zählernummern Section */}
      <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Gauge className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xl font-semibold text-gray-800">Zählernummern</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {einheit?.kaltwasser_zaehler && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Droplet className="h-5 w-5 text-blue-600" />
                  <label className="text-sm font-semibold text-blue-700">Kaltwasser</label>
                </div>
                <p className="text-lg font-mono text-blue-900 bg-white px-3 py-2 rounded-lg">
                  {einheit.kaltwasser_zaehler}
                </p>
              </div>
            )}
            {einheit?.warmwasser_zaehler && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Thermometer className="h-5 w-5 text-orange-600" />
                  <label className="text-sm font-semibold text-orange-700">Warmwasser</label>
                </div>
                <p className="text-lg font-mono text-orange-900 bg-white px-3 py-2 rounded-lg">
                  {einheit.warmwasser_zaehler}
                </p>
              </div>
            )}
            {einheit?.strom_zaehler && (
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <label className="text-sm font-semibold text-yellow-700">Strom</label>
                </div>
                <p className="text-lg font-mono text-yellow-900 bg-white px-3 py-2 rounded-lg">
                  {einheit.strom_zaehler}
                </p>
              </div>
            )}
            {einheit?.gas_zaehler && (
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Flame className="h-5 w-5 text-red-600" />
                  <label className="text-sm font-semibold text-red-700">Gas</label>
                </div>
                <p className="text-lg font-mono text-red-900 bg-white px-3 py-2 rounded-lg">
                  {einheit.gas_zaehler}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zählerstände Section */}
      <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Gauge className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-xl font-semibold text-gray-800">Zählerstände</span>
            </div>
            <div className="flex items-center space-x-2">
              {!isEditingReadings ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingReadings(true)}
                  className="text-amber-600 hover:text-amber-700"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveReadings}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          <Collapsible open={isZaehlerstaendeExpanded} onOpenChange={setIsZaehlerstaendeExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full mb-4 hover:bg-amber-100/50 rounded-lg p-2 transition-colors">
              <span className="text-sm text-gray-600">
                Hier werden die Zählerstände bei Ein- und Auszug dokumentiert.
              </span>
              <ChevronDown className={`h-4 w-4 text-amber-600 transition-transform ${isZaehlerstaendeExpanded ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-6">
              {/* Einzug */}
              <div>
                <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Bei Einzug</span>
                  {vertrag?.start_datum && (
                    <span className="text-xs text-gray-500 font-normal">
                      ({new Date(vertrag.start_datum).toLocaleDateString('de-DE')})
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Kaltwasser Einzug */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Droplet className="h-4 w-4 text-blue-600" />
                      <label className="text-sm font-medium text-blue-700">Kaltwasser</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.kaltwasser_einzug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, kaltwasser_einzug: e.target.value }))}
                        className="bg-white border-blue-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.kaltwasser_einzug || 'Nicht erfasst'}
                      </p>
                    )}
                  </div>

                  {/* Warmwasser Einzug */}
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Thermometer className="h-4 w-4 text-orange-600" />
                      <label className="text-sm font-medium text-orange-700">Warmwasser</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.warmwasser_einzug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, warmwasser_einzug: e.target.value }))}
                        className="bg-white border-orange-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.warmwasser_einzug || 'Nicht erfasst'}
                      </p>
                    )}
                  </div>

                  {/* Strom Einzug */}
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      <label className="text-sm font-medium text-yellow-700">Strom</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.strom_einzug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, strom_einzug: e.target.value }))}
                        className="bg-white border-yellow-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.strom_einzug || 'Nicht erfasst'}
                      </p>
                    )}
                  </div>

                  {/* Gas Einzug */}
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Flame className="h-4 w-4 text-red-600" />
                      <label className="text-sm font-medium text-red-700">Gas</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.gas_einzug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, gas_einzug: e.target.value }))}
                        className="bg-white border-red-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.gas_einzug || 'Nicht erfasst'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Auszug */}
              <div>
                <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Bei Auszug</span>
                  {vertrag?.ende_datum && (
                    <span className="text-xs text-gray-500 font-normal">
                      ({new Date(vertrag.ende_datum).toLocaleDateString('de-DE')})
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Kaltwasser Auszug */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Droplet className="h-4 w-4 text-blue-600" />
                      <label className="text-sm font-medium text-blue-700">Kaltwasser</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.kaltwasser_auszug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, kaltwasser_auszug: e.target.value }))}
                        className="bg-white border-blue-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.kaltwasser_auszug || 'Noch nicht erfasst'}
                      </p>
                    )}
                  </div>

                  {/* Warmwasser Auszug */}
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Thermometer className="h-4 w-4 text-orange-600" />
                      <label className="text-sm font-medium text-orange-700">Warmwasser</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.warmwasser_auszug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, warmwasser_auszug: e.target.value }))}
                        className="bg-white border-orange-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.warmwasser_auszug || 'Noch nicht erfasst'}
                      </p>
                    )}
                  </div>

                  {/* Strom Auszug */}
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      <label className="text-sm font-medium text-yellow-700">Strom</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.strom_auszug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, strom_auszug: e.target.value }))}
                        className="bg-white border-yellow-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.strom_auszug || 'Noch nicht erfasst'}
                      </p>
                    )}
                  </div>

                  {/* Gas Auszug */}
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Flame className="h-4 w-4 text-red-600" />
                      <label className="text-sm font-medium text-red-700">Gas</label>
                    </div>
                    {isEditingReadings ? (
                      <Input
                        type="text"
                        value={editedReadings.gas_auszug}
                        onChange={(e) => setEditedReadings(prev => ({ ...prev, gas_auszug: e.target.value }))}
                        className="bg-white border-red-300"
                        placeholder="Zählerstand eingeben"
                      />
                    ) : (
                      <p className="text-sm bg-white px-2 py-1 rounded border">
                        {vertrag?.gas_auszug || 'Noch nicht erfasst'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
};
