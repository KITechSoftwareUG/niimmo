import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Edit2, 
  Check, 
  X, 
  Trash2, 
  Calendar, 
  ArrowRightLeft, 
  AlertCircle,
  Mail,
  Phone,
  Split,
  Undo2,
  Eye,
  EyeOff
} from "lucide-react";
import { PaymentSplitModal } from "../PaymentSplitModal";
import { PaymentUndoSplitModal } from "../PaymentUndoSplitModal";

interface MietvertragTimelineViewProps {
  forderungen: any[];
  zahlungen: any[];
  allMietvertraege?: any[];
  vertragId: string;
  vertrag?: any;
  formatDatum: (datum: string) => string;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragTimelineView({
  forderungen,
  zahlungen,
  allMietvertraege,
  vertragId,
  vertrag,
  formatDatum,
  formatBetrag
}: MietvertragTimelineViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingPayment, setEditingPayment] = useState<{ zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag' | 'gebuehr' } | null>(null);
  const [editPaymentValue, setEditPaymentValue] = useState<string>("");
  const [mietvertragSearchTerm, setMietvertragSearchTerm] = useState<string>("");
  const [editingForderung, setEditingForderung] = useState<{ forderungId: string, field: 'betrag' | 'monat' } | null>(null);
  const [editForderungValue, setEditForderungValue] = useState<string>("");
  const [draggedPayment, setDraggedPayment] = useState<string | null>(null);
  const [splittingPayment, setSplittingPayment] = useState<any | null>(null);
  const [undoingSplitPayments, setUndoingSplitPayments] = useState<any[] | null>(null);
  const [showIgnoredPayments, setShowIgnoredPayments] = useState(false);

  // Drag and drop handlers
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, zahlungId: string) => {
    setDraggedPayment(zahlungId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', zahlungId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, targetMonth: string) => {
    event.preventDefault();
    const zahlungId = event.dataTransfer.getData('text/plain');

    if (!zahlungId || !targetMonth) return;

    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ zugeordneter_monat: targetMonth })
        .eq('id', zahlungId);

      if (error) throw error;

      toast({
        title: "Zahlung verschoben",
        description: `Zahlung wurde zu ${new Date(targetMonth + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} verschoben.`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);

    } catch (error) {
      console.error('Error moving payment:', error);
      toast({
        title: "Fehler",
        description: "Zahlung konnte nicht verschoben werden.",
        variant: "destructive",
      });
    }

