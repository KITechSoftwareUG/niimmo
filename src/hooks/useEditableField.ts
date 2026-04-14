/**
 * Centralized hook for consistent field editing functionality
 * Replaces duplicate editing logic across components
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export interface EditingCell {
  id: string;
  field: string;
  value: any;
  originalValue: any;
}

export interface FieldConfig {
  table: 'mietvertrag' | 'einheiten' | 'immobilien' | 'mieter';
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'boolean';
}

export const useEditableField = () => {
  const [editingCells, setEditingCells] = useState<EditingCell[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startEditing = useCallback((id: string, field: string, currentValue: any) => {
    const existingIndex = editingCells.findIndex(
      cell => cell.id === id && cell.field === field
    );
    
    if (existingIndex >= 0) return;
    
    setEditingCells(prev => [
      ...prev,
      { id, field, value: currentValue, originalValue: currentValue }
    ]);
  }, [editingCells]);

  const updateValue = useCallback((id: string, field: string, value: any) => {
    setEditingCells(prev =>
      prev.map(cell =>
        cell.id === id && cell.field === field
          ? { ...cell, value }
          : cell
      )
    );
  }, []);

  const cancelEdit = useCallback((id: string, field: string) => {
    setEditingCells(prev =>
      prev.filter(cell => !(cell.id === id && cell.field === field))
    );
  }, []);

  const getEditingValue = useCallback((id: string, field: string) => {
    const cell = editingCells.find(c => c.id === id && c.field === field);
    return cell ? cell.value : null;
  }, [editingCells]);

  const isFieldEditing = useCallback((id: string, field: string) => {
    return editingCells.some(cell => cell.id === id && cell.field === field);
  }, [editingCells]);

  /**
   * Unified save function for all field types
   */
  const saveSingleField = useCallback(async (
    id: string, 
    field: string, 
    fieldConfig: FieldConfig
  ): Promise<boolean> => {
    const editingCell = editingCells.find(cell => cell.id === id && cell.field === field);
    if (!editingCell) return false;

    try {
      const { table, required } = fieldConfig;
      
      // Validation
      if (required && (!editingCell.value || editingCell.value.toString().trim() === '')) {
        toast({
          title: "Fehler",
          description: "Dieses Feld ist erforderlich und kann nicht leer sein.",
          variant: "destructive",
        });
        return false;
      }

      // Convert value based on type
      let processedValue = editingCell.value;
      if (fieldConfig.type === 'number' && processedValue !== null && processedValue !== '') {
        processedValue = Number(processedValue);
        if (isNaN(processedValue)) {
          toast({
            title: "Fehler",
            description: "Bitte geben Sie eine gültige Zahl ein.",
            variant: "destructive",
          });
          return false;
        }
      }

      // Determine the column name (remove prefix if exists)
      const columnName = field.includes('.') ? field.split('.')[1] : field;

      // Update in database
      const { error } = await supabase
        .from(table)
        .update({ [columnName]: processedValue })
        .eq('id', id);

      if (error) throw error;

      // Remove from editing state
      cancelEdit(id, field);

      // Refresh related queries
      queryClient.invalidateQueries({ queryKey: [table] });
      queryClient.invalidateQueries({ queryKey: ['mietvertrag-mit-details'] });
      
      toast({
        title: "Erfolg",
        description: "Änderung erfolgreich gespeichert.",
      });

      return true;
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Änderung.",
        variant: "destructive",
      });
      return false;
    }
  }, [editingCells, toast, queryClient, cancelEdit]);

  const hasUnsavedChanges = editingCells.length > 0;

  const discardAllChanges = useCallback(() => {
    setEditingCells([]);
  }, []);

  return {
    editingCells,
    startEditing,
    updateValue,
    cancelEdit,
    getEditingValue,
    isFieldEditing,
    saveSingleField,
    hasUnsavedChanges,
    discardAllChanges
  };
};