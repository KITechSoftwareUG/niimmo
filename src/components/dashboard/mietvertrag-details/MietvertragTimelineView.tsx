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
  Receipt,
  Coins,
  CreditCard,
  Clock,
  Move
} from "lucide-react";

interface MietvertragTimelineViewProps {
  forderungen: any[];
  zahlungen: any[];
  allMietvertraege?: any[];
  vertragId: string;
  formatDatum: (datum: string) => string;
  formatBetrag: (betrag: number) => string;
}

export function MietvertragTimelineView({
  forderungen,
  zahlungen,
  allMietvertraege,
  vertragId,
  formatDatum,
  formatBetrag
}: MietvertragTimelineViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingPayment, setEditingPayment] = useState<{ zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag' } | null>(null);
  const [editPaymentValue, setEditPaymentValue] = useState<string>("");
  const [mietvertragSearchTerm, setMietvertragSearchTerm] = useState<string>("");
  const [editingForderung, setEditingForderung] = useState<{ forderungId: string, field: 'betrag' | 'monat' } | null>(null);
  const [editForderungValue, setEditForderungValue] = useState<string>("");
  const [draggedPayment, setDraggedPayment] = useState<string | null>(null);

  // Drag and drop handlers and all other functions

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

  const handleEditPaymentField = (zahlungId: string, field: 'kategorie' | 'monat' | 'mietvertrag', currentValue: string) => {
    const zahlung = zahlungen?.find(z => z.id === zahlungId);

    setEditingPayment({ zahlungId, field });
    if (field === 'mietvertrag') {
      setEditPaymentValue(zahlung?.mietvertrag_id || '');
    } else if (field === 'monat') {
      const monthValue = zahlung?.zugeordneter_monat || zahlung?.buchungsdatum?.slice(0, 7) || '';
      setEditPaymentValue(monthValue);
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
      <div className="text-center py-16 animate-fade-in">
        <div className="glass-card p-12 rounded-2xl max-w-md mx-auto">
          <div className="animate-float">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Keine Daten gefunden</h3>
          <p className="text-muted-foreground">Keine Zahlungen oder Forderungen für diesen Zeitraum vorhanden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-8 py-8">
      {/* Central Timeline */}
      <div className="absolute left-1/2 top-0 w-1 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/40 h-full transform -translate-x-0.5 z-0 rounded-full shadow-lg animate-pulse-glow"></div>
      
      {/* Timeline glow effect */}
      <div className="absolute left-1/2 top-0 w-8 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent h-full transform -translate-x-1/2 z-0 blur-sm"></div>

      {sortedMonths.map((month, index) => {
        const data = monthlyData.get(month);
        const monthDate = new Date(month + '-01');
        const forderungenData = data.forderungen;
        const zahlungenData = data.zahlungen;

        return (
          <div
            key={month}
            className="relative mb-24 min-h-[200px] animate-scale-in hover-scale"
            style={{ animationDelay: `${index * 100}ms` }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, month)}
          >
            {/* Month marker with enhanced design */}
            <div className="absolute left-1/2 w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full border-4 border-background shadow-xl transform -translate-x-1/2 z-30 hover:scale-110 transition-transform duration-300">
              <div className="absolute inset-1 bg-gradient-to-br from-primary-foreground/20 to-transparent rounded-full"></div>
              <Calendar className="absolute inset-0 m-auto h-4 w-4 text-primary-foreground" />
              
              {/* Month label with improved styling */}
              <div className="absolute top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-20">
                <div className="elegant-card px-6 py-3 rounded-xl border border-primary/20 bg-gradient-to-r from-card/95 to-card/90 backdrop-blur-md">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">
                      {monthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-24 pt-20">
              {/* Left side - Forderungen */}
              <div className="pr-8">
                {forderungenData.length > 0 ? (
                  <div className="space-y-4">
                    {forderungenData.map((forderung: any, forderungIndex: number) => (
                      <div key={forderung.id} className="w-full animate-slide-in-right" style={{ animationDelay: `${(index * 100) + (forderungIndex * 50)}ms` }}>
                        <div className="w-full elegant-card p-6 group relative hover:shadow-xl transition-all duration-300 border-l-4 border-l-destructive/60 bg-gradient-to-r from-destructive/5 to-transparent">
                          {/* Delete icon with improved styling */}
                          <Button
                            onClick={() => handleDeleteForderung(forderung.id)}
                            variant="ghost"
                            size="sm"
                            className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-200 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            title="Forderung löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          
                          <div className="flex justify-center items-center flex-col text-center pt-2">
                            <div className="flex items-center justify-center mb-4">
                              <div className="bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-full p-3 mr-3 shadow-sm">
                                <Receipt className="h-5 w-5 text-destructive" />
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-destructive text-sm">
                                  Forderung {forderungenData.length > 1 ? `${forderungIndex + 1}/${forderungenData.length}` : ''}
                                </p>
                                <p className="text-xs text-muted-foreground">Ausstehend</p>
                              </div>
                            </div>
                            
                            {/* Editable amount with enhanced styling */}
                            {editingForderung?.forderungId === forderung.id && editingForderung?.field === 'betrag' ? (
                              <div className="flex items-center justify-center space-x-3 bg-muted/30 rounded-lg p-3">
                                <Input
                                  type="number"
                                  value={editForderungValue}
                                  onChange={(e) => setEditForderungValue(e.target.value)}
                                  className="w-32 h-10 text-center font-semibold modern-input"
                                  step="0.01"
                                />
                                <Button 
                                  onClick={() => handleSaveForderung(editForderungValue)} 
                                  size="sm" 
                                  className="h-8 w-8 p-0 bg-primary hover:bg-primary/90"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  onClick={handleCancelForderungEdit} 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:border-destructive/20"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="bg-gradient-to-r from-destructive/10 to-destructive/5 rounded-lg p-4 cursor-pointer hover:from-destructive/15 hover:to-destructive/10 transition-all duration-200 group/amount"
                                onClick={() => handleEditForderung(forderung.id, 'betrag', forderung.sollbetrag.toString())}
                              >
                                <p className="text-2xl font-bold text-destructive mb-1 group-hover/amount:scale-105 transition-transform duration-200">
                                  {formatBetrag(Number(forderung.sollbetrag))}
                                </p>
                                <p className="text-xs text-muted-foreground opacity-0 group-hover/amount:opacity-100 transition-opacity">
                                  Klicken zum Bearbeiten
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Right side - Zahlungen */}
              <div className="pl-8">
                {zahlungenData.length > 0 ? (
                  <div className="space-y-4">
                    {zahlungenData.map((zahlung: any, zahlungIndex: number) => {
                      const isKaution = zahlung.kategorie === 'Kaution' || zahlung.kategorie === 'Mietkaution';
                      const colorClasses = isKaution 
                        ? { 
                            bg: 'from-blue-500/10 to-blue-400/5', 
                            border: 'border-l-blue-500/60',
                            iconBg: 'bg-gradient-to-br from-blue-500/20 to-blue-400/10',
                            iconColor: 'text-blue-600',
                            textColor: 'text-blue-700',
                            amountColor: 'text-blue-800'
                          }
                        : { 
                            bg: 'from-primary/10 to-primary/5', 
                            border: 'border-l-primary/60',
                            iconBg: 'bg-gradient-to-br from-primary/20 to-primary/10',
                            iconColor: 'text-primary',
                            textColor: 'text-primary',
                            amountColor: 'text-primary'
                          };
                      
                      return (
                        <div
                          key={zahlung.id}
                          className={`w-full elegant-card p-6 cursor-move group relative hover:shadow-xl transition-all duration-300 border-l-4 ${colorClasses.border} bg-gradient-to-r ${colorClasses.bg} animate-slide-in-left ${draggedPayment === zahlung.id ? 'opacity-50 scale-95' : ''}`}
                          style={{ animationDelay: `${(index * 100) + (zahlungIndex * 50)}ms` }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, zahlung.id)}
                          onDragEnd={handleDragEnd}
                        >
                          {/* Drag indicator */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Move className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center mb-4">
                                <div className={`rounded-full p-3 mr-3 shadow-sm ${colorClasses.iconBg}`}>
                                  {isKaution ? (
                                    <CreditCard className={`h-5 w-5 ${colorClasses.iconColor}`} />
                                  ) : (
                                    <Coins className={`h-5 w-5 ${colorClasses.iconColor}`} />
                                  )}
                                </div>
                                <div className="text-left">
                                  <p className={`font-semibold text-sm ${colorClasses.textColor}`}>
                                    {isKaution ? 'Kaution' : 'Mietzahlung'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Eingegangen</p>
                                </div>
                              </div>

                              <div className={`bg-gradient-to-r ${colorClasses.bg} rounded-lg p-4 mb-4`}>
                                <p className={`text-2xl font-bold mb-2 ${colorClasses.amountColor}`}>
                                  {formatBetrag(Number(zahlung.betrag))}
                                </p>
                                <div className="flex items-center text-sm text-muted-foreground mb-1">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  {formatDatum(zahlung.buchungsdatum)}
                                </div>
                              </div>

                              {zahlung.verwendungszweck && (
                                <div className="bg-muted/30 rounded-lg p-3 mb-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Verwendungszweck:</p>
                                  <p className="text-sm text-foreground">
                                    {zahlung.verwendungszweck}
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                                {/* Category editing */}
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
                                        <SelectItem value="Kaution">Kaution</SelectItem>
                                        <SelectItem value="Mietkaution">Mietkaution</SelectItem>
                                        <SelectItem value="Betriebskosten">Betriebskosten</SelectItem>
                                        <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 text-xs">
                                      ✓
                                    </Button>
                                    <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 text-xs">
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {zahlung.kategorie || 'Miete'}
                                    </Badge>
                                    <Button
                                      onClick={() => handleEditPaymentField(zahlung.id, 'kategorie', zahlung.kategorie || 'Miete')}
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}

                                {/* Month editing */}
                                {editingPayment?.zahlungId === zahlung.id && editingPayment.field === 'monat' ? (
                                  <div className="flex items-center space-x-1">
                                    <Input
                                      type="month"
                                      value={editPaymentValue}
                                      onChange={(e) => setEditPaymentValue(e.target.value)}
                                      className="w-32 h-6 text-xs"
                                    />
                                    <Button onClick={() => handleSavePaymentField()} size="sm" className="h-6 text-xs">
                                      ✓
                                    </Button>
                                    <Button onClick={handleCancelPaymentEdit} size="sm" variant="outline" className="h-6 text-xs">
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1">
                                    <Badge variant="outline" className="text-xs">
                                      📅 {zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || 'Kein Monat'}
                                    </Badge>
                                    <Button
                                      onClick={() => handleEditPaymentField(zahlung.id, 'monat', zahlung.zugeordneter_monat || zahlung.buchungsdatum?.slice(0, 7) || '')}
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
    </div>
  );
}
