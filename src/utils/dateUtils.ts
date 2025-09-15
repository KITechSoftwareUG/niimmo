/**
 * Centralized date utility functions
 * Replaces scattered date formatting logic across components
 */

import { format } from "date-fns";
import { de } from "date-fns/locale";

export const formatDateForInput = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
};

export const formatDateForDisplay = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'dd.MM.yyyy', { locale: de });
};

export const parseInputDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
};

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
};