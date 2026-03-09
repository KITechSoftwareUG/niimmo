import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DevTicketKommentareProps {
  ticketId: string;
}

export const DevTicketKommentare = ({ ticketId }: DevTicketKommentareProps) => {
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  const { data: kommentare = [], isLoading } = useQuery({
    queryKey: ["dev-ticket-kommentare", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dev_ticket_kommentare" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("erstellt_am", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const addComment = useMutation({
    mutationFn: async (kommentar: string) => {
      const { error } = await supabase
        .from("dev_ticket_kommentare" as any)
        .insert({ ticket_id: ticketId, kommentar } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-ticket-kommentare", ticketId] });
      setNewComment("");
      toast.success("Kommentar hinzugefügt");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Kommentare ({kommentare.length})
      </h4>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Laden...</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {kommentare.map((k: any) => (
            <div key={k.id} className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="whitespace-pre-wrap">{k.kommentar}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(k.erstellt_am), "dd.MM.yyyy HH:mm", { locale: de })}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Kommentar hinzufügen..."
          className="min-h-[60px] text-sm"
        />
        <Button
          size="icon"
          onClick={() => newComment.trim() && addComment.mutate(newComment.trim())}
          disabled={!newComment.trim() || addComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
