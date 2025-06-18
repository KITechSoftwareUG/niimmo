
import { Building2, Users, TrendingUp, DollarSign } from "lucide-react";
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

  const { data: aktiveMietvertraege } = useQuery({
    queryKey: ['aktive-mietvertraege'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aktive_mietvertraege')
        .select('id, kaltmiete')
        .eq('status', 'aktiv');
      
      if (error) throw error;
      return data || [];
    }
  });

  const gesamtMiete = aktiveMietvertraege?.reduce((sum, vertrag) => sum + (vertrag.kaltmiete || 0), 0) || 0;
  const auslastung = gesamtEinheiten && aktiveMietvertraege ? 
    Math.round((aktiveMietvertraege.length / gesamtEinheiten) * 100) : 0;

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
      title: "Auslastung",
      value: `${auslastung}%`,
      icon: TrendingUp,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100"
    },
    {
      title: "Monatliche Miete",
      value: `€${gesamtMiete.toLocaleString()}`,
      icon: DollarSign,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100"
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
            <div>
              <p className="text-sm font-medium font-sans text-gray-600 mb-1">{stat.title}</p>
              <p className="text-3xl font-bold font-sans text-gray-900">{stat.value}</p>
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
