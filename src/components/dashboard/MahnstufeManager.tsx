import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const MahnstufeManager = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCheckMahnstufen = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-mahnstufen', {
        body: {}
      });

      if (error) throw error;

      const updatedCount = data?.results?.length || 0;
      setLastCheck(new Date().toLocaleString('de-DE'));

      toast({
        title: "Mahnstufen-Prüfung abgeschlossen",
        description: `${updatedCount} Mietverträge wurden auf Basis verspäteter Zahlungen aktualisiert.`,
        duration: 5000,
      });

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Fehler bei der Mahnstufen-Prüfung:', error);
      toast({
        title: "Fehler",
        description: "Mahnstufen-Prüfung konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="glass-card border border-orange-200 bg-orange-50/30">
      <CardHeader>
        <CardTitle className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <span className="text-lg font-semibold text-orange-800">Automatische Mahnstufen-Prüfung</span>
            <p className="text-sm text-orange-600 font-normal mt-1">
              Prüft alle Mietverträge ab 2025 auf verspätete Zahlungen (7+ Werktage nach Fälligkeit)
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700">
                  Automatische Erhöhung der Mahnstufe bei verspäteten Zahlungen
                </span>
              </div>
              <div className="flex items-center space-x-2">  
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700">
                  Toleranz: ±7 Tage Zahlungseingang, ±50€ Betragsdifferenz
                </span>
              </div>
              {lastCheck && (
                <p className="text-xs text-gray-500">
                  Letzte Prüfung: {lastCheck}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleCheckMahnstufen}
            disabled={isChecking}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Prüfe...' : 'Mahnstufen prüfen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};