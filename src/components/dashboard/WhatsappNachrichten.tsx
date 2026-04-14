import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Phone, Calendar, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface WhatsappNachricht {
  id: string;
  telefonnummer: string;
  nachricht: string;
  zeitstempel: string;
  richtung: "eingehend" | "ausgehend";
  mieter_id: string | null;
  mietvertrag_id: string | null;
  gelesen: boolean;
  absender_name: string | null;
  empfaenger_name: string | null;
  media_url: string | null;
}

interface Mieter {
  id: string;
  vorname: string;
  nachname: string | null;
}

export function WhatsappNachrichten() {
  const [nachrichten, setNachrichten] = useState<WhatsappNachricht[]>([]);
  const [mieter, setMieter] = useState<Record<string, Mieter>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filterTelefon, setFilterTelefon] = useState("");
  const [filterRichtung, setFilterRichtung] = useState<string>("alle");

  useEffect(() => {
    loadNachrichten();
    loadMieter();
  }, []);

  const loadMieter = async () => {
    const { data, error } = await supabase
      .from("mieter")
      .select("id, vorname, nachname");

    if (error) {
      return;
    }

    const mieterMap: Record<string, Mieter> = {};
    data.forEach((m) => {
      mieterMap[m.id] = m;
    });
    setMieter(mieterMap);
  };

  const loadNachrichten = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_nachrichten")
      .select("*")
      .order("zeitstempel", { ascending: false });

    if (error) {
      toast.error("Fehler beim Laden der Nachrichten");
      setIsLoading(false);
      return;
    }

    setNachrichten((data as WhatsappNachricht[]) || []);
    setIsLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("whatsapp_nachrichten")
      .update({ gelesen: true })
      .eq("id", id);

    if (error) {
      return;
    }

    setNachrichten((prev) =>
      prev.map((n) => (n.id === id ? { ...n, gelesen: true } : n))
    );
  };

  const filteredNachrichten = nachrichten.filter((n) => {
    if (filterTelefon && !n.telefonnummer.includes(filterTelefon)) {
      return false;
    }
    if (filterRichtung !== "alle" && n.richtung !== filterRichtung) {
      return false;
    }
    return true;
  });

  const ungeleseneCount = nachrichten.filter((n) => !n.gelesen && n.richtung === "eingehend").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">WhatsApp Nachrichten</h2>
          {ungeleseneCount > 0 && (
            <Badge variant="destructive">{ungeleseneCount} ungelesen</Badge>
          )}
        </div>
        <Button onClick={loadNachrichten} variant="outline" size="sm">
          Aktualisieren
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nach Telefonnummer filtern..."
              value={filterTelefon}
              onChange={(e) => setFilterTelefon(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterRichtung === "alle" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRichtung("alle")}
            >
              Alle
            </Button>
            <Button
              variant={filterRichtung === "eingehend" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRichtung("eingehend")}
            >
              Eingehend
            </Button>
            <Button
              variant={filterRichtung === "ausgehend" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRichtung("ausgehend")}
            >
              Ausgehend
            </Button>
          </div>
          {(filterTelefon || filterRichtung !== "alle") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFilterTelefon("");
                setFilterRichtung("alle");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Lade Nachrichten...
          </div>
        ) : filteredNachrichten.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine Nachrichten gefunden
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredNachrichten.map((nachricht) => {
                const mieterInfo = nachricht.mieter_id
                  ? mieter[nachricht.mieter_id]
                  : null;

                return (
                  <Card
                    key={nachricht.id}
                    className={`p-4 ${
                      !nachricht.gelesen && nachricht.richtung === "eingehend"
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                    onClick={() => {
                      if (!nachricht.gelesen && nachricht.richtung === "eingehend") {
                        markAsRead(nachricht.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              nachricht.richtung === "eingehend"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {nachricht.richtung === "eingehend"
                              ? "Eingehend"
                              : "Ausgehend"}
                          </Badge>
                          <span className="text-sm font-medium">
                            {nachricht.telefonnummer}
                          </span>
                          {mieterInfo && (
                            <Badge variant="outline">
                              {mieterInfo.vorname}{" "}
                              {mieterInfo.nachname || ""}
                            </Badge>
                          )}
                          {!nachricht.gelesen && nachricht.richtung === "eingehend" && (
                            <Badge variant="destructive" className="text-xs">
                              Neu
                            </Badge>
                          )}
                        </div>

                        {nachricht.absender_name && (
                          <p className="text-sm text-muted-foreground">
                            Von: {nachricht.absender_name}
                          </p>
                        )}

                        <p className="text-sm whitespace-pre-wrap">
                          {nachricht.nachricht}
                        </p>

                        {nachricht.media_url && (
                          <div className="mt-2">
                            <a
                              href={nachricht.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              📎 Anhang anzeigen
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(
                          new Date(nachricht.zeitstempel),
                          "dd.MM.yyyy HH:mm",
                          { locale: de }
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>

      <Card className="p-4 bg-muted/50">
        <h3 className="font-semibold mb-2">📋 n8n Konfiguration:</h3>
        <ol className="text-sm space-y-2 list-decimal list-inside">
          <li>
            In n8n einen <strong>WhatsApp Business Trigger</strong> erstellen
          </li>
          <li>
            Einen <strong>Supabase Node</strong> hinzufügen mit folgenden
            Einstellungen:
            <ul className="ml-8 mt-1 space-y-1 list-disc">
              <li>Operation: Insert</li>
              <li>Table: whatsapp_nachrichten</li>
              <li>
                Felder mappen:
                <br />
                - telefonnummer: {`{{$json.from}}`}
                <br />
                - nachricht: {`{{$json.body}}`}
                <br />
                - richtung: "eingehend"
                <br />
                - absender_name: {`{{$json.name}}`}
                <br />- zeitstempel: {`{{$json.timestamp}}`}
              </li>
            </ul>
          </li>
          <li>
            Optional: Einen weiteren Node hinzufügen, um die Telefonnummer mit
            einem Mieter zu verknüpfen (via JOIN auf mieter.telnr)
          </li>
          <li>
            Für ausgehende Nachrichten: Ähnlichen Workflow mit richtung:
            "ausgehend" erstellen
          </li>
        </ol>
      </Card>
    </div>
  );
}
