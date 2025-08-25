import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Euro, CheckCircle, XCircle, Clock, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MahnstufeIndicator } from "./MahnstufeIndicator";
import { useToast } from "@/hooks/use-toast";

interface PaymentHistoryWithMahnungProps {
  mietvertragId: string;
  currentMahnstufe: number;
}

export const PaymentHistoryWithMahnung = ({ mietvertragId, currentMahnstufe }: PaymentHistoryWithMahnungProps) => {
  const [isSendingMahnung, setIsSendingMahnung] = useState(false);
  const { toast } = useToast();

  // Lade Mietforderungen
  const { data: forderungen, isLoading: forderungenLoading } = useQuery({
    queryKey: ['mietforderungen', mietvertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietforderungen')
        .select('*')
        .eq('mietvertrag_id', mietvertragId)
        .order('sollmonat', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Lade Zahlungen für Abgleich
  const { data: zahlungen } = useQuery({
    queryKey: ['zahlungen', mietvertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('mietvertrag_id', mietvertragId)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Lade Mietvertrag-Details
  const { data: vertrag } = useQuery({
    queryKey: ['mietvertrag', mietvertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          *,
          einheit_id (
            id,
            immobilie_id (
              name,
              adresse
            )
          )
        `)
        .eq('id', mietvertragId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Prüfe Zahlungsstatus für jede Forderung
  const getPaymentStatus = (forderung: any) => {
    if (!zahlungen) return { paid: false, paymentDate: null, isLate: false };
    
    const sollDatum = new Date(forderung.sollmonat + '-01');
    const fälligkeitsDatum = new Date(sollDatum);
    fälligkeitsDatum.setMonth(fälligkeitsDatum.getMonth() + 1);
    fälligkeitsDatum.setDate(7); // 7. des Folgemonats
    
    const matchingZahlung = zahlungen.find(z => {
      const zahlungsDatum = new Date(z.buchungsdatum);
      const toleranzStart = new Date(fälligkeitsDatum);
      toleranzStart.setDate(toleranzStart.getDate() - 7);
      const toleranzEnde = new Date(fälligkeitsDatum);
      toleranzEnde.setDate(toleranzEnde.getDate() + 7);
      
      return zahlungsDatum >= toleranzStart && 
             zahlungsDatum <= toleranzEnde &&
             Math.abs(z.betrag - forderung.sollbetrag) <= 50;
    });

    if (matchingZahlung) {
      const zahlungsDatum = new Date(matchingZahlung.buchungsdatum);
      const isLate = zahlungsDatum > fälligkeitsDatum;
      return { paid: true, paymentDate: matchingZahlung.buchungsdatum, isLate };
    }

    return { paid: false, paymentDate: null, isLate: fälligkeitsDatum < new Date() };
  };

  const handleSendMahnung = async () => {
    if (!vertrag) return;
    
    setIsSendingMahnung(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mahnung', {
        body: {
          mietvertragId,
          mahnstufe: currentMahnstufe,
          vertragData: vertrag,
          forderungen: forderungen?.filter(f => {
            const status = getPaymentStatus(f);
            return !status.paid;
          })
        }
      });

      if (error) throw error;

      toast({
        title: "Mahnung versendet",
        description: `Mahnung Stufe ${currentMahnstufe} wurde erfolgreich versendet.`,
      });
    } catch (error) {
      console.error('Fehler beim Versenden der Mahnung:', error);
      toast({
        title: "Fehler",
        description: "Mahnung konnte nicht versendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsSendingMahnung(false);
    }
  };

  if (forderungenLoading || !forderungen) {
    return (
      <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (forderungen.length === 0) {
    return (
      <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-muted rounded-lg">
              <Euro className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <span className="text-xl font-semibold">Zahlungshistorie</span>
              <p className="text-sm text-muted-foreground font-normal mt-1">Übersicht der Zahlungseingänge</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <p className="text-muted-foreground text-center">Keine Zahlungshistorie verfügbar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Euro className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <span className="text-xl font-semibold">Zahlungshistorie</span>
              <p className="text-sm text-muted-foreground font-normal mt-1">Übersicht der Zahlungseingänge</p>
            </div>
          </div>
          
          {currentMahnstufe > 0 && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Mahnstufe {currentMahnstufe}</span>
                <MahnstufeIndicator stufe={currentMahnstufe} />
              </div>
              <Button
                onClick={handleSendMahnung}
                disabled={isSendingMahnung}
                size="sm"
                className="bg-destructive hover:bg-destructive/90"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSendingMahnung ? 'Sende...' : 'Mahnung verschicken'}
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-4">
          {forderungen.map((forderung) => {
            const status = getPaymentStatus(forderung);
            
            return (
              <div key={forderung.id} className="p-6 bg-gradient-to-r from-card to-muted/20 rounded-xl border hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-full ${
                      status.paid 
                        ? status.isLate 
                          ? 'bg-orange-100 text-orange-600' 
                          : 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {status.paid ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <XCircle className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold mb-1">
                        {new Date(forderung.sollmonat + '-01').toLocaleDateString('de-DE', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {status.paid 
                            ? `Bezahlt am ${new Date(status.paymentDate!).toLocaleDateString('de-DE')}${status.isLate ? ' (verspätet)' : ''}`
                            : 'Noch ausstehend'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <p className="text-2xl font-bold">
                      {forderung.sollbetrag.toLocaleString()}€
                    </p>
                    <Badge 
                      variant={status.paid ? (status.isLate ? "secondary" : "default") : "destructive"}
                      className={`${
                        status.paid 
                          ? status.isLate
                            ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {status.paid ? (status.isLate ? '⚡ Verspätet' : '✓ Bezahlt') : '⚠ Offen'}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};