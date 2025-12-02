import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LinkedContract {
  id: string;
  einheit_id: string;
  kaltmiete: number;
  betriebskosten: number;
  status: string;
  start_datum: string;
  ende_datum: string | null;
  einheit?: {
    id: string;
    etage: string;
    qm: number;
    immobilie?: {
      id: string;
      name: string;
      adresse: string;
    };
  };
}

interface UseLinkedContractsResult {
  linkedContracts: LinkedContract[];
  isLoading: boolean;
  hasLinkedContracts: boolean;
}

/**
 * Hook to find other contracts that share the same tenants
 * Used to identify when tenants have multiple units (e.g., apartment + parking)
 */
export function useLinkedContracts(
  currentContractId: string,
  mieterIds: string[]
): UseLinkedContractsResult {
  const { data: linkedContracts = [], isLoading } = useQuery({
    queryKey: ['linked-contracts', currentContractId, mieterIds],
    queryFn: async () => {
      if (!mieterIds.length) return [];

      // Find all contracts that have any of the same tenants
      const { data: mieterVertraege, error: mieterError } = await supabase
        .from('mietvertrag_mieter')
        .select('mietvertrag_id')
        .in('mieter_id', mieterIds);

      if (mieterError) throw mieterError;
      if (!mieterVertraege?.length) return [];

      // Get unique contract IDs excluding current one
      const otherContractIds = [...new Set(
        mieterVertraege
          .map(mv => mv.mietvertrag_id)
          .filter(id => id !== currentContractId)
      )];

      if (!otherContractIds.length) return [];

      // Fetch contract details with einheit and immobilie info
      const { data: contracts, error: contractError } = await supabase
        .from('mietvertrag')
        .select(`
          id,
          einheit_id,
          kaltmiete,
          betriebskosten,
          status,
          start_datum,
          ende_datum
        `)
        .in('id', otherContractIds)
        .in('status', ['aktiv', 'gekuendigt']); // Only active or terminated contracts

      if (contractError) throw contractError;
      if (!contracts?.length) return [];

      // Fetch einheit details separately
      const einheitIds = contracts.map(c => c.einheit_id).filter(Boolean);
      const { data: einheiten, error: einheitError } = await supabase
        .from('einheiten')
        .select(`
          id,
          etage,
          qm,
          immobilie_id
        `)
        .in('id', einheitIds);

      if (einheitError) throw einheitError;

      // Fetch immobilien details
      const immobilieIds = [...new Set(einheiten?.map(e => e.immobilie_id).filter(Boolean) || [])];
      const { data: immobilien, error: immobilieError } = await supabase
        .from('immobilien')
        .select('id, name, adresse')
        .in('id', immobilieIds);

      if (immobilieError) throw immobilieError;

      // Map data together
      const immobilienMap = new Map(immobilien?.map(i => [i.id, i]) || []);
      const einheitenMap = new Map(
        einheiten?.map(e => [
          e.id,
          {
            ...e,
            immobilie: immobilienMap.get(e.immobilie_id)
          }
        ]) || []
      );

      return contracts.map(contract => ({
        ...contract,
        einheit: einheitenMap.get(contract.einheit_id)
      })) as LinkedContract[];
    },
    enabled: !!currentContractId && mieterIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    linkedContracts,
    isLoading,
    hasLinkedContracts: linkedContracts.length > 0
  };
}
