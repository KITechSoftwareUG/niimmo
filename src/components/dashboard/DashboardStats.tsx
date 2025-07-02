
import { Building2, Users, TrendingUp, DollarSign, Euro } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStatsProps {
  immobilien: any[] | undefined;
}

export const DashboardStats = ({ immobilien }: DashboardStatsProps) => {
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
        .select('id, kaltmiete, status');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erfassedMiete } = useQuery({
    queryKey: ['erfasste-miete'],
    queryFn: async () => {
      // Berechne die tatsächlich erfassten Mietzahlungen aus der Zahlungen-Tabelle
      const { data: zahlungen, error } = await supabase
        .from('zahlungen')
        .select('betrag');
      
      if (error) {
        console.error('Fehler beim Laden der Zahlungen:', error);
        return 0;
      }
      
      return zahlungen?.reduce((sum, zahlung) => sum + (zahlung.betrag || 0), 0) || 0;
    }
  });

  const aktiveMietvertraege = mietvertraege?.filter(mv => mv.status === 'aktiv') || [];
  const erwartedMiete = aktiveMietvertraege.reduce((sum, vertrag) => sum + (vertrag.kaltmiete || 0), 0);
  const leerstände = gesamtEinheiten ? gesamtEinheiten - aktiveMietvertraege.length : 0;

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
      title: "Leerstände",
      value: leerstände,
      icon: TrendingUp,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100"
    },
    {
      title: "Monatliche Miete",
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
                    <p className="text-xs text-gray-500 mb-1">Erfasste Miete</p>
                    <p className="text-2xl font-bold font-sans text-gray-900">€{erfassedMiete?.toLocaleString() || 0}</p>
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
