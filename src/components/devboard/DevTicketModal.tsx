import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DevTicketKommentare } from "./DevTicketKommentare";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface DevTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: any;
}

const statusOptions = [
  { value: "offen", label: "Offen" },
  { value: "geplant", label: "Geplant" },
  { value: "in_entwicklung", label: "In Entwicklung" },
  { value: "in_testing", label: "In Testing" },
  { value: "fertig", label: "Fertig" },
];

const typOptions = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "aufgabe", label: "Aufgabe" },
];

const prioritaetOptions = [
  { value: "kritisch", label: "Kritisch" },
  { value: "hoch", label: "Hoch" },
  { value: "mittel", label: "Mittel" },
  { value: "niedrig", label: "Niedrig" },
];

export const DevTicketModal = ({ open, onOpenChange, ticket }: DevTicketModalProps) => {
  const isNew = !ticket;
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    titel: "",
    typ: "feature",
    status: "offen",
    prioritaet: "mittel",
    kurzbeschreibung: "",
    beschreibung: "",
  });

  useEffect(() => {
    if (ticket) {
      setForm({
        titel: ticket.titel || "",
        typ: ticket.typ || "feature",
        status: ticket.status || "offen",
        prioritaet: ticket.prioritaet || "mittel",
        kurzbeschreibung: ticket.kurzbeschreibung || "",
        beschreibung: ticket.beschreibung || "",
      });
    } else {
      setForm({ titel: "", typ: "feature", status: "offen", prioritaet: "mittel", kurzbeschreibung: "", beschreibung: "" });
    }
  }, [ticket, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const { error } = await supabase.from("dev_tickets" as any).insert(form as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dev_tickets" as any).update(form as any).eq("id", ticket.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-tickets"] });
      onOpenChange(false);
      toast.success(isNew ? "Ticket erstellt" : "Ticket aktualisiert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dev_tickets" as any).delete().eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-tickets"] });
      onOpenChange(false);
      toast.success("Ticket gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Neues Ticket" : "Ticket bearbeiten"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Titel *</Label>
            <Input value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Typ</Label>
              <Select value={form.typ} onValueChange={(v) => setForm({ ...form, typ: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorität</Label>
              <Select value={form.prioritaet} onValueChange={(v) => setForm({ ...form, prioritaet: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {prioritaetOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Kurzbeschreibung</Label>
            <Input value={form.kurzbeschreibung} onChange={(e) => setForm({ ...form, kurzbeschreibung: e.target.value })} placeholder="Kurze Zusammenfassung..." />
          </div>

          <div>
            <Label>Detailbeschreibung</Label>
            <Textarea value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} placeholder="Ausführliche Beschreibung..." className="min-h-[120px]" />
          </div>

          {!isNew && <DevTicketKommentare ticketId={ticket.id} />}

          <div className="flex justify-between pt-2">
            {!isNew && (
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-1" /> Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.titel.trim() || saveMutation.isPending}>
                {isNew ? "Erstellen" : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
