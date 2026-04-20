import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, AlertTriangle, Euro, Calendar, User, Building2, Save, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MahnungVorschauModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mietvertragId?: string;
  vertragData?: any;
  mieterData?: any;
  forderungen?: any[];
  currentMahnstufe: number;
  immobilieData?: any;
  isLoading?: boolean;
}

export function MahnungVorschauModal({
  isOpen,
  onClose,
  onConfirm,
  mietvertragId,
  vertragData,
  mieterData,
  forderungen = [],
  currentMahnstufe,
  immobilieData,
  isLoading = false
}: MahnungVorschauModalProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSpeichern = async () => {
    if (!mietvertragId) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-mahnung-pdf', {
        body: {
          mietvertragId,
          mahnstufe: neueMahnstufe,
          offeneForderungen: forderungen.map(f => ({ sollmonat: f.sollmonat, sollbetrag: f.sollbetrag })),
          mahngebuehren: 0,
          verzugszinsen: 0,
          zusaetzlicheKosten: 0,
          zahlungsfristTage: 14
        }
      });
      if (error) throw error;
      setSavedPdfPath(data?.filePath || null);
      toast({ title: "Gespeichert", description: "Mahnung wurde als Dokument archiviert." });
    } catch (err: unknown) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Berechne Gesamtbetrag
  const gesamtbetrag = forderungen.reduce((sum, f) => sum + parseFloat(f.sollbetrag || 0), 0);

  // Bestimme neue Mahnstufe
  const neueMahnstufe = Math.min(currentMahnstufe + 1, 3);

  const getMahnstufeText = (stufe: number) => {
    switch (stufe) {
      case 1: return "Erste Mahnung";
      case 2: return "Zweite Mahnung";
      case 3: return "Dritte und letzte Mahnung";
      default: return "Zahlungserinnerung";
    }
  };

  const getMahnstufeColor = (stufe: number) => {
    switch (stufe) {
      case 1: return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 2: return "bg-orange-100 text-orange-800 border-orange-200";
      case 3: return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const handleSend = () => {
    // Hier später N8N Webhook Integration
    if (webhookUrl) {
      // TODO: N8N Webhook Call implementieren
    }
    
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Send className="h-5 w-5 text-destructive" />
            <span>Mahnung verschicken</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mahnstufe Info */}
          <div className="text-center">
            <Badge className={`text-lg px-4 py-2 ${getMahnstufeColor(neueMahnstufe)}`}>
              {getMahnstufeText(neueMahnstufe)}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Aktuelle Stufe: {currentMahnstufe} → Neue Stufe: {neueMahnstufe}
            </p>
          </div>

          <Separator />

          {/* Mieter-Informationen */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Mieter-Informationen</span>
            </div>
            {mieterData && mieterData.length > 0 && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="font-medium">{mieterData[0].mieter?.vorname} {mieterData[0].mieter?.nachname}</p>
                <p className="text-sm text-muted-foreground">{mieterData[0].mieter?.hauptmail}</p>
                {mieterData[0].mieter?.telnr && (
                  <p className="text-sm text-muted-foreground">{mieterData[0].mieter?.telnr}</p>
                )}
              </div>
            )}
          </div>

          {/* Immobilien-Informationen */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Immobilie</span>
            </div>
            {immobilieData && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="font-medium">{immobilieData.name}</p>
                <p className="text-sm text-muted-foreground">{immobilieData.adresse}</p>
              </div>
            )}
          </div>

          {/* Offene Forderungen */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Offene Forderungen</span>
              </div>
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {gesamtbetrag.toFixed(2)}€
              </Badge>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg space-y-2">
              {forderungen.map((forderung) => (
                <div key={forderung.id} className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(forderung.sollmonat).toLocaleDateString('de-DE', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-destructive">
                    {parseFloat(forderung.sollbetrag).toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* N8N Webhook (Optional) */}
          <div className="space-y-3">
            <Label htmlFor="webhook">N8N Webhook URL (optional)</Label>
            <Input
              id="webhook"
              placeholder="https://your-n8n-instance.com/webhook/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional: URL für N8N Webhook Integration
            </p>
          </div>

          <Separator />

          {/* Warnung */}
          <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Achtung</p>
              <p className="text-xs text-yellow-700">
                Nach dem Versenden wird die Mahnstufe automatisch auf {neueMahnstufe} erhöht und das Datum der letzten Mahnung gespeichert.
              </p>
            </div>
          </div>

          {/* Gespeichert-Indikator */}
          {savedPdfPath && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">Mahnung wurde als Dokument gespeichert.</span>
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Abbrechen
            </Button>
            {mietvertragId && (
              <Button
                variant="outline"
                onClick={handleSpeichern}
                disabled={isSaving || isLoading || !!savedPdfPath}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : savedPdfPath ? (
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {savedPdfPath ? "Gespeichert" : "Nur speichern"}
              </Button>
            )}
            <Button 
              onClick={handleSend} 
              variant="destructive"
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Sende...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Mahnung senden
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}