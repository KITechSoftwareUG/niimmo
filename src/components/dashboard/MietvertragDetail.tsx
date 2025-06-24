
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { MietvertragHeader } from "./MietvertragHeader";
import { MietvertragInfo } from "./MietvertragInfo";
import { MieterList } from "./MieterList";
import { PaymentHistory } from "./PaymentHistory";
import { DocumentsList } from "./DocumentsList";

interface MietvertragDetailProps {
  vertragId: string;
  onBack: () => void;
}

export const MietvertragDetail = ({ vertragId, onBack }: MietvertragDetailProps) => {
  const { data: vertrag, isLoading: vertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertraege')
        .select('*')
        .eq('id', vertragId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: einheit } = useQuery({
    queryKey: ['einheit-detail', vertrag?.einheit_id],
    queryFn: async () => {
      if (!vertrag?.einheit_id) return null;
      
      const { data, error } = await supabase
        .from('einheiten')
        .select('*')
        .eq('id', vertrag.einheit_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vertrag?.einheit_id
  });

  const { data: immobilie } = useQuery({
    queryKey: ['immobilie-detail', einheit?.immobilie_id],
    queryFn: async () => {
      if (!einheit?.immobilie_id) return null;
      
      const { data, error } = await supabase
        .from('immobilien')
        .select('*')
        .eq('id', einheit.immobilie_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!einheit?.immobilie_id
  });

  const { data: mieter } = useQuery({
    queryKey: ['mietvertrag-mieter', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag_mieter')
        .select(`
          rolle,
          mieter:mieter_id (
            Vorname,
            Nachname,
            hauptmail,
            weitere_mails
          )
        `)
        .eq('mietvertrag_id', vertragId);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: dokumente } = useQuery({
    queryKey: ['dokumente', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Simulate payment history since mietzahlungen table doesn't exist in types
  const simulatedPayments = vertrag ? [
    {
      id: '1',
      monat: new Date().toISOString().split('T')[0],
      betrag: vertrag.kaltmiete || 0,
      bezahlt_am: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString() : null
    },
    {
      id: '2', 
      monat: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      betrag: vertrag.kaltmiete || 0,
      bezahlt_am: new Date(Date.now() - (30 + Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
    }
  ] : [];

  if (vertragLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MietvertragHeader onBack={onBack} status={vertrag?.status} />
      
      <MietvertragInfo vertrag={vertrag} einheit={einheit} immobilie={immobilie} />
      
      <MieterList mieter={mieter} />
      
      <PaymentHistory payments={simulatedPayments} />
      
      <DocumentsList dokumente={dokumente} />
    </div>
  );
};
