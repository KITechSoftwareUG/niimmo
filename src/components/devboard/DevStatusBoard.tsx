import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DevTicketModal } from "./DevTicketModal";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Search, Bug, Lightbulb, ListTodo, AlertTriangle, CheckCircle2, Clock, Construction } from "lucide-react";
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

interface FeatureStatus {
  name: string;
  progress: number;
  status: "fertig" | "in_arbeit" | "geplant";
  details?: string;
}

const featureOverview: FeatureStatus[] = [
  { name: "Immobilienverwaltung", progress: 100, status: "fertig", details: "Objekte, Einheiten, Zähler, Versorger" },
  { name: "Mieterverwaltung", progress: 100, status: "fertig", details: "Anlegen, Bearbeiten, Kontaktdaten" },
  { name: "Mietvertragsverwaltung", progress: 100, status: "fertig", details: "Verträge, Status, Kündigung, Verknüpfungen" },
  { name: "Zahlungsverwaltung", progress: 100, status: "fertig", details: "CSV-Import, Zuordnung, Kategorisierung, Splits" },
  { name: "Dokumentenverwaltung", progress: 100, status: "fertig", details: "Upload, Kategorien, PDF-Vorschau" },
  { name: "Mahnwesen", progress: 100, status: "fertig", details: "Mahnstufen, PDF-Generierung, Versand" },
  { name: "Mietforderungen", progress: 100, status: "fertig", details: "Automatische Generierung, Fälligkeiten" },
  { name: "Darlehensverwaltung", progress: 100, status: "fertig", details: "Tilgungsplan, Zahlungen, OCR-Import" },
  { name: "Versicherungen", progress: 100, status: "fertig", details: "Typ, Beiträge, Kontaktdaten" },
  { name: "Zählerverwaltung", progress: 100, status: "fertig", details: "Strom, Gas, Wasser, Ablesungen" },
  { name: "Dashboard & Statistiken", progress: 100, status: "fertig", details: "Übersicht, Kennzahlen, Filter" },
  { name: "Mieterhöhung", progress: 85, status: "in_arbeit", details: "Berechnung & PDF fertig, Versand teilweise" },
  { name: "Kündigung & Vertragsende", progress: 90, status: "in_arbeit", details: "Formular, Dokument-Upload, Auto-Status" },
  { name: "KI-Chatbot", progress: 80, status: "in_arbeit", details: "Chat funktioniert, Kontextwissen ausbaubar" },
  { name: "Nebenkostenabrechnung", progress: 60, status: "in_arbeit", details: "Zuordnung & Verteilung vorhanden, Abrechnung/PDF fehlt" },
  { name: "Übergabeprotokoll", progress: 70, status: "in_arbeit", details: "Formular & Zähler vorhanden, PDF/E-Mail in Arbeit" },
  { name: "WhatsApp-Integration", progress: 50, status: "in_arbeit", details: "Nachrichten anzeigen, Senden noch nicht live" },
  { name: "Hausmeister-Dashboard", progress: 40, status: "in_arbeit", details: "Grundstruktur vorhanden, Funktionen begrenzt" },
  { name: "Entwicklungsstatus-Board", progress: 100, status: "fertig", details: "Tickets, Kommentare, Filterung" },
];

const getStatusIcon = (status: FeatureStatus["status"]) => {
  switch (status) {
    case "fertig": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "in_arbeit": return <Construction className="h-4 w-4 text-yellow-600" />;
    case "geplant": return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getProgressColor = (progress: number) => {
  if (progress === 100) return "[&>div]:bg-green-500";
  if (progress >= 70) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-orange-500";
};

export const DevStatusBoard = ({ onBack }: DevStatusBoardProps) => {
  const [search, setSearch] = useState("");
  const [filterTyp, setFilterTyp] = useState<string>("alle");
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showFeatures, setShowFeatures] = useState(true);

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

  const fertigCount = featureOverview.filter(f => f.status === "fertig").length;
  const inArbeitCount = featureOverview.filter(f => f.status === "in_arbeit").length;
  const avgProgress = Math.round(featureOverview.reduce((sum, f) => sum + f.progress, 0) / featureOverview.length);

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
              <Badge variant="secondary">{tickets.length} Tickets</Badge>
            </div>
            <Button size="sm" onClick={() => { setSelectedTicket(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Neu
            </Button>
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-2 mb-4">
            <Button variant={showFeatures ? "default" : "outline"} size="sm" onClick={() => setShowFeatures(true)}>
              Feature-Übersicht
            </Button>
            <Button variant={!showFeatures ? "default" : "outline"} size="sm" onClick={() => setShowFeatures(false)}>
              Tickets ({tickets.length})
            </Button>
          </div>

          {/* Filters - nur bei Tickets */}
          {!showFeatures && (
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
          )}
        </div>

        {showFeatures ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="glass-card p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600">{fertigCount}</div>
                <div className="text-xs text-muted-foreground">Fertig</div>
              </div>
              <div className="glass-card p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-yellow-600">{inArbeitCount}</div>
                <div className="text-xs text-muted-foreground">In Arbeit</div>
              </div>
              <div className="glass-card p-4 rounded-xl text-center">
                <div className="text-2xl font-bold">{avgProgress}%</div>
                <div className="text-xs text-muted-foreground">Gesamt</div>
              </div>
            </div>

            {/* Feature Liste */}
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead className="w-[200px]">Fortschritt</TableHead>
                    <TableHead className="w-[60px] text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureOverview.sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name)).map((f) => (
                    <TableRow key={f.name}>
                      <TableCell className="pr-0">{getStatusIcon(f.status)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{f.name}</span>
                          {f.details && <p className="text-xs text-muted-foreground mt-0.5">{f.details}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Progress value={f.progress} className={`h-2 ${getProgressColor(f.progress)}`} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {f.progress}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          /* Tickets Liste */
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
        )}
      </div>

      <DevTicketModal open={modalOpen} onOpenChange={setModalOpen} ticket={selectedTicket} />
    </div>
  );
};