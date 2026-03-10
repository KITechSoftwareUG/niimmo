import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DevTicketModal } from "./DevTicketModal";
import { ArrowLeft, Plus, Search, Bug, Lightbulb, ListTodo, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DevStatusBoardProps {
  onBack: () => void;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  offen: { label: "Offen", className: "bg-muted text-muted-foreground" },
  geplant: { label: "Geplant", className: "bg-blue-100 text-blue-700" },
  in_entwicklung: { label: "In Entwicklung", className: "bg-yellow-100 text-yellow-800" },
  in_testing: { label: "In Testing", className: "bg-purple-100 text-purple-700" },
  fertig: { label: "Fertig", className: "bg-green-100 text-green-700" },
};

const typConfig: Record<string, { icon: any; label: string; className: string }> = {
  bug: { icon: Bug, label: "Bug", className: "bg-destructive/10 text-destructive border-destructive/20" },
  feature: { icon: Lightbulb, label: "Feature", className: "bg-blue-100 text-blue-700 border-blue-200" },
  aufgabe: { icon: ListTodo, label: "Aufgabe", className: "bg-muted text-muted-foreground border-border" },
};

const prioConfig: Record<string, { label: string; className: string }> = {
  kritisch: { label: "Kritisch", className: "bg-destructive text-destructive-foreground" },
  hoch: { label: "Hoch", className: "bg-orange-500 text-white" },
  mittel: { label: "Mittel", className: "bg-yellow-100 text-yellow-800" },
  niedrig: { label: "Niedrig", className: "bg-muted text-muted-foreground" },
};

export const DevStatusBoard = ({ onBack }: DevStatusBoardProps) => {
  const [search, setSearch] = useState("");
  const [filterTyp, setFilterTyp] = useState<string>("alle");
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const { data: tickets = [] } = useQuery({
    queryKey: ["dev-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dev_tickets" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("erstellt_am", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = tickets.filter((t: any) => {
    if (filterTyp !== "alle" && t.typ !== filterTyp) return false;
    if (filterStatus !== "alle" && t.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.titel?.toLowerCase().includes(s) || t.kurzbeschreibung?.toLowerCase().includes(s) || t.beschreibung?.toLowerCase().includes(s);
    }
    return true;
  });

  const openTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8 max-w-5xl">
        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold">Entwicklungsstatus</h1>
              <Badge variant="secondary">{tickets.length} Einträge</Badge>
            </div>
            <Button size="sm" onClick={() => { setSelectedTicket(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Neu
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen..." className="pl-9 h-9" />
            </div>
            <Select value={filterTyp} onValueChange={setFilterTyp}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Typen</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="aufgabe">Aufgabe</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                <SelectItem value="offen">Offen</SelectItem>
                <SelectItem value="geplant">Geplant</SelectItem>
                <SelectItem value="in_entwicklung">In Entwicklung</SelectItem>
                <SelectItem value="in_testing">In Testing</SelectItem>
                <SelectItem value="fertig">Fertig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Liste */}
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Typ</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[100px]">Priorität</TableHead>
                <TableHead className="w-[90px]">Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: any) => {
                const typ = typConfig[t.typ] || typConfig.feature;
                const status = statusLabels[t.status] || statusLabels.offen;
                const prio = prioConfig[t.prioritaet] || prioConfig.mittel;
                const TypIcon = typ.icon;

                return (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTicket(t)}>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typ.className}`}>
                        <TypIcon className="h-3 w-3 mr-0.5" />
                        {typ.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{t.titel}</span>
                        {t.kurzbeschreibung && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.kurzbeschreibung}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${prio.className}`}>
                        {(t.prioritaet === "kritisch") && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                        {prio.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(t.erstellt_am), "dd.MM.yy", { locale: de })}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Keine Einträge gefunden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DevTicketModal open={modalOpen} onOpenChange={setModalOpen} ticket={selectedTicket} />
    </div>
  );
};
