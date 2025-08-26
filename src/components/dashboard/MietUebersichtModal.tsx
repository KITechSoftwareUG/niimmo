import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import React from "react";

interface MietUebersichtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrganizedPropertyGroup {
  immobilie: {
    id: string;
    name: string;
    adresse: string;
  };
  vertraege: any[];
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
  // Erweitere Datenabfrage um fehlende Felder
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
          kaution_betrag,
          einheit_id,
          einheiten (
            id,
            etage,
            qm,
            einheitentyp,
            immobilie_id,
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

  // Sortiere die Daten und organisiere sie nach Immobilien
  const organizedData = useMemo((): OrganizedPropertyGroup[] => {
    if (!mietvertraegeData) return [];

    // Gruppiere nach Immobilien
    const groupedByProperty: Record<string, OrganizedPropertyGroup> = mietvertraegeData.reduce((acc, vertrag) => {
      const immobilieId = vertrag.einheiten?.immobilie_id;
      const immobilieName = vertrag.einheiten?.immobilien?.name || 'Unbekannte Immobilie';
      
      if (!acc[immobilieId]) {
        acc[immobilieId] = {
          immobilie: {
            id: immobilieId,
            name: immobilieName,
            adresse: vertrag.einheiten?.immobilien?.adresse || ''
          },
          vertraege: []
        };
      }
      
      acc[immobilieId].vertraege.push(vertrag);
      return acc;
    }, {} as Record<string, OrganizedPropertyGroup>);

    // Sortiere Verträge innerhalb jeder Immobilie
    Object.values(groupedByProperty).forEach(group => {
      group.vertraege.sort((a, b) => {
        const aEinheitId = parseInt(a.einheiten?.id || '0');
        const bEinheitId = parseInt(b.einheiten?.id || '0');
        return aEinheitId - bEinheitId;
      });
    });

    return Object.values(groupedByProperty);
  }, [mietvertraegeData]);

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
              <TableRow className="bg-gray-100">
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('lfdNr')}
                >
                  <div className="flex items-center justify-center gap-1">
                    lfd. Nr
                    <SortIcon field="lfdNr" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('einheit')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Einh.
                    <SortIcon field="einheit" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('mieter')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Mieter
                    <SortIcon field="mieter" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('lage')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Lage
                    <SortIcon field="lage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('nutzung')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Nutzung
                    <SortIcon field="nutzung" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('flaeche')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Fläche
                    <SortIcon field="flaeche" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('preisProQm')}
                >
                  <div className="flex items-center justify-center gap-1">
                    €/m²
                    <SortIcon field="preisProQm" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('kaltmiete')}
                >
                  <div className="flex items-center justify-center gap-1">
                    KM
                    <SortIcon field="kaltmiete" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('betriebskosten')}
                >
                  <div className="flex items-center justify-center gap-1">
                    BKV
                    <SortIcon field="betriebskosten" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('gesamtmiete')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Gesamtmiete
                    <SortIcon field="gesamtmiete" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('mietbeginn')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Mietbeginn
                    <SortIcon field="mietbeginn" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('letzteMieterhoehung')}
                >
                  <div className="flex items-center justify-center gap-1">
                    letzte Mieterh.
                    <SortIcon field="letzteMieterhoehung" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none border-r text-center font-bold text-xs"
                  onClick={() => handleSort('laufzeit')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Laufzeit
                    <SortIcon field="laufzeit" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-150 select-none text-center font-bold text-xs"
                  onClick={() => handleSort('kaution')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Kaution
                    <SortIcon field="kaution" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizedData.map((propertyGroup, propertyIndex) => {
                let laufendeNummer = 1;
                
                return (
                  <React.Fragment key={propertyGroup.immobilie.id}>
                    {/* Property Header Row */}
                    <TableRow className="bg-blue-50 font-bold">
                      <TableCell colSpan={14} className="text-left font-bold text-sm">
                        Obj. {propertyIndex + 1} {propertyGroup.immobilie.name}
                      </TableCell>
                    </TableRow>
                    
                    {/* Unit Rows */}
                    {propertyGroup.vertraege.map((vertrag, index) => {
                      const mieterNamen = getMieterNamen(vertrag.id);
                      const gesamtmiete = (vertrag.kaltmiete || 0) + (vertrag.betriebskosten || 0);
                      const preisProQm = vertrag.einheiten?.qm ? (vertrag.kaltmiete || 0) / (vertrag.einheiten.qm || 1) : 0;
                      
                      return (
                        <TableRow key={vertrag.id} className="border-b">
                          {/* lfd. Nr */}
                          <TableCell className="text-center text-xs border-r">
                            {laufendeNummer++}
                          </TableCell>
                          
                          {/* Einh. */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.einheiten?.id || '-'}
                          </TableCell>
                          
                          {/* Mieter */}
                          <TableCell className="text-xs border-r">
                            {mieterNamen || '-'}
                          </TableCell>
                          
                          {/* Lage */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.einheiten?.etage || '-'}
                          </TableCell>
                          
                          {/* Nutzung */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.einheiten?.einheitentyp || 'Wohnung'}
                          </TableCell>
                          
                          {/* Fläche */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.einheiten?.qm ? `${vertrag.einheiten.qm}m²` : '-'}
                          </TableCell>
                          
                          {/* €/m² */}
                          <TableCell className="text-center text-xs border-r">
                            {preisProQm > 0 ? `${preisProQm.toFixed(2)} €` : '-'}
                          </TableCell>
                          
                          {/* KM */}
                          <TableCell className="text-center text-xs border-r">
                            {(vertrag.kaltmiete || 0).toLocaleString()} €
                          </TableCell>
                          
                          {/* BKV */}
                          <TableCell className="text-center text-xs border-r">
                            {(vertrag.betriebskosten || 0).toLocaleString()} €
                          </TableCell>
                          
                          {/* Gesamtmiete */}
                          <TableCell className="text-center text-xs font-medium border-r">
                            {gesamtmiete.toLocaleString()} €
                          </TableCell>
                          
                          {/* Mietbeginn */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.start_datum ? new Date(vertrag.start_datum).toLocaleDateString('de-DE') : '-'}
                          </TableCell>
                          
                          {/* letzte Mieterh. */}
                          <TableCell className="text-center text-xs border-r">
                            1/0/1900
                          </TableCell>
                          
                          {/* Laufzeit */}
                          <TableCell className="text-center text-xs border-r">
                            {vertrag.status === 'gekuendigt' && vertrag.kuendigungsdatum 
                              ? new Date(vertrag.kuendigungsdatum).toLocaleDateString('de-DE')
                              : vertrag.ende_datum 
                                ? new Date(vertrag.ende_datum).toLocaleDateString('de-DE')
                                : 'unbefristet'
                            }
                          </TableCell>
                          
                          {/* Kaution */}
                          <TableCell className="text-center text-xs">
                            {vertrag.kaution_betrag ? `${vertrag.kaution_betrag.toLocaleString()} €` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          
          {organizedData?.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500">Keine Mietverträge gefunden</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};