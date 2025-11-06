import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Euro, Calendar, Trash2, Link2Off, Loader2, Edit, Settings, Calculator, Building } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AssignPaymentDialog } from "@/components/controlboard/AssignPaymentDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ImmobilienNebenkostenTabProps {
  immobilieId: string;
}

export function ImmobilienNebenkostenTab({ immobilieId }: ImmobilienNebenkostenTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showDistributionSettings, setShowDistributionSettings] = useState(false);

  // Fetch einheiten for this property
  const { data: einheiten, isLoading: einheitenLoading } = useQuery({
    queryKey: ['einheiten-nebenkosten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('zaehler', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payments for this property (Betriebskosten)
  const { data: zahlungen, isLoading: zahlungenLoading } = useQuery({
    queryKey: ['immobilien-nebenkosten', immobilieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('immobilie_id', immobilieId)
        .order('buchungsdatum', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const handleUnassign = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ immobilie_id: null })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Zuordnung aufgehoben",
        description: "Die Zahlung wurde von der Immobilie getrennt.",
      });

      await queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten', immobilieId] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });
    } catch (error: any) {
      console.error('Error unassigning payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zuordnung konnte nicht aufgehoben werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedPaymentId) return;

    try {
      const { error } = await supabase
        .from('zahlungen')
        .delete()
        .eq('id', selectedPaymentId);

      if (error) throw error;

      toast({
        title: "Zahlung gelöscht",
        description: "Die Zahlung wurde erfolgreich gelöscht.",
      });

      await queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten', immobilieId] });
      await queryClient.invalidateQueries({ queryKey: ['zahlungen'] });
      
      setDeleteDialogOpen(false);
      setSelectedPaymentId(null);
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Fehler",
        description: error.message || "Die Zahlung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDistributionKey = async (
    einheitId: string,
    art: string,
    wert?: number,
    personen?: number
  ) => {
    try {
      const updateData: any = { verteilerschluessel_art: art };
      
      if (art === 'individuell' && wert !== undefined) {
        updateData.verteilerschluessel_wert = wert;
      }
      if (art === 'personen' && personen !== undefined) {
        updateData.anzahl_personen = personen;
      }

      const { error } = await supabase
        .from('einheiten')
        .update(updateData)
        .eq('id', einheitId);

      if (error) throw error;

      toast({
        title: "Verteilerschlüssel gespeichert",
        description: "Der Verteilerschlüssel wurde erfolgreich aktualisiert.",
      });

      await queryClient.invalidateQueries({ queryKey: ['einheiten-nebenkosten', immobilieId] });
    } catch (error: any) {
      console.error('Error updating distribution key:', error);
      toast({
        title: "Fehler",
        description: error.message || "Der Verteilerschlüssel konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const calculateDistribution = () => {
    if (!einheiten || einheiten.length === 0) return [];

    const totalQm = einheiten.reduce((sum, e) => sum + (e.qm || 0), 0);
    const totalPersonen = einheiten.reduce((sum, e) => sum + (e.anzahl_personen || 1), 0);
    const anzahlEinheiten = einheiten.length;
    
    let totalIndividuell = 0;
    einheiten.forEach(e => {
      if (e.verteilerschluessel_art === 'individuell') {
        totalIndividuell += (e.verteilerschluessel_wert || 0);
      }
    });

    return einheiten.map(einheit => {
      let anteil = 0;

      switch (einheit.verteilerschluessel_art) {
        case 'qm':
          anteil = totalQm > 0 ? ((einheit.qm || 0) / totalQm) * 100 : 0;
          break;
        case 'personen':
          anteil = totalPersonen > 0 ? ((einheit.anzahl_personen || 1) / totalPersonen) * 100 : 0;
          break;
        case 'gleich':
          anteil = anzahlEinheiten > 0 ? (1 / anzahlEinheiten) * 100 : 0;
          break;
        case 'individuell':
          anteil = einheit.verteilerschluessel_wert || 0;
          break;
      }

      return {
        ...einheit,
        anteil: anteil,
      };
    });
  };

  const distributedEinheiten = calculateDistribution();
  const totalAnteil = distributedEinheiten.reduce((sum, e) => sum + e.anteil, 0);
  const totalNebenkosten = zahlungen?.reduce((sum, z) => sum + (z.betrag || 0), 0) || 0;

  const getCategoryColor = (kategorie: string | null) => {
    switch (kategorie) {
      case 'Miete': return 'bg-green-100 text-green-800 border-green-300';
      case 'Mietkaution': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Rücklastschrift': return 'bg-red-100 text-red-800 border-red-300';
      case 'Nichtmiete': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (einheitenLoading || zahlungenLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Verteilerschlüssel Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Verteilerschlüssel-Einstellungen
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDistributionSettings(!showDistributionSettings)}
              >
                {showDistributionSettings ? 'Verbergen' : 'Anzeigen'}
              </Button>
            </div>
          </CardHeader>
          {showDistributionSettings && (
            <CardContent>
              <div className="space-y-6">
                {/* Zusammenfassung */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Calculator className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2">Verteilungsübersicht</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-blue-700">Gesamtanteil:</p>
                          <p className={`font-bold ${Math.abs(totalAnteil - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalAnteil.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-700">Anzahl Einheiten:</p>
                          <p className="font-bold text-blue-900">{einheiten?.length || 0}</p>
                        </div>
                      </div>
                      {Math.abs(totalAnteil - 100) > 0.01 && (
                        <p className="text-xs text-red-600 mt-2">
                          ⚠️ Achtung: Die Summe der Anteile sollte 100% ergeben!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Einheiten-spezifische Verteilerschlüssel */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Verteilerschlüssel pro Einheit</h4>
                  {distributedEinheiten.map((einheit) => (
                    <DistributionKeyRow
                      key={einheit.id}
                      einheit={einheit}
                      onUpdate={handleUpdateDistributionKey}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Kostenverteilung Übersicht */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Nebenkosten-Verteilung auf Einheiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-700 mb-2">Gesamte Nebenkosten der Immobilie:</p>
                <p className="text-3xl font-bold text-purple-900">
                  {totalNebenkosten.toFixed(2)} €
                </p>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {distributedEinheiten.map((einheit) => {
                    const anteilBetrag = (totalNebenkosten * einheit.anteil) / 100;
                    return (
                      <div
                        key={einheit.id}
                        className="p-4 border rounded-lg bg-white hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              Einheit {einheit.zaehler || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {einheit.qm ? `${einheit.qm} m²` : 'Keine Fläche'} • {einheit.verteilerschluessel_art}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{einheit.anteil.toFixed(2)}%</p>
                            <p className="text-xl font-bold text-purple-600">
                              {anteilBetrag.toFixed(2)} €
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        {/* Alle Nebenkosten-Zahlungen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Alle Nebenkosten ({zahlungen?.length || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!zahlungen || zahlungen.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Euro className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Nebenkosten-Zahlungen für diese Immobilie gefunden</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {zahlungen.map((zahlung) => (
                    <div
                      key={zahlung.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(zahlung.buchungsdatum), 'dd. MMMM yyyy', { locale: de })}
                            </span>
                            <span className={`font-bold text-lg ${zahlung.betrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {zahlung.betrag >= 0 ? '+' : ''}{zahlung.betrag.toFixed(2)} €
                            </span>
                          </div>

                          {zahlung.kategorie && (
                            <Badge variant="outline" className={getCategoryColor(zahlung.kategorie)}>
                              {zahlung.kategorie}
                            </Badge>
                          )}

                          {zahlung.empfaengername && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Empfänger:</strong> {zahlung.empfaengername}
                            </p>
                          )}

                          {zahlung.verwendungszweck && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Verwendungszweck:</strong> {zahlung.verwendungszweck}
                            </p>
                          )}

                          {zahlung.zugeordneter_monat && (
                            <p className="text-xs text-muted-foreground">
                              Monat: {zahlung.zugeordneter_monat}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(zahlung);
                              setAssignDialogOpen(true);
                            }}
                            title="Neu zuordnen"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnassign(zahlung.id)}
                            title="Zuordnung aufheben"
                          >
                            <Link2Off className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPaymentId(zahlung.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Zahlung löschen"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Payment Dialog */}
      <AssignPaymentDialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) {
            setSelectedPayment(null);
            queryClient.invalidateQueries({ queryKey: ['immobilien-nebenkosten', immobilieId] });
          }
        }}
        payment={selectedPayment ? {
          id: selectedPayment.id,
          betrag: selectedPayment.betrag,
          buchungsdatum: selectedPayment.buchungsdatum,
          empfaengername: selectedPayment.empfaengername || undefined,
          iban: selectedPayment.iban || undefined,
          verwendungszweck: selectedPayment.verwendungszweck || undefined,
          kategorie: selectedPayment.kategorie || undefined,
        } : null}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zahlung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diese Zahlung löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPaymentId(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Sub-component for distribution key row
interface DistributionKeyRowProps {
  einheit: any;
  onUpdate: (einheitId: string, art: string, wert?: number, personen?: number) => void;
}

function DistributionKeyRow({ einheit, onUpdate }: DistributionKeyRowProps) {
  const [art, setArt] = useState(einheit.verteilerschluessel_art || 'qm');
  const [wert, setWert] = useState(einheit.verteilerschluessel_wert || 0);
  const [personen, setPersonen] = useState(einheit.anzahl_personen || 1);

  const handleSave = () => {
    onUpdate(einheit.id, art, wert, personen);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">Einheit {einheit.zaehler || 'N/A'}</p>
          <p className="text-sm text-gray-600">
            {einheit.qm ? `${einheit.qm} m²` : 'Keine Fläche angegeben'}
          </p>
        </div>
        <Badge variant="outline" className="bg-white">
          {einheit.anteil?.toFixed(2)}% Anteil
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`art-${einheit.id}`}>Verteilungsart</Label>
          <Select value={art} onValueChange={setArt}>
            <SelectTrigger id={`art-${einheit.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qm">Nach m²</SelectItem>
              <SelectItem value="personen">Nach Personenanzahl</SelectItem>
              <SelectItem value="gleich">Gleichmäßig</SelectItem>
              <SelectItem value="individuell">Individuell (%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {art === 'individuell' && (
          <div className="space-y-2">
            <Label htmlFor={`wert-${einheit.id}`}>Prozentsatz (%)</Label>
            <Input
              id={`wert-${einheit.id}`}
              type="number"
              step="0.01"
              value={wert}
              onChange={(e) => setWert(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}

        {art === 'personen' && (
          <div className="space-y-2">
            <Label htmlFor={`personen-${einheit.id}`}>Anzahl Personen</Label>
            <Input
              id={`personen-${einheit.id}`}
              type="number"
              min="1"
              value={personen}
              onChange={(e) => setPersonen(parseInt(e.target.value) || 1)}
            />
          </div>
        )}

        <div className="flex items-end">
          <Button onClick={handleSave} className="w-full">
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}