
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { MietvertragHeader } from "./MietvertragHeader";
import { MietvertragInfo } from "./MietvertragInfo";
import { MieterList } from "./MieterList";
import { PaymentHistory } from "./PaymentHistory";
import { MietvertragDocumentsManagement } from "./MietvertragDocumentsManagement";
import { MieterhöhungManagement } from "./MieterhöhungManagement";

interface MietvertragDetailProps {
  vertragId: string;
  onBack: () => void;
}

export const MietvertragDetail = ({ vertragId, onBack }: MietvertragDetailProps) => {
  const { data: vertrag, isLoading: vertragLoading } = useQuery({
    queryKey: ['mietvertrag-detail', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mietvertrag')
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
          rolle:mieter_id,
          mieter:mieter_id (
            id,
            vorname,
            nachname,
            hauptmail,
            weitere_mails,
            telnr
          )
        `)
        .eq('mietvertrag_id', vertragId);
      
      if (error) throw error;
      // Add rolle information - for now just set as "Hauptmieter"
      return data?.map(item => ({
        ...item,
        rolle: 'Hauptmieter'
      })) || [];
    }
  });

  const { data: dokumente } = useQuery({
    queryKey: ['dokumente', vertragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dokumente')
        .select('*')
        .eq('mietvertrag_id', vertragId)
        .eq('geloescht', false)
        .order('hochgeladen_am', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!vertragId
  });


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
      
      <MieterhöhungManagement 
        vertragId={vertragId}
        currentKaltmiete={vertrag?.kaltmiete || 0}
        letzteErhöhung={vertrag?.letzte_mieterhoehung_am}
        startDatum={vertrag?.start_datum}
      />
      
      <PaymentHistory 
        mietvertragId={vertragId} 
        currentMahnstufe={vertrag?.mahnstufe || 0} 
      />
      
      <MietvertragDocumentsManagement 
        mietvertragId={vertragId}
        dokumente={dokumente || []}
      />
    </div>
  );
};
