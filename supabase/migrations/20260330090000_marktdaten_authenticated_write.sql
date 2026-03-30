-- Authenticated User duerfen marktdaten lesen und manuell korrigieren
-- (Admin-Check findet im Frontend via useUserRole statt)
CREATE POLICY "marktdaten_authenticated_write" ON public.marktdaten
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
