import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, eachMonthOfInterval, isBefore, isAfter, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  Euro,
  FileText,
  Clock,
  AlertCircle,
  CalendarDays,
  List,
  Eye,
  Download,
  CreditCard,
  Building
} from 'lucide-react';
import { toast } from 'sonner';

interface MietvertragDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertragId: string | null;
}

interface Zahlung {
  id: string;
  betrag: number;
  buchungsdatum: string;
  verwendungszweck: string;
  kategorie: string;
  mietvertrag_id: string;
  zugeordneter_monat: string | null;
}

interface Forderung {
  id: string;
  mietvertrag_id: string;
  sollmonat: string;
  sollbetrag: number;
  faelligkeitsdatum: string;
  ist_faellig: boolean;
}

interface Dokument {
  id: string;
  titel: string;
  dateityp: string;
  hochgeladen_am: string;
  pfad: string;
}

export const MietvertragDetailsModal: React.FC<MietvertragDetailsModalProps> = ({
  isOpen,
  onClose,
  vertragId,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [draggedPayment, setDraggedPayment] = useState<Zahlung | null>(null);
  const queryClient = useQueryClient();

  // Fetch Mietvertrag data
  const { data: mietvertrag } = useQuery({
    queryKey: ['mietvertrag', vertragId],
    queryFn: async () => {
      if (!vertragId) return null;
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          *,
          einheiten (
            immobilie_id,
            einheit,
            immobilien (
              bezeichnung,
              strasse,
              hausnummer,
              plz,
              ort
            )
          ),
          mietvertrag_mieter (
            mieter (
              vorname,
              nachname,
              hauptmail,
              telnr
            )
          )
        `)
        .eq('id', vertragId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vertragId && isOpen,
  });

  // Fetch Zahlungen
  const { data: zahlungen } = useQuery({
    queryKey: ['zahlungen', vertragId],
    queryFn: async () => {
      if (!vertragId) return [];
      const { data, error } = await supabase
        .from('zahlungen')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('buchungsdatum', { ascending: false });
      
      if (error) throw error;
      return data as Zahlung[];
    },
    enabled: !!vertragId && isOpen,
  });

  // Fetch Forderungen
  const { data: forderungen } = useQuery({
    queryKey: ['mietforderungen', vertragId],
    queryFn: async () => {
      if (!vertragId) return [];
      const { data, error } = await supabase
        .from('mietforderungen')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('sollmonat', { ascending: true });
      
      if (error) throw error;
      return data as Forderung[];
    },
    enabled: !!vertragId && isOpen,
  });

  // Fetch Dokumente
  const { data: dokumente } = useQuery({
    queryKey: ['dokumente', vertragId],
    queryFn: async () => {
      if (!vertragId) return [];
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data as Dokument[];
    },
    enabled: !!vertragId && isOpen,
  });

  // Generate available months (only where contract exists AND forderungen exist)
  const availableMonths = React.useMemo(() => {
    if (!mietvertrag || !forderungen) return [];
    
    const startDate = parseISO(mietvertrag.start_datum);
    const endDate = mietvertrag.ende_datum ? parseISO(mietvertrag.ende_datum) : new Date();
    
    // Get all months within contract period
    const contractMonths = eachMonthOfInterval({ start: startDate, end: endDate });
    
    // Filter to only months that have forderungen
    const forderungMonths = new Set(forderungen.map(f => f.sollmonat));
    
    return contractMonths
      .map(date => format(date, 'yyyy-MM'))
      .filter(month => forderungMonths.has(month))
      .sort((a, b) => b.localeCompare(a)); // Most recent first
  }, [mietvertrag, forderungen]);

  // Handle payment assignment
  const handlePaymentAssignment = async (zahlungId: string, targetMonth: string | null) => {
    try {
      const { error } = await supabase
        .from('zahlungen')
        .update({ zugeordneter_monat: targetMonth })
        .eq('id', zahlungId);

      if (error) throw error;

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['zahlungen', vertragId] });
      toast.success('Zahlung erfolgreich zugeordnet');
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Fehler beim Zuordnen der Zahlung');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, zahlung: Zahlung) => {
    setDraggedPayment(zahlung);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetMonth: string) => {
    e.preventDefault();
    if (draggedPayment) {
      handlePaymentAssignment(draggedPayment.id, targetMonth);
      setDraggedPayment(null);
    }
  };

  if (!mietvertrag) return null;

  // Get security deposits (Kaution)
  const kautionZahlungen = zahlungen?.filter(z => z.kategorie === 'Mietkaution') || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Mietvertrag Details - {mietvertrag.einheiten?.immobilien?.bezeichnung}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="zahlungen">Zahlungen ({zahlungen?.length || 0})</TabsTrigger>
            <TabsTrigger value="dokumente">Dokumente ({dokumente?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <span>Immobilie</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>Bezeichnung:</strong> {mietvertrag.einheiten?.immobilien?.bezeichnung}</p>
                  <p><strong>Adresse:</strong> {mietvertrag.einheiten?.immobilien?.strasse} {mietvertrag.einheiten?.immobilien?.hausnummer}</p>
                  <p>{mietvertrag.einheiten?.immobilien?.plz} {mietvertrag.einheiten?.immobilien?.ort}</p>
                  <Separator className="my-4" />
                  <p><strong>Einheit:</strong> {mietvertrag.einheiten?.einheit}</p>
                  <p><strong>Kaltmiete:</strong> {mietvertrag.kaltmiete}€</p>
                  <p><strong>Nebenkosten:</strong> {mietvertrag.betriebskosten}€</p>
                  <p><strong>Kaution:</strong> {mietvertrag.kaution_betrag}€</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Mieter & Laufzeit</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {mietvertrag.mietvertrag_mieter?.[0]?.mieter && (
                    <>
                      <p><strong>Mieter:</strong> {mietvertrag.mietvertrag_mieter[0].mieter.vorname} {mietvertrag.mietvertrag_mieter[0].mieter.nachname}</p>
                      <p><strong>E-Mail:</strong> {mietvertrag.mietvertrag_mieter[0].mieter.hauptmail}</p>
                      <p><strong>Telefon:</strong> {mietvertrag.mietvertrag_mieter[0].mieter.telnr}</p>
                    </>
                  )}
                  <Separator className="my-4" />
                  <p><strong>Beginn:</strong> {format(parseISO(mietvertrag.start_datum), 'dd.MM.yyyy', { locale: de })}</p>
                  {mietvertrag.ende_datum && (
                    <p><strong>Ende:</strong> {format(parseISO(mietvertrag.ende_datum), 'dd.MM.yyyy', { locale: de })}</p>
                  )}
                  <Badge variant={mietvertrag.status === 'aktiv' ? 'default' : 'secondary'}>
                    {mietvertrag.status}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="zahlungen" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5" />
                    <span>Zahlungsübersicht</span>
                  </CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      variant={viewMode === 'timeline' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('timeline')}
                      className="h-8"
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Timeline
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8"
                    >
                      <List className="h-4 w-4 mr-2" />
                      Liste
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === 'timeline' ? (
                  <div className="space-y-8">
                    {/* Security Deposit Section */}
                    {kautionZahlungen.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
                        <div className="flex items-center mb-4">
                          <div className="bg-purple-100 rounded-full p-2 mr-3">
                            <span className="text-purple-600 text-lg">🏠</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-purple-800">Mietkaution</h3>
                            <p className="text-sm text-purple-600">Gezahlt bei Mietbeginn</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {kautionZahlungen.map((zahlung) => (
                            <div key={zahlung.id} className="flex justify-between items-center bg-white p-3 rounded-md border border-purple-100">
                              <div>
                                <p className="font-medium text-purple-900">{zahlung.betrag}€</p>
                                <p className="text-sm text-purple-600">{format(parseISO(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}</p>
                              </div>
                              {zahlung.verwendungszweck && (
                                <p className="text-xs text-purple-500 max-w-xs truncate">
                                  {zahlung.verwendungszweck}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monthly Timeline */}
                    {availableMonths.length > 0 ? (
                      <div className="space-y-6">
                        {availableMonths.map((month) => {
                          const monthForderungen = forderungen?.filter(f => f.sollmonat === month) || [];
                          const monthZahlungen = zahlungen?.filter(z => 
                            z.zugeordneter_monat === month && z.kategorie !== 'Mietkaution'
                          ) || [];
                          const totalForderung = monthForderungen.reduce((sum, f) => sum + (f.sollbetrag || 0), 0);
                          const totalZahlung = monthZahlungen.reduce((sum, z) => sum + z.betrag, 0);
                          const saldo = totalZahlung - totalForderung;

                          return (
                            <div 
                              key={month}
                              className="border rounded-lg p-6 space-y-4"
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, month)}
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">
                                  {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: de })}
                                </h3>
                                <div className="flex space-x-4 text-sm">
                                  <span className="text-red-600">Forderung: {totalForderung}€</span>
                                  <span className="text-green-600">Zahlung: {totalZahlung}€</span>
                                  <span className={`font-medium ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Saldo: {saldo}€
                                  </span>
                                </div>
                              </div>

                              {/* Forderungen */}
                              {monthForderungen.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-gray-700">Forderungen:</h4>
                                  {monthForderungen.map((forderung) => (
                                    <div key={forderung.id} className="flex justify-between items-center bg-red-50 p-3 rounded border border-red-200">
                                      <div>
                                        <span className="font-medium">Miete</span>
                                        <p className="text-sm text-gray-600">
                                          Fällig: {forderung.faelligkeitsdatum ? format(parseISO(forderung.faelligkeitsdatum), 'dd.MM.yyyy', { locale: de }) : 'N/A'}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium text-red-600">{forderung.sollbetrag}€</p>
                                        <Badge variant={forderung.ist_faellig ? 'destructive' : 'secondary'}>
                                          {forderung.ist_faellig ? 'Fällig' : 'Offen'}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Zahlungen */}
                              {monthZahlungen.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-gray-700">Zugeordnete Zahlungen:</h4>
                                  {monthZahlungen.map((zahlung) => (
                                    <div 
                                      key={zahlung.id}
                                      className="flex justify-between items-center bg-green-50 p-3 rounded border border-green-200 cursor-move"
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, zahlung)}
                                    >
                                      <div>
                                        <p className="font-medium text-green-800">{zahlung.betrag}€</p>
                                        <p className="text-sm text-green-600">
                                          {format(parseISO(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
                                        </p>
                                      </div>
                                      {zahlung.verwendungszweck && (
                                        <p className="text-xs text-green-600 max-w-xs truncate">
                                          {zahlung.verwendungszweck}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">Keine Monate mit Forderungen gefunden</p>
                      </div>
                    )}

                    {/* Unassigned Payments */}
                    {zahlungen?.some(z => !z.zugeordneter_monat && z.kategorie !== 'Mietkaution') && (
                      <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold mb-4">Nicht zugeordnete Zahlungen</h3>
                        <div className="space-y-2">
                          {zahlungen
                            .filter(z => !z.zugeordneter_monat && z.kategorie !== 'Mietkaution')
                            .map((zahlung) => (
                              <div 
                                key={zahlung.id}
                                className="flex justify-between items-center bg-yellow-50 p-3 rounded border border-yellow-200 cursor-move"
                                draggable
                                onDragStart={(e) => handleDragStart(e, zahlung)}
                              >
                                <div>
                                  <p className="font-medium text-yellow-800">{zahlung.betrag}€</p>
                                  <p className="text-sm text-yellow-600">
                                    {format(parseISO(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {zahlung.verwendungszweck && (
                                    <p className="text-xs text-yellow-600 max-w-xs truncate">
                                      {zahlung.verwendungszweck}
                                    </p>
                                  )}
                                  <Select onValueChange={(month) => handlePaymentAssignment(zahlung.id, month)}>
                                    <SelectTrigger className="w-40 mt-2">
                                      <SelectValue placeholder="Monat zuordnen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableMonths.map((month) => (
                                        <SelectItem key={month} value={month}>
                                          {format(parseISO(`${month}-01`), 'MMM yyyy', { locale: de })}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* List View */
                  <div className="space-y-4">
                    {zahlungen && zahlungen.length > 0 ? (
                      zahlungen.map((zahlung) => (
                        <div key={zahlung.id} className="flex justify-between items-center p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{zahlung.betrag}€</p>
                            <p className="text-sm text-gray-600">
                              {format(parseISO(zahlung.buchungsdatum), 'dd.MM.yyyy', { locale: de })}
                            </p>
                            <Badge variant="outline" className="mt-1">
                              {zahlung.kategorie}
                            </Badge>
                          </div>
                          <div className="text-right">
                            {zahlung.zugeordneter_monat && (
                              <p className="text-sm text-green-600 mb-1">
                                Zugeordnet zu: {format(parseISO(`${zahlung.zugeordneter_monat}-01`), 'MMM yyyy', { locale: de })}
                              </p>
                            )}
                            {zahlung.verwendungszweck && (
                              <p className="text-xs text-gray-500 max-w-xs truncate">
                                {zahlung.verwendungszweck}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">Keine Zahlungen gefunden</p>
                      </div>
                    )}
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
                  <div className="space-y-3">
                    {dokumente.map((doc) => (
                      <div key={doc.id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium">{doc.titel}</p>
                            <p className="text-sm text-gray-600">
                              {doc.hochgeladen_am ? format(parseISO(doc.hochgeladen_am), 'dd.MM.yyyy HH:mm', { locale: de }) : 'N/A'}
                            </p>
                            <Badge variant="outline">{doc.dateityp}</Badge>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Anzeigen
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Keine Dokumente vorhanden</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
export default MietvertragDetailsModal;