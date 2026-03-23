-- Sonderfall-Regel: Robert Benson -> Regine Burose (Objekt 12 Ronnenberg, Einheit 01)
-- Zahlungen mit "Benson" im Verwendungszweck werden dem Vertrag von Regine Burose zugeordnet.

INSERT INTO public.sonderfall_regeln (name, beschreibung, match_typ, match_wert, ziel_kategorie, ziel_mieter_name, confidence)
VALUES (
  'Robert Benson → Regine Burose',
  'Zahlungen von Robert Benson im Verwendungszweck werden Regine Burose (Objekt 12 Ronnenberg, Einheit 01) zugeordnet',
  'name_in_verwendungszweck',
  'benson',
  'Nebenkosten',
  'burose',
  100
);
