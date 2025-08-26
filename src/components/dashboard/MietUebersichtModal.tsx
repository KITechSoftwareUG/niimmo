import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MietUebersichtModal = ({ open, onOpenChange }: MietUebersichtModalProps) => {
  // Hole alle Mietverträge mit den zugehörigen Daten
  const { data: mietvertraegeData, isLoading } = useQuery({
    queryKey: ['miet-uebersicht'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          kaltmiete,
          betriebskosten,
          status,
          start_datum,
          ende_datum,
          kuendigungsdatum,
          einheiten (
            id,
            etage,
            qm,
            immobilien (
              id,
              name,
              adresse
            )
          )
        `)
        .order('start_datum', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  // Hole Zahlungen für alle Mietverträge
  const { data: zahlungenData } = useQuery({
    queryKey: ['zahlungen-uebersicht'],
    queryFn: async () => {
      if (!mietvertraegeData) return [];
      
      const mietvertragIds = mietvertraegeData.map(mv => mv.id);
      
      const { data, error } = await supabase
        .from('zahlungen')
        .select('mietvertrag_id, betrag, buchungsdatum')
        .in('mietvertrag_id', mietvertragIds)
        .eq('kategorie', 'Miete');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!mietvertraegeData && open
  });

  // Hole Mieter für alle Mietverträge
  const { data: mieterData } = useQuery({
    queryKey: ['mieter-uebersicht'],
    queryFn: async () => {
      if (!mietvertraegeData) return [];
      
      const mietvertragIds = mietvertraegeData.map(mv => mv.id);
      
      const { data, error } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          mietvertrag_id,
          mieter (
            id,
            vorname,
            nachname
          )
        `)
        .in('mietvertrag_id', mietvertragIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!mietvertraegeData && open
  });

  // Berechne Zahlungsstatistiken pro Mietvertrag
  const getZahlungenFuerVertrag = (mietvertragId: string) => {
    const heute = new Date();
    const aktuellerMonat = heute.getMonth();
    const aktuellesJahr = heute.getFullYear();
    
    const zahlungenFuerVertrag = zahlungenData?.filter(z => z.mietvertrag_id === mietvertragId) || [];
    
    // Zahlungen für aktuellen Monat
    const aktuelleMonatZahlungen = zahlungenFuerVertrag.filter(z => {
      const buchungsdatum = new Date(z.buchungsdatum);
      return buchungsdatum.getMonth() === aktuellerMonat && buchungsdatum.getFullYear() === aktuellesJahr;
    });
    
    const summeAktuellerMonat = aktuelleMonatZahlungen.reduce((sum, z) => sum + (z.betrag || 0), 0);
    const gesamtZahlungen = zahlungenFuerVertrag.reduce((sum, z) => sum + (z.betrag || 0), 0);
    
    return {
      aktuellerMonat: summeAktuellerMonat,
      gesamt: gesamtZahlungen,
      anzahlZahlungen: zahlungenFuerVertrag.length
    };
  };

  // Hole Mieternamen für Vertrag
  const getMieterNamen = (mietvertragId: string) => {
    const mieterFuerVertrag = mieterData?.filter(m => m.mietvertrag_id === mietvertragId) || [];
    return mieterFuerVertrag
      .map(m => `${m.mieter.vorname} ${m.mieter.nachname}`)
      .join(', ');
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Mietübersicht wird geladen...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Mietübersicht - Alle Verträge</DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Immobilie</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead>Mieter</TableHead>
                <TableHead>Sollmiete</TableHead>
                <TableHead>Akt. Monat</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Laufzeit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mietvertraegeData?.map((vertrag) => {
                const zahlungsStats = getZahlungenFuerVertrag(vertrag.id);
                const mieterNamen = getMieterNamen(vertrag.id);
                const sollmiete = (vertrag.kaltmiete || 0) + (vertrag.betriebskosten || 0);
                
                return (
                  <TableRow key={vertrag.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-sm">
                            {vertrag.einheiten?.immobilien?.name || 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {vertrag.einheiten?.immobilien?.adresse || 'N/A'}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <p>ID: {vertrag.einheiten?.id || 'N/A'}</p>
                        <p className="text-xs text-gray-500">
                          {vertrag.einheiten?.etage ? `${vertrag.einheiten.etage}. OG` : ''} 
                          {vertrag.einheiten?.qm ? ` • ${vertrag.einheiten.qm}m²` : ''}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{mieterNamen || 'Kein Mieter'}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm font-medium">
                        €{sollmiete.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Kalt: €{(vertrag.kaltmiete || 0).toLocaleString()} 
                        + NK: €{(vertrag.betriebskosten || 0).toLocaleString()}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm font-medium">
                        €{zahlungsStats.aktuellerMonat.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {zahlungsStats.aktuellerMonat >= sollmiete ? '✅' : '❌'} 
                        {((zahlungsStats.aktuellerMonat / sollmiete) * 100).toFixed(0)}%
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        €{zahlungsStats.gesamt.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {zahlungsStats.anzahlZahlungen} Zahlungen
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant={
                          vertrag.status === 'aktiv' ? 'default' : 
                          vertrag.status === 'gekuendigt' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        {vertrag.status}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <p>Start: {vertrag.start_datum ? new Date(vertrag.start_datum).toLocaleDateString('de-DE') : 'N/A'}</p>
                        {vertrag.kuendigungsdatum && (
                          <p className="text-red-600">
                            Kündigung: {new Date(vertrag.kuendigungsdatum).toLocaleDateString('de-DE')}
                          </p>
                        )}
                        {vertrag.ende_datum && (
                          <p>Ende: {new Date(vertrag.ende_datum).toLocaleDateString('de-DE')}</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {mietvertraegeData?.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500">Keine Mietverträge gefunden</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};