import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Send, AlertTriangle, Euro, Calendar, User, Building2, Save, Loader2, CheckCircle, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MahnungVorschauModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (pdfPath: string) => void;
  mietvertragId?: string;
  vertragData?: any;
  mieterData?: any;
  forderungen?: any[];
  currentMahnstufe: number;
  immobilieData?: any;
  isSending?: boolean;
}

export function MahnungVorschauModal({
  isOpen,
  onClose,
  onSend,
  mietvertragId,
  vertragData,
  mieterData,
  forderungen = [],
  currentMahnstufe,
  immobilieData,
  isSending = false,
}: MahnungVorschauModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const { toast } = useToast();

  const gesamtbetrag = forderungen.reduce((sum, f) => sum + parseFloat(f.sollbetrag || 0), 0);
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
      const path: string = data?.filePath || '';
      setSavedPdfPath(path);
      toast({ title: "Mahnung gespeichert", description: "Das Dokument wurde archiviert. Jetzt per E-Mail versenden?" });
    } catch (err: unknown) {
      toast({
        title: "Fehler beim Speichern",
        description: err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSavedPdfPath(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>Mahnung vorbereiten</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Schritt-Indikator */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
            <div className={`flex items-center gap-1.5 font-medium ${savedPdfPath ? 'text-green-600' : 'text-foreground'}`}>
              {savedPdfPath
                ? <CheckCircle className="h-4 w-4" />
                : <span className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">1</span>
              }
              Speichern
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-1.5 font-medium ${savedPdfPath ? 'text-foreground' : 'text-muted-foreground'}`}>
              <span className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">2</span>
              Per E-Mail senden
            </div>
          </div>

          {/* Mahnstufe */}
          <div className="text-center">
            <Badge className={`text-base px-4 py-1.5 ${getMahnstufeColor(neueMahnstufe)}`}>
              {getMahnstufeText(neueMahnstufe)}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">
              Aktuelle Stufe: {currentMahnstufe} → Neue Stufe: {neueMahnstufe}
            </p>
          </div>

          <Separator />

          {/* Mieter */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Mieter</span>
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

          {/* Immobilie */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Immobilie</span>
            </div>
            {immobilieData && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="font-medium">{immobilieData.name}</p>
                <p className="text-sm text-muted-foreground">{immobilieData.adresse}</p>
              </div>
            )}
          </div>

          {/* Offene Forderungen */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Offene Forderungen</span>
              </div>
              <Badge variant="destructive" className="text-sm px-3 py-0.5">
                {gesamtbetrag.toFixed(2)} €
              </Badge>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg space-y-1.5">
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
                    {parseFloat(forderung.sollbetrag).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Status-Bereich */}
          {savedPdfPath ? (
            <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Mahnung wurde gespeichert</p>
                <p className="text-xs text-green-700">Das Dokument ist im Archiv. Jetzt per E-Mail versenden.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-700">
                Bitte zuerst speichern — danach kannst du die Mahnung per E-Mail versenden und die Mahnstufe wird auf {neueMahnstufe} erhöht.
              </p>
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isSaving || isSending}>
              {savedPdfPath ? "Schließen" : "Abbrechen"}
            </Button>

            {!savedPdfPath ? (
              <Button onClick={handleSpeichern} disabled={isSaving || !mietvertragId}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichert...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Mahnung speichern
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => onSend(savedPdfPath)}
                variant="destructive"
                disabled={isSending}
                className="min-w-[150px]"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Per E-Mail senden
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
