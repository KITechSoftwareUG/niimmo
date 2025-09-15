/**
 * Centralized hook for contract filtering and sorting logic
 * Replaces duplicate filtering/sorting code across components
 */

import { useMemo, useState } from "react";
import { ContractFilter, SortConfig, filterActiveAndTerminatedContracts } from "@/utils/contractUtils";

interface FilterableItem {
  vertrag?: { 
    status?: string; 
    mieter?: Array<{ vorname?: string; nachname?: string }>;
    kaltmiete?: number;
    betriebskosten?: number;
  };
  status?: string;
  immobilie?: { name?: string; adresse?: string };
  einheit?: { nummer?: string; qm?: number };
  mieter?: Array<{ vorname?: string; nachname?: string }>;
  [key: string]: any;
}

export const useContractFiltering = <T extends FilterableItem>(
  data: T[] | undefined,
  defaultFilters: ContractFilter = { mietstatus: "all", zahlungsstatus: "all" }
) => {
  const [filters, setFilters] = useState<ContractFilter>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: "asc" });
  const [searchTerm, setSearchTerm] = useState("");

  // Apply filters and search
  const filteredData = useMemo(() => {
    if (!data) return [];

    let result = [...data];

    // Apply status filter (always exclude ended contracts)
    result = result.filter(item => {
      const status = item.vertrag?.status || item.status;
      return status === 'aktiv' || status === 'gekuendigt';
    });

    // Apply specific status filter
    if (filters.mietstatus !== "all") {
      result = result.filter(item => {
        const status = item.vertrag?.status || item.status;
        return status === filters.mietstatus;
      });
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(item => {
        // Search in various fields
        const searchableText = [
          item.immobilie?.name,
          item.immobilie?.adresse,
          item.einheit?.nummer,
          item.vertrag?.mieter?.map((m: any) => `${m.vorname} ${m.nachname}`).join(' '),
          item.mieter?.map((m: any) => `${m.vorname} ${m.nachname}`).join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchableText.includes(search);
      });
    }

    return result;
  }, [data, filters, searchTerm]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.field) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue, bValue;

      // Handle nested field access
      if (sortConfig.field.includes('.')) {
        const [object, field] = sortConfig.field.split('.');
        aValue = a[object]?.[field];
        bValue = b[object]?.[field];
      } else {
        aValue = a[sortConfig.field];
        bValue = b[sortConfig.field];
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle different data types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        const diff = aValue.getTime() - bValue.getTime();
        return sortConfig.direction === 'asc' ? diff : -diff;
      }

      // String comparison
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setSearchTerm("");
    setSortConfig({ field: null, direction: "asc" });
  };

  return {
    filteredData: sortedData,
    filters,
    setFilters,
    sortConfig,
    handleSort,
    searchTerm,
    setSearchTerm,
    resetFilters,
    totalCount: data?.length || 0,
    filteredCount: sortedData.length
  };
};