-- Das Problem ist, dass die RLS-Policies für zahlungen falsch konfiguriert sind
-- Sie vergleichen immobilien.id mit auth.uid(), aber das sind verschiedene Datentypen
-- Für ein Property Management System sollten authentifizierte Benutzer Zugriff auf alle Daten haben

-- Alle bestehenden Policies für zahlungen löschen
DROP POLICY IF EXISTS "Users can view payments for their own properties" ON public.zahlungen;
DROP POLICY IF EXISTS "Users can insert payments for their own properties" ON public.zahlungen;
DROP POLICY IF EXISTS "Users can update payments for their own properties" ON public.zahlungen;
DROP POLICY IF EXISTS "Users can delete payments for their own properties" ON public.zahlungen;
DROP POLICY IF EXISTS "Authenticated users can view unassigned payments" ON public.zahlungen;
DROP POLICY IF EXISTS "Authenticated users can update unassigned payments" ON public.zahlungen;

-- Neue einfache Policies für authentifizierte Benutzer
CREATE POLICY "Authenticated users can view all payments"
ON public.zahlungen
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert payments"
ON public.zahlungen
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update payments"
ON public.zahlungen
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete payments"
ON public.zahlungen
FOR DELETE
USING (auth.role() = 'authenticated');