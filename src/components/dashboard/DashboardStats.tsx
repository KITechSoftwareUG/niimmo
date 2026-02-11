
import { Building2, Users, AlertTriangle, Euro, Home, TrendingDown, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStatsProps {
  immobilien: any[] | undefined;
  onNavigateToContract?: (immobilieId: string, einheitId: string, mietvertragId: string) => void;
  onShowMietUebersicht?: () => void;
}

export const DashboardStats = ({ immobilien, onNavigateToContract, onShowMietUebersicht }: DashboardStatsProps) => {
  const { data: gesamtEinheiten } = useQuery({
    queryKey: ['gesamt-einheiten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('einheiten')
        .select('id');
      if (error) throw error;
      return data?.length || 0;
    }
  });

  const { data: mietvertraege } = useQuery({
    queryKey: ['alle-mietvertrag'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
        .select(`
          id, 
          kaltmiete,
          betriebskosten,
          status, 
          ende_datum, 
          kuendigungsdatum,
          einheit_id,
          einheiten(
            id,
            immobilie_id
          )
        `);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erfassedMiete } = useQuery({
    queryKey: ['erfasste-miete'],
    queryFn: async () => {
      const heute = new Date();
      const aktuellerMonat = heute.toISOString().slice(0, 7);
      const { data: zahlungen, error } = await supabase
        .from('zahlungen')
        .select('betrag')
        .eq('kategorie', 'Miete')
        .eq('zugeordneter_monat', aktuellerMonat)
        .not('mietvertrag_id', 'is', null);
      if (error) {
        console.error('Fehler beim Laden der Zahlungen:', error);
        return 0;
      }
      return zahlungen?.reduce((sum, zahlung) => sum + (zahlung.betrag || 0), 0) || 0;
    }
  });

  const aktiveMietvertraege = mietvertraege?.filter(mv => mv.status === 'aktiv') || [];
  const gekuendigteMietvertraege = mietvertraege?.filter(mv => mv.status === 'gekuendigt') || [];
  
  const gesamtKaltmiete = aktiveMietvertraege.reduce((sum, v) => sum + (v.kaltmiete || 0), 0);
  const gesamtBetriebskosten = aktiveMietvertraege.reduce((sum, v) => sum + (v.betriebskosten || 0), 0);
  const erwartedMiete = gesamtKaltmiete + gesamtBetriebskosten;
  const differenz = erwartedMiete - (erfassedMiete || 0);
  
  const vermieteteEinheiten = aktiveMietvertraege.length + gekuendigteMietvertraege.length;
  const leerstände = gesamtEinheiten ? gesamtEinheiten - vermieteteEinheiten : 0;

  // Berechne das nächste Kündigungs- oder Auslaufdatum
  const naechstesVertragInfo = mietvertraege
    ?.reduce((frueheste: { datum: string | null, vertrag: any | null }, mv) => {
      const heute = new Date();
      const kuendigungsdatum = mv.kuendigungsdatum ? new Date(mv.kuendigungsdatum) : null;
      const auslaufdatum = mv.ende_datum ? new Date(mv.ende_datum) : null;
      let naechstesDatumFuerVertrag: Date | null = null;
      if (kuendigungsdatum && kuendigungsdatum > heute) {
        naechstesDatumFuerVertrag = kuendigungsdatum;
      }
      if (auslaufdatum && auslaufdatum > heute) {
        if (!naechstesDatumFuerVertrag || auslaufdatum < naechstesDatumFuerVertrag) {
          naechstesDatumFuerVertrag = auslaufdatum;
        }
      }
      if (!naechstesDatumFuerVertrag) return frueheste;
      const datumString = naechstesDatumFuerVertrag.toISOString().split('T')[0];
      if (!frueheste.datum) return { datum: datumString, vertrag: mv };
      return new Date(datumString) < new Date(frueheste.datum) ? { datum: datumString, vertrag: mv } : frueheste;
    }, { datum: null, vertrag: null });

  const naechstesDatum = naechstesVertragInfo?.datum;
  const naechsterVertrag = naechstesVertragInfo?.vertrag;

  const formatDatum = (datum: string | null) => {
    if (!datum) return 'Keine';
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getCurrentMonthYear = () => {
    const heute = new Date();
    return heute.toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Row 1: Drei kompakte Karten */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        {/* Immobilien */}
        <div className="metric-card p-3 sm:p-4 rounded-xl border border-blue-100 bg-blue-50" style={{ animationDelay: '0s' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 border border-blue-200 flex-shrink-0">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 truncate">Immobilien</p>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{immobilien?.length || 0}</p>
        </div>

        {/* Gesamte Einheiten */}
        <div className="metric-card p-3 sm:p-4 rounded-xl border border-green-100 bg-green-50" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 border border-green-200 flex-shrink-0">
              <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 truncate">Einheiten</p>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{gesamtEinheiten || 0}</p>
        </div>

        {/* Status & Termine */}
        <div className="metric-card p-3 sm:p-4 rounded-xl border border-red-100 bg-red-50" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 border border-red-200 flex-shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 truncate">Status</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] sm:text-xs text-gray-500">Leer</span>
              <span className="text-sm sm:text-lg font-bold text-gray-900">{leerstände}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] sm:text-xs text-gray-500">Gekündigt</span>
              <span className="text-sm sm:text-lg font-bold text-red-600">{gekuendigteMietvertraege.length}</span>
            </div>
            <div 
              className="hidden sm:flex items-baseline justify-between cursor-pointer hover:bg-white/50 rounded px-1 -mx-1 transition-colors"
              onClick={() => {
                if (naechsterVertrag && onNavigateToContract) {
                  onNavigateToContract(
                    naechsterVertrag.einheiten?.immobilie_id,
                    naechsterVertrag.einheit_id,
                    naechsterVertrag.id
                  );
                }
              }}
            >
              <span className="text-[10px] sm:text-xs text-gray-500">Nächstes Ende</span>
              <span className="text-[10px] sm:text-xs font-medium text-gray-700 hover:text-blue-600">{formatDatum(naechstesDatum)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Monatliche Miete – volle Breite */}
      <div 
        className="metric-card p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-purple-100 bg-purple-50 cursor-pointer hover:shadow-lg transition-all duration-200"
        style={{ animationDelay: '0.3s' }}
        onClick={onShowMietUebersicht}
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 sm:p-2.5 rounded-lg bg-purple-100 border border-purple-200">
              <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-semibold text-gray-800">Monatliche Miete</p>
              <p className="text-[10px] sm:text-xs text-gray-500">{getCurrentMonthYear()}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
        </div>

        {/* Hauptmetriken */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Erwartete Miete</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">€{erwartedMiete.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Erfasste Miete</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">€{(erfassedMiete || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Differenz</p>
            <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${differenz > 0 ? 'text-red-600' : differenz < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {differenz > 0 ? '-' : differenz < 0 ? '+' : ''}€{Math.abs(differenz).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Detailzeile */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-purple-200/60 text-[10px] sm:text-xs text-gray-500">
          <span>Kaltmiete: <strong className="text-gray-700">€{gesamtKaltmiete.toLocaleString()}</strong></span>
          <span>Betriebskosten: <strong className="text-gray-700">€{gesamtBetriebskosten.toLocaleString()}</strong></span>
          <span className="hidden sm:inline">|</span>
          <span>Einheiten: <strong className="text-gray-700">{gesamtEinheiten || 0}</strong></span>
          <span>Leerstand: <strong className={leerstände > 0 ? 'text-red-600' : 'text-green-600'}>{leerstände}</strong></span>
        </div>
      </div>
    </div>
  );
};
