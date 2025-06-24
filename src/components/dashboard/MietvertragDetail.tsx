
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Euro, User, FileText, CheckCircle, XCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

interface MietvertragDetailProps {
  vertragId: string;
  onBack: () => void;
}

export const MietvertragDetail = ({ vertragId, onBack }: MietvertragDetailProps) => {
  const { data: vertrag, isLoading: vertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertraege')
        .select('*')
        .eq('id', vertragId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: einheit } = useQuery({
    queryKey: ['einheit-detail', vertrag?.einheit_id],
    queryFn: async () => {
      if (!vertrag?.einheit_id) return null;
      
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('id', vertrag.einheit_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vertrag?.einheit_id
  });

  const { data: immobilie } = useQuery({
    queryKey: ['immobilie-detail', einheit?.immobilie_id],
    queryFn: async () => {
      if (!einheit?.immobilie_id) return null;
      
      const { data, error } = await supabase
        .from('immobilien')
        .select('*')
        .eq('id', einheit.immobilie_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!einheit?.immobilie_id
  });

  const { data: mieter } = useQuery({
    queryKey: ['mietvertrag-mieter', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          rolle,
          mieter:mieter_id (
            Vorname,
            Nachname,
            hauptmail,
            weitere_mails
          )
        `)
        .eq('mietvertrag_id', vertragId);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: dokumente } = useQuery({
    queryKey: ['dokumente', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Simulate payment history since mietzahlungen table doesn't exist in types
  const simulatedPayments = vertrag ? [
    {
      id: '1',
      monat: new Date().toISOString().split('T')[0],
      betrag: vertrag.kaltmiete || 0,
      bezahlt_am: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString() : null
    },
    {
      id: '2', 
      monat: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      betrag: vertrag.kaltmiete || 0,
      bezahlt_am: new Date(Date.now() - (30 + Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
    }
  ] : [];

  if (vertragLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Badge variant={vertrag?.status === 'aktiv' ? 'default' : 'secondary'}>
          {vertrag?.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Mietvertrag Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Einheit</label>
              <p>{einheit?.id?.slice(0, 8) || 'Keine ID'}</p>
              <p className="text-sm text-gray-600">{einheit?.etage || 'Keine Etage'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Immobilie</label>
              <p>{immobilie?.name}</p>
              <p className="text-sm text-gray-600">{immobilie?.adresse}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Kaltmiete</label>
              <p className="text-lg font-semibold">{vertrag?.kaltmiete}€</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Warmmiete</label>
              <p className="text-lg font-semibold">{vertrag?.warmmiete || 'Nicht angegeben'}€</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Vertragsbeginn</label>
              <p>{vertrag?.start_datum ? new Date(vertrag.start_datum).toLocaleDateString('de-DE') : 'Nicht angegeben'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Vertragsende</label>
              <p>{vertrag?.ende_datum ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE') : 'Unbefristet'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {mieter && mieter.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Mieter</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mieter.map((m, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {m.mieter?.Vorname} {m.mieter?.Nachname}
                      </p>
                      <p className="text-sm text-gray-600">{m.mieter?.hauptmail}</p>
                      {m.mieter?.weitere_mails && (
                        <p className="text-sm text-gray-600">{m.mieter.weitere_mails}</p>
                      )}
                    </div>
                    {m.rolle && (
                      <Badge variant="outline">{m.rolle}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {simulatedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Euro className="h-5 w-5" />
              <span>Zahlungshistorie (Beispiel)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {simulatedPayments.map((zahlung) => (
                <div key={zahlung.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {zahlung.bezahlt_am ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {new Date(zahlung.monat).toLocaleDateString('de-DE', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {zahlung.bezahlt_am 
                          ? `Bezahlt am ${new Date(zahlung.bezahlt_am).toLocaleDateString('de-DE')}`
                          : 'Noch offen'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{zahlung.betrag}€</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dokumente && dokumente.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Dokumente</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dokumente.map((dokument) => (
                <div key={dokument.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{dokument.titel || 'Unbenanntes Dokument'}</p>
                    <p className="text-sm text-gray-600">
                      Hochgeladen am {dokument.hochgeladen_am ? new Date(dokument.hochgeladen_am).toLocaleDateString('de-DE') : 'Unbekannt'}
                    </p>
                  </div>
                  <Badge variant="outline">{dokument.dateityp || 'Unbekannt'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
