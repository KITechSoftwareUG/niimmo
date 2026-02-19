import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Automatically transitions a contract from 'gekuendigt' to 'beendet'
 * once its Kündigungsdatum has passed.
 */
export const useAutoExpireContract = (
  vertragId: string | undefined,
  status: string | undefined,
  kuendigungsdatum: string | undefined
) => {
  useEffect(() => {
    if (!vertragId || status !== 'gekuendigt' || !kuendigungsdatum) return;

    const terminationDate = new Date(kuendigungsdatum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    terminationDate.setHours(0, 0, 0, 0);

    if (terminationDate > today) return;

    const updateStatus = async () => {
      try {
        await supabase
          .from('mietvertrag')
          .update({ status: 'beendet' })
          .eq('id', vertragId);
      } catch (error) {
        console.error('Error auto-expiring contract:', error);
      }
    };

    updateStatus();
  }, [vertragId, status, kuendigungsdatum]);
};