    setDraggedPayment(null);
  };

  const handleDragEnd = () => {
    setDraggedPayment(null);
  };

  const handleDeleteForderung = async (forderungId: string) => {
    try {
      const { error } = await supabase
        .from('mietforderungen')
        .delete()
        .eq('id', forderungId);

      if (error) throw error;

      toast({
        title: "Gelöscht",
        description: "Forderung wurde erfolgreich gelöscht.",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
      ]);

    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleEditForderung = (forderungId: string, field: 'betrag' | 'monat', currentValue: string) => {
    setEditingForderung({ forderungId, field });
    setEditForderungValue(currentValue);
  };

  const handleSaveForderung = async (newValue: string) => {
    if (!editingForderung) return;

    try {
      const updateData: any = {};
      if (editingForderung.field === 'betrag') {
        updateData.sollbetrag = parseFloat(newValue) || 0;
      }

      const { error } = await supabase
        .from('mietforderungen')
        .update(updateData)
        .eq('id', editingForderung.forderungId);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Forderung wurde erfolgreich aktualisiert.",
        duration: 3000,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
      ]);

      setEditingForderung(null);
      setEditForderungValue("");
    } catch (error) {
      console.error('Error updating forderung:', error);
      toast({
        title: "Fehler",
        description: "Forderung konnte nicht aktualisiert werden.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleCancelForderungEdit = () => {
    setEditingForderung(null);
    setEditForderungValue("");
  };

  const handleEditPaymentField = (zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag' | 'gebuehr', currentValue: string) => {
    const zahlung = zahlungen?.find(z => z.id === zahlungId);

    setEditingPayment({ zahlungId, field });
    if (field === 'mietvertrag') {
      setEditPaymentValue(zahlung?.mietvertrag_id || '');
    } else if (field === 'monat') {
      const monthValue = zahlung?.zugeordneter_monat || zahlung?.buchungsdatum?.slice(0, 7) || '';
      setEditPaymentValue(monthValue);
    } else if (field === 'gebuehr') {
      setEditPaymentValue(zahlung?.ruecklastschrift_gebuehr?.toString() || '0');
    } else {
      setEditPaymentValue(currentValue || '');
    }
  };

  const handleSavePaymentField = async (customValue?: string) => {
    if (!editingPayment) return;

    const valueToSave = customValue !== undefined ? customValue : editPaymentValue;

    try {
      let updateData: any = {};

      if (editingPayment.field === 'kategorie') {
        updateData.kategorie = valueToSave as any;
      } else if (editingPayment.field === 'monat') {
        updateData.zugeordneter_monat = valueToSave;
      } else if (editingPayment.field === 'mietvertrag') {
        updateData.mietvertrag_id = valueToSave;
      } else if (editingPayment.field === 'gebuehr') {
        updateData.ruecklastschrift_gebuehr = parseFloat(valueToSave) || 0;
      }

      const { error } = await supabase
        .from('zahlungen')
        .update(updateData)
        .eq('id', editingPayment.zahlungId);

      if (error) throw error;

      toast({
        title: "Aktualisiert",
        description: `${editingPayment.field === 'kategorie' ? 'Kategorie' :
          editingPayment.field === 'monat' ? 'Zugeordneter Monat' :
          editingPayment.field === 'gebuehr' ? 'Gebühr' :
            'Mietvertrag'} wurde erfolgreich aktualisiert.`,
      });

      setEditingPayment(null);
      setEditPaymentValue('');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietvertrag-details', vertragId] }),
        queryClient.invalidateQueries({ queryKey: ['mietforderungen', vertragId] }),
      ]);

    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: "Fehler",
        description: `${editingPayment.field === 'kategorie' ? 'Kategorie' :
          editingPayment.field === 'monat' ? 'Zugeordneter Monat' :
          editingPayment.field === 'gebuehr' ? 'Gebühr' :
            'Mietvertrag'} konnte nicht aktualisiert werden.`,
        variant: "destructive",
      });
    }
  };

  const handleCancelPaymentEdit = () => {
    setEditingPayment(null);
    setEditPaymentValue('');
    setMietvertragSearchTerm('');
  };

  // Helper function to check if payment is from a split
  const isSplitPayment = (zahlung: any) => {
    const verwendungszweck = zahlung.verwendungszweck || '';
    return verwendungszweck.includes('SPLIT_GROUP_');
  };

  // Helper function to get split group payments
  const getSplitGroupPayments = (zahlung: any) => {
    if (!isSplitPayment(zahlung)) return [];
    
    const verwendungszweck = zahlung.verwendungszweck || '';
    const splitMatch = verwendungszweck.match(/SPLIT_GROUP_(\d+)_/);
    if (!splitMatch) return [];
    
    const splitTimestamp = splitMatch[1];
    return zahlungen.filter(z => {
      const zVerwendungszweck = z.verwendungszweck || '';
      return zVerwendungszweck.includes(`SPLIT_GROUP_${splitTimestamp}_`);
    });
  };

  // Helper function to check if lastschrift payment should be shown as "open"
  const isLastschriftPendingPayment = (zahlung: any) => {
    if (!vertrag?.lastschrift) return false;
    
    const buchungsdatum = new Date(zahlung.buchungsdatum);
    const heute = new Date();
    const daysDifference = Math.floor((heute.getTime() - buchungsdatum.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDifference <= 4;
  };

  // Group data by months for timeline display
  const monthlyData = new Map();

  // Add ALL months with Forderungen
  if (forderungen) {
    forderungen.forEach(forderung => {
      const month = forderung.sollmonat;
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { forderungen: [], zahlungen: [] });
      }
      monthlyData.get(month).forderungen.push(forderung);
    });
  }

  // Add ALL payments and create months for them if they don't exist
  zahlungen.forEach(zahlung => {
    const assignedMonth = zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7);

    if (assignedMonth) {
      if (!monthlyData.has(assignedMonth)) {
        monthlyData.set(assignedMonth, { forderungen: [], zahlungen: [] });
      }
      monthlyData.get(assignedMonth).zahlungen.push(zahlung);
    }
  });

  // Sort months chronologically (newest first)
  const sortedMonths = Array.from(monthlyData.keys()).sort().reverse();

  if (sortedMonths.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">Keine Zahlungen oder Forderungen gefunden</p>
      </div>
    );
  }

  const hasIgnoredPayments = zahlungen.some(z => z.kategorie === 'Ignorieren');

  return (
    <div className="relative px-8 py-8">
      {/* Toggle for ignored payments */}
      {hasIgnoredPayments && (
        <div className="mb-6 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIgnoredPayments(!showIgnoredPayments)}
            className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
          >
            {showIgnoredPayments ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span>Ignorierte ausblenden</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span>Ignorierte anzeigen</span>
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Central Timeline */}
      <div className="absolute left-1/2 top-0 w-0.5 bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400 h-full transform -translate-x-0.5 z-0 opacity-60"></div>

      {sortedMonths.map((month, index) => {
        const data = monthlyData.get(month);
        const monthDate = new Date(month + '-01');
        const forderungenData = data.forderungen;
        const zahlungenData = data.zahlungen;

        return (
          <div
            key={month}
            className="relative mb-20 min-h-[180px] animate-fade-in"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, month)}
          >
            {/* Month marker */}
            <div className="absolute left-1/2 w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full border-3 border-white shadow-lg transform -translate-x-1/2 z-20">
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <div className="bg-white shadow-md rounded-lg px-4 py-2 border border-gray-100">
                  <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {monthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-20 pt-16">
              {/* Left side - Forderungen */}
              <div className="pr-10">
                {forderungenData.length > 0 ? (
                  <div className="space-y-3">
                    {forderungenData.map((forderung: any) => (
                      <div key={forderung.id} className="w-full">
                        <div className="w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm group relative">
                          {/* Delete icon in top left */}
                          <Button
                            onClick={() => handleDeleteForderung(forderung.id)}
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            title="Forderung löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          
                          <div className="flex justify-center items-center flex-col text-center pt-2">
                            <div className="flex items-center justify-center mb-2">
                              <div className="bg-red-100 rounded-full p-1.5 mr-2">
                                <span className="text-red-600 text-xs">📋</span>
                              </div>
                              <p className="font-semibold text-red-600 text-sm">
                                Forderung {forderungenData.length > 1 ? `${forderungenData.indexOf(forderung) + 1}/${forderungenData.length}` : ''}
                              </p>
                            </div>
                            
                            {/* Editable amount */}
                            {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'betrag' ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="number"
                                  value={editForderungValue}
                                  onChange={(e) => setEditForderungValue(e.target.value)}
                                  className="w-24 h-8 text-center"
                                  step="0.01"
                                />
                                <Button onClick={() => handleSaveForderung(editForderungValue)} size="sm" className="h-6 text-xs">
                                  ✓
                                </Button>
                                <Button onClick={handleCancelForderungEdit} size="sm" variant="outline" className="h-6 text-xs">
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <p 
                                className="text-xl font-bold text-red-700 mb-1 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                                onClick={() => handleEditForderung(forderung.id, 'betrag', forderung.sollbetrag.toString())}
                              >
                                {formatBetrag(Number(forderung.sollbetrag))}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Right side - Zahlungen */}
              <div className="pl-10">
                {zahlungenData.length > 0 ? (
                  <div className="space-y-3">
                    {zahlungenData
                      .filter(zahlung => {
                        // Filtere ignorierte Zahlungen basierend auf Toggle-Zustand
                        if (zahlung.kategorie === 'Ignorieren' && !showIgnoredPayments) {
                          return false;
                        }
                        return true;
                      })
                      .map((zahlung: any) => {
                        const isIgnored = zahlung.kategorie === 'Ignorieren';
                        const isLastschriftPending = isLastschriftPendingPayment(zahlung);
                        return (
                          <div
                            key={zahlung.id}
                            className={`w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm cursor-move transition-all duration-300 ${
                              isIgnored 
                                ? 'opacity-20 hover:opacity-60 border-dashed border-gray-300 bg-gray-50/50' 
                                : isLastschriftPending
                                ? 'border-orange-300 bg-orange-50/30'
                                : ''
                            }`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, zahlung.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="flex justify-between items-start">
                             <div className="flex-1">
                               {/* Lastschrift Pending Indicator */}
                               {isLastschriftPending && (
                                 <div className="mb-2">
                                   <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                                     Lastschrift ausstehend
                                   </Badge>
                                 </div>
                               )}
                              <div className="flex items-center mb-2">
                                <div className={`rounded-full p-1.5 mr-2 ${
                                  zahlung.kategorie === 'Ignorieren' 
                                    ? 'bg-gray-100' 
                                    : zahlung.kategorie === 'Mietkaution' 
                                      ? 'bg-blue-100' 
                                      : 'bg-green-100'
                                }`}>
                                  <span className={`text-xs ${
                                    zahlung.kategorie === 'Ignorieren' 
                                      ? 'text-gray-400' 
                                      : zahlung.kategorie === 'Mietkaution' 
                                        ? 'text-blue-600' 
                                        : 'text-green-600'
                                  }`}>💰</span>
                                </div>
                                <p className={`font-semibold text-sm ${
                                  zahlung.kategorie === 'Ignorieren' 
                                    ? 'text-gray-400' 
                                    : zahlung.kategorie === 'Mietkaution' 
                                      ? 'text-blue-600' 
                                      : 'text-green-600'
                                }`}>Zahlung</p>
                              </div>

                              <p className={`text-xl font-bold mb-1 ${
                                zahlung.kategorie === 'Ignorieren' 
                                  ? 'text-gray-400' 
                                  : zahlung.kategorie === 'Mietkaution' 
                                    ? 'text-blue-700' 
                                    : 'text-green-700'
                              }`}>
                                {formatBetrag(Number(zahlung.betrag))}
                              </p>

                            {/* Rücklastschrift Fee Input */}
                            {zahlung.kategorie === 'Rücklastschrift' && (
                              <div className="mt-2">
                                {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'gebuehr' ? (
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs text-red-600">Gebühr:</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editPaymentValue}
                                      onChange={(e) => setEditPaymentValue(e.target.value)}
                                      className="w-20 h-6 text-xs"
                                      placeholder="0.00"
                                    />
                                    <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs text-red-600">Gebühr:</span>
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs cursor-pointer hover:bg-red-50 border-red-200 text-red-700"
                                      onClick={() => handleEditPaymentField(zahlung.id, 'gebuehr', zahlung.ruecklastschrift_gebuehr?.toString() || '0')}
                                    >
                                      {formatBetrag(Number(zahlung.ruecklastschrift_gebuehr || 0))}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}

                            <p className="text-sm text-muted-foreground mb-1">
                              {formatDatum(zahlung.buchungsdatum)}
                            </p>

                            {zahlung.verwendungszweck && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {zahlung.verwendungszweck}
                              </p>
                            )}

                            <div className="flex items-center space-x-2">
                              {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'kategorie' ? (
                                <div className="flex items-center space-x-1">
                                  <Select
                                    value={editPaymentValue}
                                    onValueChange={setEditPaymentValue}
                                  >
                                    <SelectTrigger className="w-32 h-6 text-xs">
                                      <SelectValue placeholder="Kategorie" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Miete">Miete</SelectItem>
                                      <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                      <SelectItem value="Rücklastschrift">Rücklastschrift</SelectItem>
                                      <SelectItem value="Ignorieren">Ignorieren</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <Badge 
                                    variant={zahlung.kategorie === 'Ignorieren' ? 'secondary' : 'outline'} 
                                    className={`text-sm ${
                                      zahlung.kategorie === 'Ignorieren' 
                                        ? 'bg-gray-100 text-gray-400 border-gray-200' 
                                        : ''
                                    }`}
                                  >
                                    {zahlung.kategorie || 'Sonstige'}
                                  </Badge>
                                  <Button
                                    onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || '')}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                    title="Kategorie bearbeiten"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  {!isSplitPayment(zahlung) ? (
                                    <Button
                                      onClick={() => setSplittingPayment(zahlung)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 opacity-60 hover:opacity-100 text-blue-600 hover:text-blue-800"
                                      title="Zahlung aufteilen"
                                    >
                                      <Split className="h-3 w-3" />
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => setUndoingSplitPayments(getSplitGroupPayments(zahlung))}
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 opacity-60 hover:opacity-100 text-orange-600 hover:text-orange-800"
                                      title="Aufteilung rückgängig machen"
                                    >
                                      <Undo2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Month Edit */}
                            <div className="mt-2">
                              {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'monat' ? (
                                <div className="flex items-center space-x-1">
                                  <Select
                                    value={editPaymentValue}
                                    onValueChange={(value) => setEditPaymentValue(value)}
                                  >
                                    <SelectTrigger className="w-32 h-6 text-xs">
                                      <SelectValue placeholder="Monat wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        // Generate available months from Forderungen
                                        const availableMonths = new Set<string>();
                                        
                                        // Add months from Forderungen
                                        (forderungen || []).forEach(forderung => {
                                          if (forderung.sollmonat) {
                                            availableMonths.add(forderung.sollmonat);
                                          }
                                        });
                                        
                                        // Add current and next 12 months
                                        const now = new Date();
                                        for (let i = -6; i <= 12; i++) {
                                          const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
                                          const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                          availableMonths.add(monthStr);
                                        }
                                        
                                        // Convert to sorted array
                                        return Array.from(availableMonths)
                                          .sort()
                                          .map(month => {
                                            const [year, monthNum] = month.split('-');
                                            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('de-DE', { 
                                              year: 'numeric', 
                                              month: 'long' 
                                            });
                                            return (
                                              <SelectItem key={month} value={month}>
                                                {monthName}
                                              </SelectItem>
                                            );
                                          });
                                      })()}
                                    </SelectContent>
                                  </Select>
                                  <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 w-6 p-0">
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 w-6 p-0">
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || 'Unzugeordnet'}
                                  </Badge>
                                  {(() => {
                                    const zahlungsJahr = new Date(zahlung.buchungsdatum).getFullYear();
                                    const hatForderungen = (forderungen || []).length > 0;
                                    const canEditMonth = zahlungsJahr >= 2025 && hatForderungen;
                                    
                                    return canEditMonth ? (
                                      <Button
                                        onClick={() => handleEditPaymentField(zahlung.id, 'monat', zahlung.zugeordneter_monat || '')}
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                      >
                                        <Calendar className="h-3 w-3" />
                                      </Button>
                                    ) : null;
                                  })()}
                                </div>
                              )}
                            </div>

                            {/* Mietvertrag Edit */}
                            <div className="mt-2">
                              {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'mietvertrag' ? (
                                <div className="space-y-2">
                                  <Input
                                    placeholder="Suche Mietvertrag..."
                                    value={mietvertragSearchTerm}
                                    onChange={(e) => setMietvertragSearchTerm(e.target.value)}
                                    className="w-full h-6 text-xs"
                                  />
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {allMietvertraege?.filter(mv => {
                                      if (!mietvertragSearchTerm) return true;
                                      
                                      const searchTerm = mietvertragSearchTerm.toLowerCase();
                                      const mieterNames = mv.mietvertrag_mieter?.map((mm: any) => `${mm.mieter?.vorname} ${mm.mieter?.nachname}`).join(', ') || '';
                                      const immobilieName = mv.einheiten?.immobilien?.name || '';
                                      const adresse = mv.einheiten?.immobilien?.adresse || '';
                                      const einheitId = mv.einheit_id || '';
                                      
                                      return mieterNames.toLowerCase().includes(searchTerm) ||
                                             immobilieName.toLowerCase().includes(searchTerm) ||
                                             adresse.toLowerCase().includes(searchTerm) ||
                                             einheitId.toLowerCase().includes(searchTerm);
                                    }).map(mv => {
                                      const mieterNames = mv.mietvertrag_mieter?.map((mm: any) => `${mm.mieter?.vorname} ${mm.mieter?.nachname}`).join(', ') || 'Keine Mieter';
                                      const einheitId = mv.einheit_id?.slice(-2) || 'XX';
                                      return (
                                        <button
                                          key={mv.id}
                                          onClick={() => handleSavePaymentField(mv.id)}
                                          className="w-full text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded"
                                        >
                                          <div className="font-medium">{mv.einheiten?.immobilien?.name} - Einheit {einheitId}</div>
                                          <div className="text-muted-foreground">{mv.einheiten?.immobilien?.adresse}</div>
                                          <div className="text-blue-600 mt-1">{mieterNames}</div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 text-xs">
                                      Abbrechen
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <Badge variant="outline" className="text-xs">
                                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                                    Objekt
                                  </Badge>
                                  <Button
                                    onClick={() => handleEditPaymentField(zahlung.id, 'mietvertrag', zahlung.mietvertrag_id || '')}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Payment Split Modal */}
      <PaymentSplitModal
        isOpen={!!splittingPayment}
        onClose={() => setSplittingPayment(null)}
        payment={splittingPayment}
        vertragId={vertragId}
        formatBetrag={formatBetrag}
      />

      {/* Payment Undo Split Modal */}
      <PaymentUndoSplitModal
        isOpen={!!undoingSplitPayments}
        onClose={() => setUndoingSplitPayments(null)}
        splitPayments={undoingSplitPayments || []}
        vertragId={vertragId}
        formatBetrag={formatBetrag}
      />
    </div>
  );
}