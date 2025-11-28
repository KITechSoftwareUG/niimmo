import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Download, FileText, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MahnungErstellungModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractData: {
    mietvertrag_id: string;
    current_kaltmiete: number;
    current_betriebskosten: number;
    letzte_mieterhoehung_am: string | null;
    start_datum: string;
    einheit_id?: string;
    immobilie_id?: string;
    immobilie_name?: string;
    immobilie_adresse?: string;
    mahnstufe?: number;
    mieter?: Array<{
      vorname: string;
      nachname: string;
      hauptmail: string | null;
      telnr: string | null;
    }>;
  } | null;
  offeneForderungen?: Array<{
    id: string;
    sollmonat: string;
    sollbetrag: number;
    ist_faellig: boolean;
  }>;
}

export function MahnungErstellungModal({ 
  isOpen, 
  onClose, 
  contractData,
  offeneForderungen = []
}: MahnungErstellungModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  // Editable values
  const mahnstufe = (contractData?.mahnstufe || 0) + 1;
  const [mahngebuehren, setMahngebuehren] = useState<string>(() => {
    // Gestaffelte Mahngebühren nach Mahnstufe
    if (mahnstufe === 1) return "5.00";
    if (mahnstufe === 2) return "10.00";
    return "15.00";
  });
  const [verzugszinsen, setVerzugszinsen] = useState<string>("0.00");
  const [zusaetzlicheKosten, setZusaetzlicheKosten] = useState<string>("0.00");
  const [zahlungsfrist, setZahlungsfrist] = useState<string>("14");

  // Reset when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPdfUrl(null);
      
      // Reset values based on mahnstufe
      if (mahnstufe === 1) setMahngebuehren("5.00");
      else if (mahnstufe === 2) setMahngebuehren("10.00");
      else setMahngebuehren("15.00");
      
      setVerzugszinsen("0.00");
      setZusaetzlicheKosten("0.00");
      setZahlungsfrist("14");
    }
  }, [isOpen, mahnstufe]);

  const handleSubmit = async () => {
    if (!contractData) return;

    setIsSubmitting(true);
    try {
      const payload = {
        mahnung: true,
        mietvertrag_id: contractData.mietvertrag_id,
        current_kaltmiete: contractData.current_kaltmiete,
        current_betriebskosten: contractData.current_betriebskosten,
        letzte_mieterhoehung_am: contractData.letzte_mieterhoehung_am,
        start_datum: contractData.start_datum,
        einheit_id: contractData.einheit_id,
        immobilie_id: contractData.immobilie_id,
        immobilie_name: contractData.immobilie_name,
        immobilie_adresse: contractData.immobilie_adresse,
        mahnstufe: mahnstufe,
        mieter: contractData.mieter || [],
        offene_forderungen: offeneForderungen,
        mahngebuehren: parseFloat(mahngebuehren),
        verzugszinsen: parseFloat(verzugszinsen),
        zusaetzliche_kosten: parseFloat(zusaetzlicheKosten),
        zahlungsfrist_tage: parseInt(zahlungsfrist)
      };
      
      console.log('📤 Sende Mahnung an Webhook:', payload);
      
      const webhookUrl = 'https://k01-2025-u36730.vm.elestio.app/webhook/6fb34c33-670a-499b-ad45-6067ad7b5920';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('📥 Response Status:', response.status);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // Check if response is PDF
        if (contentType?.includes('application/pdf')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          setPdfUrl(url);
          setStep('preview');
          
          toast({
            title: "Mahnung erstellt",
            description: "Das Mahnungs-PDF wurde erfolgreich erstellt.",
          });
        } 
        // Check if response is JSON
        else if (contentType?.includes('application/json')) {
          const data = await response.json();
          console.log('📥 Response Data:', data);
          
          if (data.pdf_url) {
            setPdfUrl(data.pdf_url);
            setStep('preview');
          } else if (data.pdf_base64) {
            // Convert base64 to blob
            const byteCharacters = atob(data.pdf_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            setStep('preview');
          }
          
          toast({
            title: "Mahnung erstellt",
            description: "Das Mahnungs-PDF wurde erfolgreich erstellt.",
          });
        } else {
          toast({
            title: "Mahnung wird erstellt",
            description: "Die Mahnung wird im Hintergrund erstellt.",
          });
        }
      } else {
        console.error('❌ Webhook Fehler - Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error Response:', errorText);
        
        toast({
          title: "Fehler",
          description: `Fehler beim Erstellen der Mahnung (Status: ${response.status})`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('❌ Fehler beim Senden:', err);
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Fehler beim Senden der Anfrage',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mahnung_Stufe${mahnstufe}_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: "Das Mahnungs-PDF wurde heruntergeladen.",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Fehler",
        description: "Download fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = () => {
    setStep('form');
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  const handleRestart = () => {
    setStep('form');
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    
    // Reset values based on mahnstufe
    if (mahnstufe === 1) setMahngebuehren("5.00");
    else if (mahnstufe === 2) setMahngebuehren("10.00");
    else setMahngebuehren("15.00");
    
    setVerzugszinsen("0.00");
    setZusaetzlicheKosten("0.00");
    setZahlungsfrist("14");
  };

  if (!contractData) return null;

  const gesamtforderungen = offeneForderungen.reduce((sum, f) => sum + f.sollbetrag, 0);
  const gesamtkosten = gesamtforderungen + 
    parseFloat(mahngebuehren || "0") + 
    parseFloat(verzugszinsen || "0") + 
    parseFloat(zusaetzlicheKosten || "0");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span>Mahnung erstellen - Stufe {mahnstufe}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 overflow-auto">
              {/* Contract Info */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Objekt:</span> {contractData.immobilie_name || 'N/A'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Adresse:</span> {contractData.immobilie_adresse || 'N/A'}
                </div>
                {contractData.mieter && contractData.mieter.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Mieter:</span> {contractData.mieter.map(m => `${m.vorname} ${m.nachname}`).join(', ')}
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium">Aktuelle Mahnstufe:</span> {contractData.mahnstufe || 0}
                </div>
              </div>

              {/* Warning for Mahnstufe 3 */}
              {mahnstufe >= 3 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Dies ist die letzte Mahnung (Stufe 3). Bei Nichtzahlung können rechtliche Schritte eingeleitet werden.
                  </AlertDescription>
                </Alert>
              )}

              {/* Offene Forderungen */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Offene Forderungen</h3>
                
                {offeneForderungen.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Keine offenen Forderungen gefunden. Eine Mahnung kann nicht erstellt werden.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {offeneForderungen.map((forderung) => {
                      const monat = new Date(forderung.sollmonat + '-01').toLocaleDateString('de-DE', { 
                        month: 'long', 
                        year: 'numeric' 
                      });
                      
                      return (
                        <div key={forderung.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-red-600" />
                            <span className="font-medium">{monat}</span>
                            {forderung.ist_faellig && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Fällig</span>
                            )}
                          </div>
                          <span className="font-bold text-red-800">
                            {forderung.sollbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Editable Costs */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Zusätzliche Kosten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mahngebuehren">Mahngebühren (€)</Label>
                    <Input
                      id="mahngebuehren"
                      type="number"
                      step="0.01"
                      value={mahngebuehren}
                      onChange={(e) => setMahngebuehren(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="verzugszinsen">Verzugszinsen (€)</Label>
                    <Input
                      id="verzugszinsen"
                      type="number"
                      step="0.01"
                      value={verzugszinsen}
                      onChange={(e) => setVerzugszinsen(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zusaetzliche-kosten">Zusätzliche Kosten (€)</Label>
                    <Input
                      id="zusaetzliche-kosten"
                      type="number"
                      step="0.01"
                      value={zusaetzlicheKosten}
                      onChange={(e) => setZusaetzlicheKosten(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zahlungsfrist">Zahlungsfrist (Tage)</Label>
                    <Input
                      id="zahlungsfrist"
                      type="number"
                      value={zahlungsfrist}
                      onChange={(e) => setZahlungsfrist(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Offene Forderungen:</span>
                    <span>{gesamtforderungen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Mahngebühren:</span>
                    <span>{parseFloat(mahngebuehren || "0").toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Verzugszinsen:</span>
                    <span>{parseFloat(verzugszinsen || "0").toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Zusätzliche Kosten:</span>
                    <span>{parseFloat(zusaetzlicheKosten || "0").toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-red-200">
                    <span className="font-semibold text-lg">Gesamtbetrag:</span>
                    <span className="font-bold text-xl text-red-800">
                      {gesamtkosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal Info */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-gray-700">
                <p className="font-medium mb-1">Hinweise:</p>
                <ul className="space-y-1">
                  <li>• Die Zahlungsfrist beginnt mit Zugang des Mahnschreibens</li>
                  <li>• Bei Nichtzahlung nach der {mahnstufe}. Mahnung können rechtliche Schritte eingeleitet werden</li>
                  <li>• Mahngebühren sind gesetzlich zulässig und decken den Verwaltungsaufwand</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || offeneForderungen.length === 0}
                variant="destructive"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  `Mahnung Stufe ${mahnstufe} erstellen`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Mahnung Stufe {mahnstufe}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Zurück
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestart}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Neu starten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="ml-2">Download</span>
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-auto bg-gray-100 rounded-lg p-4">
              {pdfUrl ? (
                <iframe 
                  src={pdfUrl} 
                  title="Mahnung PDF"
                  className="w-full h-full min-h-[600px] bg-white shadow-lg rounded"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={onClose}>
                Schließen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
