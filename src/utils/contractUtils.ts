/**
 * Centralized contract and property utility functions
 * Replaces duplicate logic across components
 */

import { supabase } from "@/integrations/supabase/client";

export interface ContractFilter {
  mietstatus: "all" | "aktiv" | "gekuendigt" | "beendet";
  zahlungsstatus: "all" | "paid" | "unpaid";
}

export interface SortConfig {
  field: string | null;
  direction: "asc" | "desc";
}

/**
 * Filters contracts based on status (active + terminated only, excluding ended contracts)
 */
export const filterActiveAndTerminatedContracts = (contracts: any[]): any[] => {
  return contracts.filter(contract => 
    contract.status === 'aktiv' || contract.status === 'gekuendigt'
  );
};

/**
 * Sorts units by number (ascending), with fallbacks to creation date and ID
 */
export const sortUnitsByNumber = (units: any[]): any[] => {
  return units.sort((a, b) => {
    const extractNum = (val?: string | number) => {
      if (val == null) return null;
      const s = val.toString();
      const match = s.match(/\d+/g);
      if (match && match.length) {
        return parseInt(match.join(''), 10);
      }
      return null;
    };
    
    const aNum = extractNum(a.nummer);
    const bNum = extractNum(b.nummer);
    
    if (aNum != null && bNum != null && aNum !== bNum) {
      return aNum - bNum;
    }
    if (aNum != null && bNum == null) return -1;
    if (aNum == null && bNum != null) return 1;
    
    // Fallback: sort by creation date
    const aCreated = a.erstellt_am ? new Date(a.erstellt_am).getTime() : 0;
    const bCreated = b.erstellt_am ? new Date(b.erstellt_am).getTime() : 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    
    // Final fallback: ID
    return (a.id || '').localeCompare(b.id || '');
  });
};

/**
 * Sorts properties alphabetically by name (ascending) with natural number sorting
 */
export const sortPropertiesByName = (properties: any[]): any[] => {
  return properties.sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });
};

/**
 * Gets the most current rental contract for a unit
 * Priority: 1. Active contracts, 2. Most recent by start date
 */
export const getCurrentContract = (contracts: any[]): any | null => {
  if (contracts.length === 0) return null;
  
  // First, try to find an active contract
  const activeContract = contracts.find(c => c.status === 'aktiv');
  if (activeContract) return activeContract;
  
  // If no active contract, find the most recent one by start date
  return contracts.reduce((latest, current) => {
    const latestDate = latest.start_datum ? new Date(latest.start_datum) : new Date(0);
    const currentDate = current.start_datum ? new Date(current.start_datum) : new Date(0);
    return currentDate > latestDate ? current : latest;
  });
};

/**
 * Formats currency values consistently
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '€0';
  return `€${Number(value).toLocaleString('de-DE')}`;
};

/**
 * Formats area values consistently
 */
export const formatArea = (value: number | null | undefined): string => {
  if (value == null) return '0 m²';
  return `${value} m²`;
};