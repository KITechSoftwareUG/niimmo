
import { Building2, Users, TrendingUp, DollarSign, Euro, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStatsProps {
  immobilien: any[] | undefined;
  onNavigateToContract?: (immobilieId: string, einheitId: string, mietvertragId: string) => void;
}

export const DashboardStats = ({ immobilien, onNavigateToContract }: DashboardStatsProps) => {
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
      // Berechne die tatsächlich erfassten Mietzahlungen für den aktuellen Monat
      const heute = new Date();
      const monatBeginn = new Date(heute.getFullYear(), heute.getMonth(), 1);
      const monatEnde = new Date(heute.getFullYear(), heute.getMonth() + 1, 0);
      
      const { data: zahlungen, error } = await supabase
        .from('zahlungen')
        .select('betrag')
        .eq('kategorie', 'Miete')
        .gte('buchungsdatum', monatBeginn.toISOString().split('T')[0])
        .lte('buchungsdatum', monatEnde.toISOString().split('T')[0]);
      
      if (error) {
        console.error('Fehler beim Laden der Zahlungen:', error);
        return 0;
      }
      
      return zahlungen?.reduce((sum, zahlung) => sum + (zahlung.betrag || 0), 0) || 0;
    }
  });

  const aktiveMietvertraege = mietvertraege?.filter(mv => mv.status === 'aktiv') || [];
  const gekuendigteMietvertraege = mietvertraege?.filter(mv => mv.status === 'gekuendigt') || [];
  const erwartedMiete = aktiveMietvertraege.reduce((sum, vertrag) => sum + (vertrag.kaltmiete || 0), 0);
  const leerstände = gesamtEinheiten ? gesamtEinheiten - aktiveMietvertraege.length : 0;

  // Berechne das nächste Kündigungs- oder Auslaufdatum und finde den zugehörigen Vertrag
  const naechstesVertragInfo = mietvertraege
    ?.reduce((frueheste: { datum: string | null, vertrag: any | null }, mv) => {
      const heute = new Date();
      const kuendigungsdatum = mv.kuendigungsdatum ? new Date(mv.kuendigungsdatum) : null;
      const auslaufdatum = mv.ende_datum ? new Date(mv.ende_datum) : null;
      
      let naechstesDatumFuerVertrag: Date | null = null;
      
      // Prüfe Kündigungsdatum
      if (kuendigungsdatum && kuendigungsdatum > heute) {
        naechstesDatumFuerVertrag = kuendigungsdatum;
      }
      
      // Prüfe Auslaufdatum (falls früher als Kündigungsdatum oder kein Kündigungsdatum)
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
    if (!datum) return 'Nicht verfügbar';
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

  const stats = [
    {
      title: "Immobilien",
      value: immobilien?.length || 0,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      title: "Gesamte Einheiten",
      value: gesamtEinheiten || 0,
      icon: Users,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100"
    },
    {
      title: "Status & Termine",
      value: null,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
      isStatusCard: true
    },
    {
      title: `Monatliche Miete (${getCurrentMonthYear()})`,
      value: null, // Special case for combined rent display
      icon: Euro,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
      isRentCard: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div 
          key={stat.title} 
          className={`metric-card p-6 rounded-2xl border ${stat.border} ${stat.bg}`}
          style={{animationDelay: `${index * 0.1}s`}}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium font-sans text-gray-600 mb-1">{stat.title}</p>
              {stat.isRentCard ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Erwartete Miete</p>
                    <p className="text-2xl font-bold font-sans text-gray-900">€{erwartedMiete.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Erfasste Miete ({getCurrentMonthYear()})</p>
                    <p className="text-2xl font-bold font-sans text-gray-900">€{erfassedMiete?.toLocaleString() || 0}</p>
                  </div>
                </div>
              ) : stat.isStatusCard ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Leerstände</p>
                    <p className="text-2xl font-bold font-sans text-gray-900">{leerstände}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Gekündigt</p>
                    <p className="text-xl font-bold font-sans text-red-600">{gekuendigteMietvertraege.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Nächstes Auslaufdatum</p>
                    <p 
                      className="text-sm font-medium font-sans text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
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
                      {formatDatum(naechstesDatum)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-3xl font-bold font-sans text-gray-900">{stat.value}</p>
              )}
            </div>
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.border} border`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
