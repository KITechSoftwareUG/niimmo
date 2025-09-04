import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook to set up real-time updates for rental management data
 * Automatically invalidates relevant queries when data changes
 */
export const useRealtimeUpdates = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Set up global real-time subscriptions for all rental management tables
    const channel = supabase
      .channel('rental-management-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mietforderungen'
        },
        (payload) => {
          console.log('Global forderungen update:', payload);
          
          // Invalidate global queries
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
          
          // Invalidate contract-specific queries if we have the contract ID
          const contractId = (payload.new as any)?.mietvertrag_id || (payload.old as any)?.mietvertrag_id;
          if (contractId) {
            queryClient.invalidateQueries({ queryKey: ['mietforderungen', contractId] });
            queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', contractId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zahlungen'
        },
        (payload) => {
          console.log('Global zahlungen update:', payload);
          
          // Invalidate global queries
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
          
          // Invalidate contract-specific queries if we have the contract ID
          const contractId = (payload.new as any)?.mietvertrag_id || (payload.old as any)?.mietvertrag_id;
          if (contractId) {
            queryClient.invalidateQueries({ queryKey: ['zahlungen-detail', contractId] });
            queryClient.invalidateQueries({ queryKey: ['zahlungen', contractId] });
            queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', contractId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mietvertrag'
        },
        (payload) => {
          console.log('Global mietvertrag update:', payload);
          
          // Invalidate global queries
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
          queryClient.invalidateQueries({ queryKey: ['all-mietvertraege'] });
          
          // Invalidate contract-specific queries
          const contractId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (contractId) {
            queryClient.invalidateQueries({ queryKey: ['mietvertrag-detail', contractId] });
            queryClient.invalidateQueries({ queryKey: ['mietvertrag-mieter-detail', contractId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mieter'
        },
        (payload) => {
          console.log('Global mieter update:', payload);
          
          // Invalidate mieter-related queries
          queryClient.invalidateQueries({ queryKey: ['rueckstaende'] });
          
          const mieterId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (mieterId) {
            // Find all contracts related to this tenant and invalidate them
            queryClient.invalidateQueries({ 
              predicate: (query) => {
                return query.queryKey.includes('mietvertrag-mieter-detail');
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null; // This hook doesn't return anything, it just sets up subscriptions
};