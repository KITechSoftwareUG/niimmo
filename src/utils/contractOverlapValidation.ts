import { supabase } from "@/integrations/supabase/client";

export interface ContractOverlapCheck {
  hasOverlap: boolean;
  overlappingContracts: Array<{
    id: string;
    startDate: string;
    endDate: string | null;
    tenantNames: string;
    status: string;
  }>;
  warningMessage?: string;
}

/**
 * Checks if a contract's date range overlaps with existing contracts for the same unit
 * @param einheitId - The unit ID to check contracts for
 * @param newStartDate - The start date of the new/updated contract
 * @param newEndDate - The end date of the new/updated contract (optional)
 * @param excludeContractId - Contract ID to exclude from check (when updating existing contract)
 * @returns ContractOverlapCheck object with overlap information
 */
export async function checkContractOverlap(
  einheitId: string,
  newStartDate: string,
  newEndDate: string | null = null,
  excludeContractId: string | null = null
): Promise<ContractOverlapCheck> {
  try {
    // Fetch all contracts for this unit (active, terminated, and ended)
    let query = supabase
      .from('mietvertrag')
      .select(`
        id,
        start_datum,
        ende_datum,
        kuendigungsdatum,
        status,
        mietvertrag_mieter (
          mieter:mieter_id (
            vorname,
            nachname
          )
        )
      `)
      .eq('einheit_id', einheitId)
      .in('status', ['aktiv', 'gekuendigt', 'beendet']);

    // Exclude current contract if updating
    if (excludeContractId) {
      query = query.neq('id', excludeContractId);
    }

    const { data: existingContracts, error } = await query;

    if (error) {
      // error is rethrown
      throw error;
    }

    if (!existingContracts || existingContracts.length === 0) {
      return { hasOverlap: false, overlappingContracts: [] };
    }

    const overlappingContracts: ContractOverlapCheck['overlappingContracts'] = [];
    const newStart = new Date(newStartDate);
    const newEnd = newEndDate ? new Date(newEndDate) : null;

    for (const contract of existingContracts) {
      const existingStart = new Date(contract.start_datum);
      
      // Determine the effective end date of existing contract
      let existingEnd: Date | null = null;
      if (contract.status === 'beendet' && contract.kuendigungsdatum) {
        existingEnd = new Date(contract.kuendigungsdatum);
      } else if (contract.status === 'gekuendigt' && contract.kuendigungsdatum) {
        existingEnd = new Date(contract.kuendigungsdatum);
      } else if (contract.ende_datum) {
        existingEnd = new Date(contract.ende_datum);
      }
      // If no end date, the contract is ongoing (existingEnd = null)

      // Check for overlap
      const hasOverlap = checkDateRangeOverlap(
        newStart,
        newEnd,
        existingStart,
        existingEnd
      );

      if (hasOverlap) {
        // Get tenant names
        const tenantNames = contract.mietvertrag_mieter
          ?.map((mm: any) => `${mm.mieter.vorname} ${mm.mieter.nachname}`)
          .join(', ') || 'Unbekannt';

        overlappingContracts.push({
          id: contract.id,
          startDate: contract.start_datum,
          endDate: contract.ende_datum || contract.kuendigungsdatum,
          tenantNames,
          status: contract.status
        });
      }
    }

    const hasOverlap = overlappingContracts.length > 0;
    let warningMessage: string | undefined;

    if (hasOverlap) {
      const contractCount = overlappingContracts.length;
      const firstContract = overlappingContracts[0];
      
      warningMessage = `⚠️ Achtung: Das Startdatum überschneidet sich mit ${contractCount} bestehenden Vertrag${contractCount > 1 ? 'en' : ''} für diese Einheit.\n\n`;
      
      if (contractCount === 1) {
        warningMessage += `Bestehender Vertrag mit ${firstContract.tenantNames} (${firstContract.status}):\n`;
        warningMessage += `Von ${formatDate(firstContract.startDate)}`;
        if (firstContract.endDate) {
          warningMessage += ` bis ${formatDate(firstContract.endDate)}`;
        } else {
          warningMessage += ` (unbefristet)`;
        }
      } else {
        warningMessage += `Mehrere Verträge überschneiden sich. Bitte prüfen Sie die Vertragslaufzeiten.`;
      }
    }

    return {
      hasOverlap,
      overlappingContracts,
      warningMessage
    };
  } catch (error) {
    return { hasOverlap: false, overlappingContracts: [] };
  }
}

/**
 * Helper function to check if two date ranges overlap
 */
function checkDateRangeOverlap(
  start1: Date,
  end1: Date | null,
  start2: Date,
  end2: Date | null
): boolean {
  // If either range has no end date, it extends indefinitely
  const range1EndIsInfinite = end1 === null;
  const range2EndIsInfinite = end2 === null;

  // Case 1: Both ranges are infinite
  if (range1EndIsInfinite && range2EndIsInfinite) {
    // They overlap if either starts before or at the same time as the other
    return true;
  }

  // Case 2: First range is infinite
  if (range1EndIsInfinite) {
    // start1 must be before end2 to overlap
    return start1 <= (end2 as Date);
  }

  // Case 3: Second range is infinite
  if (range2EndIsInfinite) {
    // start2 must be before end1 to overlap
    return start2 <= (end1 as Date);
  }

  // Case 4: Both ranges have end dates
  // Ranges overlap if: start1 <= end2 && end1 >= start2
  return start1 <= (end2 as Date) && (end1 as Date) >= start2;
}

/**
 * Helper function to format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
