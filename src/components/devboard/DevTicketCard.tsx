import { Badge } from "@/components/ui/badge";
import { Bug, Lightbulb, ListTodo, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DevTicketCardProps {
  ticket: any;
  onClick: () => void;
}

const typConfig: Record<string, { icon: any; label: string; className: string }> = {
  bug: { icon: Bug, label: "Bug", className: "bg-destructive/10 text-destructive border-destructive/20" },
  feature: { icon: Lightbulb, label: "Feature", className: "bg-blue-100 text-blue-700 border-blue-200" },
  aufgabe: { icon: ListTodo, label: "Aufgabe", className: "bg-muted text-muted-foreground border-border" },
};

const prioritaetConfig: Record<string, { label: string; className: string }> = {
  kritisch: { label: "Kritisch", className: "bg-destructive text-destructive-foreground" },
  hoch: { label: "Hoch", className: "bg-orange-500 text-white" },
  mittel: { label: "Mittel", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  niedrig: { label: "Niedrig", className: "bg-muted text-muted-foreground" },
};

export const DevTicketCard = ({ ticket, onClick }: DevTicketCardProps) => {
  const typ = typConfig[ticket.typ] || typConfig.feature;
  const prio = prioritaetConfig[ticket.prioritaet] || prioritaetConfig.mittel;
  const TypIcon = typ.icon;

  return (
    <div
      onClick={onClick}
      className="bg-background border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typ.className}`}>
            <TypIcon className="h-3 w-3 mr-0.5" />
            {typ.label}
          </Badge>
          {(ticket.prioritaet === "kritisch" || ticket.prioritaet === "hoch") && (
            <Badge className={`text-[10px] px-1.5 py-0 ${prio.className}`}>
              {ticket.prioritaet === "kritisch" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
              {prio.label}
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm font-medium leading-tight">{ticket.titel}</p>
      {ticket.kurzbeschreibung && (
        <p className="text-xs text-muted-foreground line-clamp-2">{ticket.kurzbeschreibung}</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        {format(new Date(ticket.erstellt_am), "dd.MM.yy", { locale: de })}
      </p>
    </div>
  );
};
