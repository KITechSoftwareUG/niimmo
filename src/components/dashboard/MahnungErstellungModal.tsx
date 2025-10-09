import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Download, FileText } from "lucide-react";
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!contractData) return;

    setIsSubmitting(true);
    setPdfUrl(null);
    
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
        mahnstufe: contractData.mahnstufe || 0,
        mieter: contractData.mieter || [],
        offene_forderungen: offeneForderungen
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
          
          toast({
            title: "Mahnung erstellt",
            description: "Das Mahnungs-PDF wurde erfolgreich erstellt.",
          });
        } 
        // Check if response is JSON with PDF URL or base64
        else if (contentType?.includes('application/json')) {
          const data = await response.json();
          console.log('📥 Response Data:', data);
          
          if (data.pdf_url) {
            setPdfUrl(data.pdf_url);
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
          }
          
          toast({
            title: "Mahnung erstellt",
            description: "Das Mahnungs-PDF wurde erfolgreich erstellt.",
          });
        } else {
          toast({
            title: "Mahnung gestartet",
            description: "Die Mahnung wird erstellt.",
          });
        }
      } else {
        console.error('❌ Webhook Fehler - Status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
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
        description: 'Fehler beim Senden der Anfrage',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Mahnung_${contractData?.mietvertrag_id?.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download gestartet",
      description: "Das PDF wird heruntergeladen.",
    });
  };

  if (!contractData) return null;

  const gesamtbetrag = offeneForderungen.reduce((sum, f) => sum + f.sollbetrag, 0);
  const mahnstufe = (contractData.mahnstufe || 0) + 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span>Mahnung erstellen - Stufe {mahnstufe}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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

          {/* Warning for Mahnstufe */}
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

          {/* Summary */}
          <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">Gesamtrückstand:</span>
              <span className="font-bold text-2xl text-red-800">
                {gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          </div>

          {/* PDF Viewer/Download */}
          {pdfUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Mahnung PDF</h3>
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF herunterladen
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden" style={{ height: '500px' }}>
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title="Mahnung PDF"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {pdfUrl ? 'Schließen' : 'Abbrechen'}
          </Button>
          {!pdfUrl && (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
