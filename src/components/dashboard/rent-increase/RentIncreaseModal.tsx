import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PdfPreviewModal } from "@/components/dashboard/PdfPreviewModal";

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
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [generatedDocument, setGeneratedDocument] = useState<{
    id: string;
    titel: string;
    pfad: string;
    dateityp: string;
  } | null>(null);
  
  // Calculate suggested rent (4% increase)
  const suggestedRent = contractData ? contractData.current_kaltmiete * 1.04 : 0;
  
  const [neueKaltmiete, setNeueKaltmiete] = useState(suggestedRent.toFixed(2));
  const [neueBetriebskosten, setNeueBetriebskosten] = useState(
    contractData?.current_betriebskosten.toFixed(2) || "0.00"
  );

  // Update values when contractData changes
  useState(() => {
    if (contractData) {
      setNeueKaltmiete((contractData.current_kaltmiete * 1.04).toFixed(2));
      setNeueBetriebskosten(contractData.current_betriebskosten.toFixed(2));
    }
  });

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
          
          // Create a mock document object for the preview
          const mockDocument = {
            id: 'temp-' + Date.now(),
            titel: `Mieterhöhung ${new Date().toLocaleDateString('de-DE')}`,
            pfad: url,
            dateityp: contentType || 'application/pdf'
          };
          
          setGeneratedDocument(mockDocument);
          setPdfPreviewOpen(true);
          
          toast({
            title: "Mieterhöhung erstellt",
            description: "Das Mieterhöhungsschreiben wurde erstellt.",
          });
        } else {
          // JSON response
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
              .select('id, titel, pfad, dateityp')
              .eq('mietvertrag_id', contractData.mietvertrag_id)
              .order('hochgeladen_am', { ascending: false })
              .limit(1)
              .single();

            if (!docError && documentData) {
              setGeneratedDocument(documentData);
              setPdfPreviewOpen(true);
            }
          }, 2000);
        }
        
        onClose();
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

  if (!contractData) return null;

  const currentTotal = contractData.current_kaltmiete + contractData.current_betriebskosten;
  const newTotal = parseFloat(neueKaltmiete || "0") + parseFloat(neueBetriebskosten || "0");
  const increase = newTotal - currentTotal;
  const increasePercent = (increase / currentTotal) * 100;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <span>Mieterhöhung erstellen</span>
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
      </DialogContent>
    </Dialog>

    <PdfPreviewModal
      isOpen={pdfPreviewOpen}
      onClose={() => {
        setPdfPreviewOpen(false);
        setGeneratedDocument(null);
      }}
      dokument={generatedDocument}
    />
    </>
  );
}
