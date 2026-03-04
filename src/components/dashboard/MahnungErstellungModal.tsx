import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Download, ArrowLeft, RefreshCw, Mail, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  rueckstand?: number;
}

export function MahnungErstellungModal({ 
  isOpen, 
  onClose, 
  contractData,
  rueckstand = 0
}: MahnungErstellungModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [step, setStep] = useState<'form' | 'preview' | 'email'>('form');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  
  // Email fields
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailCc, setEmailCc] = useState<string>('');

  // Editable values
  const mahnstufe = (contractData?.mahnstufe || 0) + 1;
  const [rueckstandBetrag, setRueckstandBetrag] = useState<string>("0.00");
  const [mahngebuehren, setMahngebuehren] = useState<string>(() => {
    if (mahnstufe === 1) return "5.00";
    if (mahnstufe === 2) return "10.00";
    return "15.00";
  });
  const [verzugszinsen, setVerzugszinsen] = useState<string>("0.00");
  const [zusaetzlicheKosten, setZusaetzlicheKosten] = useState<string>("0.00");
  const [zahlungsfrist, setZahlungsfrist] = useState<string>("14");

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPdfUrl(null);
      setPdfPath(null);
      setRueckstandBetrag(rueckstand.toFixed(2));
      setEmailCc('');
      
      // Set default recipient email
      const firstMieterEmail = contractData?.mieter?.[0]?.hauptmail || '';
      setEmailRecipient(firstMieterEmail);
      
      if (mahnstufe === 1) setMahngebuehren("5.00");
      else if (mahnstufe === 2) setMahngebuehren("10.00");
      else setMahngebuehren("15.00");
      
      setVerzugszinsen("0.00");
      setZusaetzlicheKosten("0.00");
      setZahlungsfrist("14");
    }
  }, [isOpen, mahnstufe, rueckstand, contractData]);

  const handleSubmit = async () => {
    if (!contractData) return;

    setIsSubmitting(true);
    try {
      console.log('📤 Erstelle Mahnung via Edge Function');

      const { data, error } = await supabase.functions.invoke('generate-mahnung-pdf', {
        body: {
          mietvertragId: contractData.mietvertrag_id,
          mahnstufe: mahnstufe,
          rueckstandBetrag: parseFloat(rueckstandBetrag),
          mahngebuehren: parseFloat(mahngebuehren),
          verzugszinsen: parseFloat(verzugszinsen),
          zusaetzlicheKosten: parseFloat(zusaetzlicheKosten),
          zahlungsfristTage: parseInt(zahlungsfrist)
        }
      });

      if (error) {
        console.error('❌ Edge Function Fehler:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Erstellen der Mahnung",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Mahnung erfolgreich erstellt');
      
      const { data: documentData, error: docError } = await supabase
        .from('dokumente')
        .select('pfad, dateityp')
        .eq('mietvertrag_id', contractData.mietvertrag_id)
        .order('hochgeladen_am', { ascending: false })
        .limit(1)
        .single();

      if (docError || !documentData) {
        console.error('❌ Dokument konnte nicht geladen werden:', docError);
        toast({
          title: "Fehler",
          description: "Das Dokument wurde erstellt, konnte aber nicht geladen werden.",
          variant: "destructive",
        });
        return;
      }

      // Store the path for email attachment
      setPdfPath(documentData.pfad);

      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(documentData.pfad!, 3600);

      if (urlError || !signedUrlData) {
        console.error('❌ URL konnte nicht erstellt werden:', urlError);
        toast({
          title: "Fehler",
          description: "Das Dokument konnte nicht geladen werden.",
          variant: "destructive",
        });
        return;
      }

      setPdfUrl(signedUrlData.signedUrl);
      setStep('preview');
      
      toast({
        title: "Mahnung erstellt",
        description: "Das Mahnungsschreiben wurde erfolgreich erstellt.",
      });
      
    } catch (err) {
      console.error('❌ Fehler beim Erstellen:', err);
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Fehler beim Erstellen der Mahnung',
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

  const handleGoToEmail = () => {
    setStep('email');
  };

  const handleSendEmail = async () => {
    if (!contractData || !emailRecipient) return;

    setIsSendingEmail(true);
    try {
      const recipientName = contractData.mieter?.map(m => `${m.vorname} ${m.nachname}`).join(' & ') || 'Mieter';
      const ccEmails = emailCc ? emailCc.split(',').map(e => e.trim()).filter(Boolean) : [];

      const { data, error } = await supabase.functions.invoke('send-mahnung', {
        body: {
          recipientEmail: emailRecipient,
          recipientName,
          ccEmails,
          mahnstufe,
          gesamtbetrag: parseFloat(rueckstandBetrag || "0") + parseFloat(mahngebuehren || "0") + parseFloat(verzugszinsen || "0") + parseFloat(zusaetzlicheKosten || "0"),
          rueckstandBetrag: parseFloat(rueckstandBetrag || "0"),
          mahngebuehren: parseFloat(mahngebuehren || "0"),
          verzugszinsen: parseFloat(verzugszinsen || "0"),
          zusaetzlicheKosten: parseFloat(zusaetzlicheKosten || "0"),
          zahlungsfristTage: parseInt(zahlungsfrist),
          immobilieName: contractData.immobilie_name || 'N/A',
          immobilieAdresse: contractData.immobilie_adresse || 'N/A',
          pdfPath: pdfPath || '',
          mietvertragId: contractData.mietvertrag_id,
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "E-Mail versendet",
        description: `Mahnung Stufe ${mahnstufe} wurde erfolgreich an ${emailRecipient} versendet.`,
      });

      onClose();
    } catch (err) {
      console.error('❌ Fehler beim E-Mail-Versand:', err);
      toast({
        title: "Fehler beim E-Mail-Versand",
        description: err instanceof Error ? err.message : 'E-Mail konnte nicht versendet werden',
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleBack = () => {
    if (step === 'email') {
      setStep('preview');
      return;
    }
    setStep('form');
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfPath(null);
    }
  };

  const handleRestart = () => {
    setStep('form');
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfPath(null);
    }
    setRueckstandBetrag(rueckstand.toFixed(2));
    if (mahnstufe === 1) setMahngebuehren("5.00");
    else if (mahnstufe === 2) setMahngebuehren("10.00");
    else setMahngebuehren("15.00");
    setVerzugszinsen("0.00");
    setZusaetzlicheKosten("0.00");
    setZahlungsfrist("14");
  };

  if (!contractData) return null;

  const parsedRueckstand = parseFloat(rueckstandBetrag || "0");
  const gesamtkosten = parsedRueckstand + 
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

              {/* Rückstand */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Rückstand</h3>
                <div>
                  <Label htmlFor="rueckstand">Rückstandsbetrag (€)</Label>
                  <Input
                    id="rueckstand"
                    type="number"
                    step="0.01"
                    value={rueckstandBetrag}
                    onChange={(e) => setRueckstandBetrag(e.target.value)}
                    className="mt-1 text-lg font-semibold"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatisch berechnet aus offenen Forderungen. Kann manuell angepasst werden.
                  </p>
                </div>
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
              <div className="p-4 bg-gradient-to-br from-destructive/5 to-destructive/10 rounded-lg border border-destructive/20">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Rückstand:</span>
                    <span>{parsedRueckstand.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
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
                  <div className="flex justify-between text-sm pt-2 border-t border-destructive/20">
                    <span className="font-semibold text-lg">Gesamtbetrag:</span>
                    <span className="font-bold text-xl text-destructive">
                      {gesamtkosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal Info */}
              <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground">
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
                disabled={isSubmitting || parsedRueckstand <= 0}
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
        ) : step === 'preview' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Mahnung Stufe {mahnstufe}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Zurück
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRestart}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Neu starten
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
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

            <div className="flex-1 overflow-auto bg-muted rounded-lg p-4">
              {pdfUrl ? (
                <iframe 
                  src={pdfUrl} 
                  title="Mahnung PDF"
                  className="w-full h-full min-h-[600px] bg-background shadow-lg rounded"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="outline" onClick={onClose}>
                Schließen
              </Button>
              <Button onClick={handleGoToEmail} variant="destructive">
                <Mail className="h-4 w-4 mr-2" />
                Per E-Mail versenden
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-destructive" />
                <span>Mahnung Stufe {mahnstufe} per E-Mail versenden</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 overflow-auto">
              {/* Summary Info */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Objekt:</span> {contractData.immobilie_name || 'N/A'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Gesamtbetrag:</span>{' '}
                  <span className="font-bold text-destructive">
                    {gesamtkosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">PDF-Anhang:</span> ✅ wird angehängt
                </div>
              </div>

              {/* Email Fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email-recipient">Empfänger E-Mail *</Label>
                  <Input
                    id="email-recipient"
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="mieter@beispiel.de"
                    className="mt-1"
                  />
                  {contractData.mieter && contractData.mieter.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Mieter: {contractData.mieter.map(m => `${m.vorname} ${m.nachname}`).join(', ')}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email-cc">CC (optional, kommagetrennt)</Label>
                  <Input
                    id="email-cc"
                    type="text"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder="kopie@beispiel.de, weitere@beispiel.de"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Email Preview */}
              <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                <p className="font-medium text-sm">E-Mail-Vorschau:</p>
                <p className="text-sm">
                  <span className="font-medium">Betreff:</span>{' '}
                  {mahnstufe === 3
                    ? `${mahnstufe}. und letzte Mahnung — Mietrückstand | ${contractData.immobilie_name || 'N/A'}`
                    : `${mahnstufe}. Mahnung — Mietrückstand | ${contractData.immobilie_name || 'N/A'}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Die E-Mail enthält ein professionelles HTML-Template mit NilImmo-Branding, 
                  Forderungsübersicht, Kostenzusammenfassung und das Mahnungs-PDF als Anhang.
                </p>
              </div>

              {/* Warning */}
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Die Mahnung wird direkt an den Mieter versendet. Bitte überprüfen Sie die E-Mail-Adresse sorgfältig.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="outline" onClick={handleBack} disabled={isSendingEmail}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zur Vorschau
              </Button>
              <Button 
                onClick={handleSendEmail} 
                disabled={isSendingEmail || !emailRecipient}
                variant="destructive"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird versendet...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Mahnung versenden
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
