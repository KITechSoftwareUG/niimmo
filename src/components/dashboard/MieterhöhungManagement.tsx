import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Calendar, Edit2, Save, X } from "lucide-react";

interface MieterhöhungManagementProps {
  vertragId: string;
  currentKaltmiete: number;
  letzteErhöhung: string | null;
  startDatum: string;
}

export const MieterhöhungManagement = ({
  vertragId,
  currentKaltmiete,
  letzteErhöhung,
  startDatum
}: MieterhöhungManagementProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newDate, setNewDate] = useState(letzteErhöhung || '');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (date: string | null) => {
      const { error } = await supabase
        .from('mietvertrag')
        .update({ letzte_mieterhoehung_am: date })
        .eq('id', vertragId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail'] });
      queryClient.invalidateQueries({ queryKey: ['rent-increase-eligibility'] });
      setIsEditing(false);
      toast({
        title: "Erfolgreich gespeichert",
        description: "Das Datum der letzten Mieterhöhung wurde aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Das Datum konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      console.error('Error updating rent increase date:', error);
    }
  });

  const calculateEligibility = () => {
    const currentDate = new Date();
    const referenceDate = letzteErhöhung ? new Date(letzteErhöhung) : new Date(startDatum);
    const monthsSinceReference = Math.floor(
      (currentDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    
    return {
      isEligible: monthsSinceReference >= 15,
      monthsUntilEligible: Math.max(0, 15 - monthsSinceReference),
      monthsSince: monthsSinceReference
    };
  };

  const handleSave = () => {
    updateMutation.mutate(newDate || null);
  };

  const handleCancel = () => {
    setNewDate(letzteErhöhung || '');
    setIsEditing(false);
  };

  const eligibility = calculateEligibility();

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-xl font-semibold text-gray-800">Mieterhöhungen</span>
          </div>
          {eligibility.isEligible ? (
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              Erhöhung möglich
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              Noch {eligibility.monthsUntilEligible} Monate
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Current Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600 block mb-1">Aktuelle Kaltmiete</label>
              <p className="text-2xl font-bold text-gray-900">
                {currentKaltmiete.toLocaleString()}€
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600 block mb-1">Status</label>
              <p className="text-lg font-semibold text-gray-900">
                {eligibility.isEligible ? (
                  <span className="text-green-600">Erhöhung zulässig</span>
                ) : (
                  <span className="text-yellow-600">Wartezeit läuft</span>
                )}
              </p>
            </div>
          </div>

          {/* Last Rent Increase Date */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <label className="text-sm font-medium text-gray-700">Letzte Mieterhöhung</label>
              </div>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8 px-2 text-blue-600 hover:bg-blue-100"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Bearbeiten
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="rent-increase-date" className="text-sm">
                    Datum der letzten Mieterhöhung
                  </Label>
                  <Input
                    id="rent-increase-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Speichern
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {letzteErhöhung 
                    ? new Date(letzteErhöhung).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'Noch keine Erhöhung'
                  }
                </p>
                {letzteErhöhung && (
                  <p className="text-sm text-gray-600 mt-1">
                    Vor {eligibility.monthsSince} Monaten
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Rules Information */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Gesetzliche Regelungen</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Erhöhung frühestens 15 Monate nach Einzug oder letzter Erhöhung</li>
              <li>• Erhöhung darf höchstens alle 12 Monate verlangt werden</li>
              <li>• Neue Miete gilt ab dem 3. Monat nach Zugang des Schreibens</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};