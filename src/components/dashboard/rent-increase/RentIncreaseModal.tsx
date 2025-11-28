import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, ArrowLeft, RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RentIncreaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractData: {
    mietvertrag_id: string;
    current_kaltmiete: number;
    current_betriebskosten: number;
    letzte_mieterhoehung_am: string | null;
    start_datum: string;
    months_since_last_increase: number;
    months_since_start: number;
    einheit_id?: string;
    immobilie_id?: string;
    immobilie_name?: string;
    immobilie_adresse?: string;
    mieter?: Array<{
      vorname: string;
      nachname: string;
      hauptmail: string | null;
      telnr: string | null;
    }>;
  } | null;
}

export function RentIncreaseModal({ isOpen, onClose, contractData }: RentIncreaseModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Calculate suggested rent (4% increase)
  const suggestedRent = contractData ? contractData.current_kaltmiete * 1.04 : 0;
  
  const [neueKaltmiete, setNeueKaltmiete] = useState(suggestedRent.toFixed(2));
  const [neueBetriebskosten, setNeueBetriebskosten] = useState(
    contractData?.current_betriebskosten.toFixed(2) || "0.00"
  );

  // Reset when modal closes or opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPdfUrl(null);
      if (contractData) {
        setNeueKaltmiete((contractData.current_kaltmiete * 1.04).toFixed(2));
        setNeueBetriebskosten(contractData.current_betriebskosten.toFixed(2));
      }
    }
  }, [isOpen, contractData]);


  const handleSubmit = async () => {
    if (!contractData) return;

    setIsSubmitting(true);
    try {
      const payload = {
        mieterhoehung: true,
        mietvertrag_id: contractData.mietvertrag_id,
        current_kaltmiete: contractData.current_kaltmiete,
        neue_kaltmiete: parseFloat(neueKaltmiete),
        current_betriebskosten: contractData.current_betriebskosten,
        neue_betriebskosten: parseFloat(neueBetriebskosten),
        letzte_mieterhoehung_am: contractData.letzte_mieterhoehung_am,
        start_datum: contractData.start_datum,
        months_since_last_increase: contractData.months_since_last_increase,
        months_since_start: contractData.months_since_start,
        einheit_id: contractData.einheit_id,
        immobilie_id: contractData.immobilie_id,
        immobilie_name: contractData.immobilie_name,
        immobilie_adresse: contractData.immobilie_adresse,
        mieter: contractData.mieter || []
      };
      
      console.log('📤 Sende Mieterhöhung an Webhook:', payload);
      
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
        // Check if response contains PDF data
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/pdf') || contentType?.includes('text/html')) {
          // PDF/HTML returned directly
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          setPdfUrl(url);
          setStep('preview');
          
          toast({
            title: "Mieterhöhung erstellt",
            description: "Das Mieterhöhungsschreiben wurde erstellt.",
          });
        } else {
          // JSON response - try to fetch from database
          const responseData = await response.json();
          console.log('📥 Response Data:', responseData);
          
          toast({
            title: "Mieterhöhung gestartet",
            description: "Die Mieterhöhung wird erstellt.",
          });
          
          // Try to fetch the document from database
          setTimeout(async () => {
            const { data: documentData, error: docError } = await supabase
              .from('dokumente')
              .select('pfad')
              .eq('mietvertrag_id', contractData.mietvertrag_id)
              .order('hochgeladen_am', { ascending: false })
              .limit(1)
              .single();

            if (!docError && documentData) {
              // Get signed URL
              const { data: signedUrlData } = await supabase.storage
                .from('dokumente')
                .createSignedUrl(documentData.pfad, 3600);

              if (signedUrlData) {
                setPdfUrl(signedUrlData.signedUrl);
                setStep('preview');
              }
            }
          }, 2000);
        }
      } else {
        console.error('❌ Webhook Fehler - Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error Response:', errorText);
        toast({
          title: "Fehler",
          description: `Fehler beim Erstellen der Mieterhöhung (Status: ${response.status})`,
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
      a.download = `Mieterhoehung_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: "Das Mieterhöhungsschreiben wurde heruntergeladen.",
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
    if (contractData) {
      setNeueKaltmiete((contractData.current_kaltmiete * 1.04).toFixed(2));
      setNeueBetriebskosten(contractData.current_betriebskosten.toFixed(2));
    }
  };

  if (!contractData) return null;

  const currentTotal = contractData.current_kaltmiete + contractData.current_betriebskosten;
  const newTotal = parseFloat(neueKaltmiete || "0") + parseFloat(neueBetriebskosten || "0");
  const increase = newTotal - currentTotal;
  const increasePercent = (increase / currentTotal) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <span>Mieterhöhung erstellen</span>
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
              </div>

              {/* Current Rent */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-600">Aktuelle Kaltmiete</label>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {contractData.current_kaltmiete.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-600">Aktuelle Betriebskosten</label>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {contractData.current_betriebskosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>

              {/* New Rent - Editable */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Neue Miete festlegen</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="neue-kaltmiete">Neue Kaltmiete (€)</Label>
                    <Input
                      id="neue-kaltmiete"
                      type="number"
                      step="0.01"
                      value={neueKaltmiete}
                      onChange={(e) => setNeueKaltmiete(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="neue-betriebskosten">Neue Betriebskosten (€)</Label>
                    <Input
                      id="neue-betriebskosten"
                      type="number"
                      step="0.01"
                      value={neueBetriebskosten}
                      onChange={(e) => setNeueBetriebskosten(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Aktuelle Gesamtmiete:</span>
                    <span>{currentTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Neue Gesamtmiete:</span>
                    <span className="font-bold">{newTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-orange-200">
                    <span className="font-medium">Erhöhung:</span>
                    <span className={increase >= 0 ? "text-orange-600 font-bold" : "text-red-600 font-bold"}>
                      {increase >= 0 ? '+' : ''}{increase.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} 
                      {' '}({increasePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal Info */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-gray-700">
                <p className="font-medium mb-1">Hinweise:</p>
                <ul className="space-y-1">
                  <li>• Die neue Miete wird 3 Monate nach Zugang des Schreibens wirksam</li>
                  <li>• Mieterhöhungen sind frühestens 15 Monate nach Einzug oder der letzten Erhöhung möglich</li>
                  <li>• Eine Erhöhung darf höchstens alle 12 Monate verlangt werden</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Abbrechen
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  'Mieterhöhung erstellen'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Mieterhöhungsschreiben</span>
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
                  title="Mieterhöhungsschreiben"
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
