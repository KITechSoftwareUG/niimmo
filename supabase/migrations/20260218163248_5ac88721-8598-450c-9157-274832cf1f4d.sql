-- Nichtmiete-Regel: Alle Zahlungen an "Stadt" als Empfänger = kommunale Abgaben = Nichtmiete
INSERT INTO public.nichtmiete_regeln (regel_typ, wert, beschreibung, aktiv)
VALUES 
  ('empfaenger_contains', 'Stadt ', 'Kommunale Abgaben (Grundsteuer, Abwasser etc.)', true),
  ('empfaenger_contains', 'Gemeinde ', 'Kommunale Abgaben von Gemeinden', true),
  ('empfaenger_contains', 'Klarna', 'Klarna Refunds/Zahlungen', true);