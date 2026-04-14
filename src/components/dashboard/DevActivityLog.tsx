import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Search, Activity } from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface DevActivityLogProps {
  onBack: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  mietvertrag_geaendert: "Vertrag geändert",
  mieterhoehung_dokumentiert: "Mieterhöhung",
  kuendigung_durchgefuehrt: "Kündigung",
  kaution_geaendert: "Kaution geändert",
  zahlung_zugeordnet: "Zahlung zugeordnet",
  zahlung_kategorie_geaendert: "Kategorie geändert",
  dokument_hochgeladen: "Dokument Upload",
  mahnung_gesendet: "Mahnung gesendet",
  pdf_generiert: "PDF generiert",
  mietforderung_erstellt: "Forderung erstellt",
  "zählerstand_geaendert": "Zählerstand",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-100 text-green-800 border-green-200",
  logout: "bg-gray-100 text-gray-700 border-gray-200",
  mietvertrag_geaendert: "bg-blue-100 text-blue-800 border-blue-200",
  mieterhoehung_dokumentiert: "bg-orange-100 text-orange-800 border-orange-200",
  kuendigung_durchgefuehrt: "bg-red-100 text-red-800 border-red-200",
  kaution_geaendert: "bg-yellow-100 text-yellow-800 border-yellow-200",
  zahlung_zugeordnet: "bg-emerald-100 text-emerald-800 border-emerald-200",
  zahlung_kategorie_geaendert: "bg-purple-100 text-purple-800 border-purple-200",
  dokument_hochgeladen: "bg-indigo-100 text-indigo-800 border-indigo-200",
  mahnung_gesendet: "bg-rose-100 text-rose-800 border-rose-200",
  pdf_generiert: "bg-sky-100 text-sky-800 border-sky-200",
  mietforderung_erstellt: "bg-violet-100 text-violet-800 border-violet-200",
};

export function DevActivityLog({ onBack }: DevActivityLogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  const filtered = logs?.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.user_email?.toLowerCase().includes(term) ||
      log.entity_type?.toLowerCase().includes(term) ||
      JSON.stringify(log.details ?? {}).toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-500" />
                <h1 className="text-xl font-bold text-gray-900">Aktivitätenlog</h1>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                  DEV ONLY
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Suche nach Aktion, User, Entität..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Stats */}
          <div className="mt-3 flex gap-4 text-sm text-gray-500">
            <span>{logs?.length ?? 0} Einträge total</span>
            {searchTerm && <span>· {filtered?.length ?? 0} gefiltert</span>}
          </div>
        </div>

        {/* Log Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Lade Logs...</div>
          ) : !filtered?.length ? (
            <div className="p-12 text-center text-gray-400">Keine Einträge gefunden.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Zeitpunkt</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Aktion</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Entität</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => (
                    <tr
                      key={log.id}
                      className={`border-b border-gray-100 hover:bg-white/60 transition-colors ${
                        i % 2 === 0 ? "bg-white/20" : "bg-white/40"
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-mono text-xs">
                        {format(parseISO(log.created_at), "dd.MM.yy HH:mm:ss", { locale: de })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
                        >
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 text-xs">
                        {log.user_email ?? <span className="text-gray-400 italic">unbekannt</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                        {log.entity_type ? (
                          <span>
                            <span className="font-medium text-gray-700">{log.entity_type}</span>
                            {log.entity_id && (
                              <span className="ml-1 font-mono text-gray-400">
                                #{log.entity_id.slice(0, 8)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                        {log.details ? (
                          <span className="font-mono break-all">
                            {Object.entries(log.details as Record<string, unknown>)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
