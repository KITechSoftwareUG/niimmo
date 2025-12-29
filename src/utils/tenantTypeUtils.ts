/**
 * Utility functions for determining tenant/contract type based on unit type
 */

// Einheitentypen die als "Gewerbe" gelten
const GEWERBE_EINHEITENTYPEN = ['Gewerbe', 'Lager', 'Büro'];

/**
 * Prüft ob ein Einheitentyp als Gewerbe gilt
 */
export const isGewerbeEinheit = (einheitentyp: string | null | undefined): boolean => {
  if (!einheitentyp) return false;
  return GEWERBE_EINHEITENTYPEN.includes(einheitentyp);
};

/**
 * Gibt den Vertragstyp basierend auf dem Einheitentyp zurück
 */
export const getVertragstyp = (einheitentyp: string | null | undefined): 'Gewerbe' | 'Privat' => {
  return isGewerbeEinheit(einheitentyp) ? 'Gewerbe' : 'Privat';
};

/**
 * Gibt die Farben für den Vertragstyp-Badge zurück
 */
export const getVertragstypColors = (vertragstyp: 'Gewerbe' | 'Privat') => {
  if (vertragstyp === 'Gewerbe') {
    return {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200'
    };
  }
  return {
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    border: 'border-teal-200'
  };
};
