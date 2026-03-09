import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DevTicketCard } from "./DevTicketCard";
import { DevTicketModal } from "./DevTicketModal";
import { ArrowLeft, Plus, LayoutGrid, List, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DevStatusBoardProps {
  onBack: () => void;
}

const statusColumns = [
  { key: "offen", label: "Offen", color: "bg-muted" },
  { key: "geplant", label: "Geplant", color: "bg-blue-50" },
  { key: "in_entwicklung", label: "In Entwicklung", color: "bg-yellow-50" },
  { key: "in_testing", label: "In Testing", color: "bg-purple-50" },
  { key: "fertig", label: "Fertig", color: "bg-green-50" },
];

const typLabels: Record<string, string> = { bug: "Bug", feature: "Feature", aufgabe: "Aufgabe" };
const prioLabels: Record<string, string> = { kritisch: "Kritisch", hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig" };

export const DevStatusBoard = ({ onBack }: DevStatusBoardProps) => {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [filterTyp, setFilterTyp] = useState<string>("alle");
  const [filterPrio, setFilterPrio] = useState<string>("alle");
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
    if (filterPrio !== "alle" && t.prioritaet !== filterPrio) return false;
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

  const openNew = () => {
    setSelectedTicket(null);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen modern-dashboard-bg">
      <div className="container mx-auto px-4 py-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="glass-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold">Entwicklungsstatus</h1>
              <Badge variant="secondary">{tickets.length} Tickets</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
                <List className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Neues Ticket
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tickets durchsuchen..." className="pl-9 h-9" />
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
            <Select value={filterPrio} onValueChange={setFilterPrio}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Prioritäten</SelectItem>
                <SelectItem value="kritisch">Kritisch</SelectItem>
                <SelectItem value="hoch">Hoch</SelectItem>
                <SelectItem value="mittel">Mittel</SelectItem>
                <SelectItem value="niedrig">Niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Kanban View */}
        {view === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statusColumns.map((col) => {
              const colTickets = filtered.filter((t: any) => t.status === col.key);
              return (
                <div key={col.key} className={`rounded-xl p-3 ${col.color} min-h-[200px]`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="outline" className="text-[10px]">{colTickets.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {colTickets.map((t: any) => (
                      <DevTicketCard key={t.id} ticket={t} onClick={() => openTicket(t)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {view === "list" && (
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t: any) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTicket(t)}>
                    <TableCell><Badge variant="outline" className="text-xs">{typLabels[t.typ] || t.typ}</Badge></TableCell>
                    <TableCell className="font-medium">{t.titel}</TableCell>
                    <TableCell>{statusColumns.find((s) => s.key === t.status)?.label || t.status}</TableCell>
                    <TableCell>{prioLabels[t.prioritaet] || t.prioritaet}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(t.erstellt_am), "dd.MM.yy", { locale: de })}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Keine Tickets gefunden</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DevTicketModal open={modalOpen} onOpenChange={setModalOpen} ticket={selectedTicket} />
    </div>
  );
};
