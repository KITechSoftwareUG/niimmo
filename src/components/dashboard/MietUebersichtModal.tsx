import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";

interface MietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MietUebersichtModal = ({ open, onOpenChange }: MietUebersichtModalProps) => {
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorting icon component
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };
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

  // Sortiere die Daten
  const sortedMietvertraege = useMemo(() => {
    if (!mietvertraegeData || !sortField) return mietvertraegeData;

    return [...mietvertraegeData].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'immobilie':
          aValue = a.einheiten?.immobilien?.name || '';
          bValue = b.einheiten?.immobilien?.name || '';
          break;
        case 'einheit':
          aValue = a.einheiten?.id || '';
          bValue = b.einheiten?.id || '';
          break;
        case 'mieter':
          aValue = getMieterNamen(a.id);
          bValue = getMieterNamen(b.id);
          break;
        case 'sollmiete':
          aValue = (a.kaltmiete || 0) + (a.betriebskosten || 0);
          bValue = (b.kaltmiete || 0) + (b.betriebskosten || 0);
          break;
        case 'aktuellerMonat':
          aValue = getZahlungenFuerVertrag(a.id).aktuellerMonat;
          bValue = getZahlungenFuerVertrag(b.id).aktuellerMonat;
          break;
        case 'gesamt':
          aValue = getZahlungenFuerVertrag(a.id).gesamt;
          bValue = getZahlungenFuerVertrag(b.id).gesamt;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'startDatum':
          aValue = a.start_datum ? new Date(a.start_datum) : new Date(0);
          bValue = b.start_datum ? new Date(b.start_datum) : new Date(0);
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }

      return 0;
    });
  }, [mietvertraegeData, sortField, sortDirection, zahlungenData, mieterData]);

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
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('immobilie')}
                >
                  <div className="flex items-center gap-2">
                    Immobilie
                    <SortIcon field="immobilie" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('einheit')}
                >
                  <div className="flex items-center gap-2">
                    Einheit
                    <SortIcon field="einheit" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('mieter')}
                >
                  <div className="flex items-center gap-2">
                    Mieter
                    <SortIcon field="mieter" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('sollmiete')}
                >
                  <div className="flex items-center gap-2">
                    Sollmiete
                    <SortIcon field="sollmiete" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('aktuellerMonat')}
                >
                  <div className="flex items-center gap-2">
                    Akt. Monat
                    <SortIcon field="aktuellerMonat" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('gesamt')}
                >
                  <div className="flex items-center gap-2">
                    Gesamt
                    <SortIcon field="gesamt" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSort('startDatum')}
                >
                  <div className="flex items-center gap-2">
                    Laufzeit
                    <SortIcon field="startDatum" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMietvertraege?.map((vertrag) => {
                const zahlungsStats = getZahlungenFuerVertrag(vertrag.id);
                const mieterNamen = getMieterNamen(vertrag.id);
                const sollmiete = (vertrag.kaltmiete || 0) + (vertrag.betriebskosten || 0);
                
                // Fix infinity calculation
                const calculatePercentage = (received: number, expected: number) => {
                  if (expected === 0) return 0;
                  return ((received / expected) * 100);
                };
                
                const percentage = calculatePercentage(zahlungsStats.aktuellerMonat, sollmiete);
                
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
                        {percentage.toFixed(0)}%
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
          
          {sortedMietvertraege?.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500">Keine Mietverträge gefunden</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};