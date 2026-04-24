-- RLS SELECT-Policy für agent_logs
-- Nur Admins dürfen lesen; INSERT/UPDATE/DELETE kommen via service_role (umgeht RLS)
CREATE POLICY "admins_can_read_agent_logs"
  ON public.agent_logs
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));
