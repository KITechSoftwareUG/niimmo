
-- dev_tickets table
CREATE TABLE public.dev_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  typ text NOT NULL DEFAULT 'feature',
  titel text NOT NULL,
  kurzbeschreibung text,
  beschreibung text,
  status text NOT NULL DEFAULT 'offen',
  prioritaet text NOT NULL DEFAULT 'mittel',
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  erstellt_von uuid,
  screenshot_urls text[],
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.dev_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dev_tickets" ON public.dev_tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admin can insert dev_tickets" ON public.dev_tickets
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admin can update dev_tickets" ON public.dev_tickets
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Only admin can delete dev_tickets" ON public.dev_tickets
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- dev_ticket_kommentare table
CREATE TABLE public.dev_ticket_kommentare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.dev_tickets(id) ON DELETE CASCADE,
  kommentar text NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  erstellt_von uuid
);

ALTER TABLE public.dev_ticket_kommentare ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dev_ticket_kommentare" ON public.dev_ticket_kommentare
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admin can insert dev_ticket_kommentare" ON public.dev_ticket_kommentare
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admin can update dev_ticket_kommentare" ON public.dev_ticket_kommentare
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Only admin can delete dev_ticket_kommentare" ON public.dev_ticket_kommentare
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Auto-update aktualisiert_am on dev_tickets
CREATE TRIGGER update_dev_tickets_updated_at
  BEFORE UPDATE ON public.dev_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
