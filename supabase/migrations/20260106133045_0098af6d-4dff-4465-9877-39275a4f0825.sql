-- 1. Enum für App-Rollen erstellen
CREATE TYPE public.app_role AS ENUM ('admin', 'hausmeister');

-- 2. User Roles Tabelle erstellen
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. RLS aktivieren
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security Definer Funktion zum Prüfen der Rolle
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Funktion zum Prüfen ob User Admin ist
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- 6. Funktion zum Prüfen ob User Hausmeister ist
CREATE OR REPLACE FUNCTION public.is_hausmeister(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'hausmeister')
$$;

-- 7. RLS Policy für user_roles Tabelle (nur Admins können Rollen verwalten)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 8. Einheiten: Hausmeister darf Zählernummern updaten
DROP POLICY IF EXISTS "Authenticated users can update einheiten data" ON public.einheiten;
CREATE POLICY "Admin or Hausmeister can update einheiten"
ON public.einheiten
FOR UPDATE
USING (public.is_admin(auth.uid()) OR public.is_hausmeister(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_hausmeister(auth.uid()));

-- 9. Mietvertrag: Hausmeister darf Zählerstände updaten
DROP POLICY IF EXISTS "Authenticated users can update mietvertrag data" ON public.mietvertrag;
CREATE POLICY "Admin or Hausmeister can update mietvertrag"
ON public.mietvertrag
FOR UPDATE
USING (public.is_admin(auth.uid()) OR public.is_hausmeister(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_hausmeister(auth.uid()));

-- 10. Zahlungen: Nur Admin darf Zahlungen sehen
DROP POLICY IF EXISTS "Authenticated users can view all payments" ON public.zahlungen;
CREATE POLICY "Only admin can view payments"
ON public.zahlungen
FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.zahlungen;
CREATE POLICY "Only admin can insert payments"
ON public.zahlungen
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.zahlungen;
CREATE POLICY "Only admin can update payments"
ON public.zahlungen
FOR UPDATE
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete payments" ON public.zahlungen;
CREATE POLICY "Only admin can delete payments"
ON public.zahlungen
FOR DELETE
USING (public.is_admin(auth.uid()));

-- 11. Dokumente: Nur Admin
DROP POLICY IF EXISTS "Public access dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Policy_documents" ON public.dokumente;
DROP POLICY IF EXISTS "Allow read for anon" ON public.dokumente;

CREATE POLICY "Only admin can access dokumente"
ON public.dokumente
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 12. Mietforderungen: Nur Admin
DROP POLICY IF EXISTS "Policy_documents" ON public.mietforderungen;

CREATE POLICY "Only admin can access mietforderungen"
ON public.mietforderungen
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 13. Immobilien INSERT/DELETE nur Admin
DROP POLICY IF EXISTS "Authenticated users can insert immobilien data" ON public.immobilien;
DROP POLICY IF EXISTS "Authenticated users can delete immobilien data" ON public.immobilien;

CREATE POLICY "Only admin can insert immobilien"
ON public.immobilien
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admin can delete immobilien"
ON public.immobilien
FOR DELETE
USING (public.is_admin(auth.uid()));

-- 14. Einheiten INSERT/DELETE nur Admin
DROP POLICY IF EXISTS "Authenticated users can insert einheiten data" ON public.einheiten;
DROP POLICY IF EXISTS "Authenticated users can delete einheiten data" ON public.einheiten;

CREATE POLICY "Only admin can insert einheiten"
ON public.einheiten
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admin can delete einheiten"
ON public.einheiten
FOR DELETE
USING (public.is_admin(auth.uid()));

-- 15. Mietvertrag INSERT/DELETE nur Admin
DROP POLICY IF EXISTS "Authenticated users can insert mietvertrag data" ON public.mietvertrag;
DROP POLICY IF EXISTS "Authenticated users can delete mietvertrag data" ON public.mietvertrag;

CREATE POLICY "Only admin can insert mietvertrag"
ON public.mietvertrag
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admin can delete mietvertrag"
ON public.mietvertrag
FOR DELETE
USING (public.is_admin(auth.uid()));

-- 16. Mieter INSERT/DELETE nur Admin
DROP POLICY IF EXISTS "Authenticated users can insert mieter data" ON public.mieter;
DROP POLICY IF EXISTS "Authenticated users can delete mieter data" ON public.mieter;
DROP POLICY IF EXISTS "Authenticated users can update mieter data" ON public.mieter;

CREATE POLICY "Only admin can insert mieter"
ON public.mieter
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admin can delete mieter"
ON public.mieter
FOR DELETE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admin can update mieter"
ON public.mieter
FOR UPDATE
USING (public.is_admin(auth.uid()));