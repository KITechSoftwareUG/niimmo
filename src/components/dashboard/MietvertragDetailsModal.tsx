import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Euro, 
  Calendar, 
  FileText, 
  CreditCard, 
  Building2,
  Users,
  Download,
  AlertCircle
} from "lucide-react";
import { Loader2 } from "lucide-react";

interface MietvertragDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string;
  einheit?: any;
  immobilie?: any;
}

export const MietvertragDetailsModal = ({ 
  isOpen, 
  onClose, 
  vertragId, 
  einheit, 
  immobilie 
}: MietvertragDetailsModalProps) => {
  const { data: vertrag, isLoading: vertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select('*')
        .eq('id', vertragId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!vertragId
  });

  const { data: mieter } = useQuery({
    queryKey: ['mietvertrag-mieter-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mieter:mieter_id (
            id,
            vorname,
            nachname,
            hauptmail,
            telnr,
            geburtsdatum
          )
        `)
        .eq('mietvertrag_id', vertragId);
      
      if (error) throw error;
      return data?.map(mm => mm.mieter) || [];
    },
    enabled: isOpen && !!vertragId
  });

  const { data: zahlungen } = useQuery({
    queryKey: ['zahlungen-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!vertragId
  });

  const { data: dokumente } = useQuery({
    queryKey: ['dokumente-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!vertragId
  });

  const formatDatum = (datum: string) => {
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatBetrag = (betrag: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag);
  };

  const gesamtZahlungen = zahlungen?.reduce((sum, zahlung) => sum + (Number(zahlung.betrag) || 0), 0) || 0;
  const sollMiete = vertrag ? (Number(vertrag.kaltmiete) || 0) + (Number(vertrag.betriebskosten) || 0) : 0;

  if (vertragLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Mietvertrag Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Grundinformationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Grundinformationen</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Immobilie</p>
                  <p className="font-semibold">{immobilie?.name}</p>
                  <p className="text-sm text-gray-500">{immobilie?.adresse}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Einheit</p>
                  <p className="font-semibold">
                    Einheit {einheit?.nummer || 'N/A'} • {einheit?.qm && `${einheit.qm} m²`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Mietbeginn</p>
                  <p className="font-semibold">
                    {vertrag?.start_datum ? formatDatum(vertrag.start_datum) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge className={
                    vertrag?.status === 'aktiv' ? 'bg-green-600' : 
                    vertrag?.status === 'gekuendigt' ? 'bg-yellow-600' :
                    vertrag?.status === 'beendet' ? 'bg-red-600' : 'bg-gray-600'
                  }>
                    {vertrag?.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mieter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Mieter ({mieter?.length || 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mieter && mieter.length > 0 ? (
                <div className="space-y-3">
                  {mieter.map((m, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <p className="font-semibold">{m.vorname} {m.nachname}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                        <p>Email: {m.hauptmail || 'N/A'}</p>
                        <p>Telefon: {m.telnr || 'N/A'}</p>
                        <p>Geburtsdatum: {m.geburtsdatum ? formatDatum(m.geburtsdatum) : 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Keine Mieter zugeordnet</p>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="zahlungen" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="zahlungen">Zahlungen</TabsTrigger>
              <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
            </TabsList>

            <TabsContent value="zahlungen" className="space-y-4">
              {/* Zahlungsübersicht */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Euro className="h-5 w-5" />
                    <span>Zahlungsübersicht</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Kaltmiete</p>
                      <p className="font-semibold text-lg">{formatBetrag(Number(vertrag?.kaltmiete) || 0)}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Betriebskosten</p>
                      <p className="font-semibold text-lg">{formatBetrag(Number(vertrag?.betriebskosten) || 0)}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Gesamtmiete</p>
                      <p className="font-semibold text-lg">{formatBetrag(sollMiete)}</p>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Eingegangene Zahlungen</p>
                      <p className="font-semibold text-lg text-green-600">{formatBetrag(gesamtZahlungen)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kaution</p>
                      <p className="font-semibold text-lg">{formatBetrag(Number(vertrag?.kaution_betrag) || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Zahlungsliste */}
              <Card>
                <CardHeader>
                  <CardTitle>Zahlungshistorie</CardTitle>
                </CardHeader>
                <CardContent>
                  {zahlungen && zahlungen.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {zahlungen.map((zahlung) => (
                        <div key={zahlung.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{formatBetrag(Number(zahlung.betrag))}</p>
                              <p className="text-sm text-gray-600">
                                {zahlung.buchungsdatum ? formatDatum(zahlung.buchungsdatum) : 'N/A'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {zahlung.verwendungszweck || 'Kein Verwendungszweck'}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {zahlung.kategorie || 'Sonstige'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Keine Zahlungen gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dokumente" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Dokumente ({dokumente?.length || 0})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dokumente && dokumente.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {dokumente.map((dokument) => (
                        <div key={dokument.id} className="p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold">{dokument.titel || 'Unbenanntes Dokument'}</p>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                <span>{dokument.dateityp || 'N/A'}</span>
                                <span>{dokument.hochgeladen_am ? formatDatum(dokument.hochgeladen_am) : 'N/A'}</span>
                                {dokument.groesse_bytes && (
                                  <span>{Math.round(dokument.groesse_bytes / 1024)} KB</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                von: {dokument.erstellt_von || 'Unbekannt'}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">
                                {dokument.kategorie || 'Sonstige'}
                              </Badge>
                              <Download className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Keine Dokumente gefunden</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};