-- ═══════════════════════════════════════════════════════════════════════════
-- NiImmo: Nativer pg_cron Scheduler — ersetzt n8n vollständig
--
-- Kontext: Die alten pg_cron Jobs (jobid 1–3) verwendeten den Anon-JWT als
-- Bearer-Token. auth.getUser() lehnte diesen ab → 401 → Jobs schlugen still
-- fehl. n8n war daher die einzige funktionierende Scheduler-Lösung.
--
-- Diese Migration:
--   1. Erstellt generate_monthly_mietforderungen() als SQL-Äquivalent der
--      gleichnamigen Edge Function (direkte DB-Ausführung, kein HTTP).
--   2. Entfernt die kaputten alten Jobs (jobid 1–3).
--   3. Registriert 4 neue pg_cron Jobs, die DB-Funktionen direkt aufrufen.
--
-- Hinweis: Die pg_cron-Registrierungen (cron.schedule / cron.unschedule)
-- erfordern erweiterte DB-Rechte und wurden daher über execute_sql angewandt.
-- Diese Datei dokumentiert das vollständige Setup für die Versionsverwaltung.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL-Äquivalent der generate-mietforderungen Edge Function
--
-- Idempotent: Erstellt für jeden aktiven/gekündigten Vertrag die Soll-Miete
-- des aktuellen Monats; aktualisiert falls der Betrag abweicht; überspringt
-- falls bereits korrekt. Anteilige Berechnung für den Einzugsmonat (exakt
-- proportional: verbleibende Tage / Gesamttage des Monats).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_monthly_mietforderungen()
RETURNS TABLE(action text, mietvertrag_id uuid, sollbetrag numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month        date;
  v_contract     RECORD;
  v_betrag       numeric;
  v_start_day    int;
  v_days         int;
  v_remaining    int;
  v_exist_id     uuid;
  v_exist_betrag numeric;
BEGIN
  v_month := date_trunc('month', CURRENT_DATE)::date;  -- z.B. 2026-05-01

  FOR v_contract IN
    SELECT mv.id, mv.kaltmiete, mv.betriebskosten, mv.start_datum
    FROM   mietvertrag mv
    WHERE  mv.status IN ('aktiv', 'gekuendigt')
      AND  mv.start_datum <= CURRENT_DATE
      AND  (mv.ende_datum IS NULL OR mv.ende_datum >= CURRENT_DATE)
      AND  (mv.kuendigungsdatum IS NULL OR mv.kuendigungsdatum > CURRENT_DATE)
  LOOP
    v_betrag := COALESCE(v_contract.kaltmiete, 0) + COALESCE(v_contract.betriebskosten, 0);

    -- Anteilige Berechnung falls Einzug nicht am 1. des Monats
    IF v_contract.start_datum IS NOT NULL
       AND date_trunc('month', v_contract.start_datum)::date = v_month
    THEN
      v_start_day := EXTRACT(DAY FROM v_contract.start_datum)::int;
      IF v_start_day > 1 THEN
        v_days      := EXTRACT(DAY FROM (v_month + INTERVAL '1 month' - INTERVAL '1 day'))::int;
        v_remaining := v_days - v_start_day + 1;
        v_betrag    := ROUND((v_betrag / v_days::numeric) * v_remaining, 2);
      END IF;
    END IF;

    SELECT mf.id, mf.sollbetrag
    INTO   v_exist_id, v_exist_betrag
    FROM   mietforderungen mf
    WHERE  mf.mietvertrag_id = v_contract.id
      AND  mf.sollmonat = v_month;

    IF v_exist_id IS NULL THEN
      INSERT INTO mietforderungen (id, mietvertrag_id, sollmonat, sollbetrag)
      VALUES (gen_random_uuid(), v_contract.id, v_month, v_betrag);
      action := 'created';
      mietvertrag_id := v_contract.id;
      sollbetrag := v_betrag;
      RETURN NEXT;

    ELSIF ABS(COALESCE(v_exist_betrag, 0) - v_betrag) > 0.01 THEN
      UPDATE mietforderungen SET sollbetrag = v_betrag WHERE id = v_exist_id;
      action := 'updated';
      mietvertrag_id := v_contract.id;
      sollbetrag := v_betrag;
      RETURN NEXT;
    END IF;
    -- Betrag unverändert → kein RETURN NEXT (idempotent skip)
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron Jobs (via execute_sql angewandt, da apply_migration keine
-- Rechte auf cron.job hat):
--
-- Alte Jobs entfernen:
--   SELECT cron.unschedule(jobid) FROM cron.job
--   WHERE jobname IN ('daily-faelligkeits-check','check-faelligkeiten-daily',
--                     'generate-mietforderungen-hourly');
--
-- Neue Jobs:
--   cron.schedule('niimmo-generate-mietforderungen', '0 5 * * *',
--     'SELECT generate_monthly_mietforderungen()');
--
--   cron.schedule('niimmo-check-faelligkeiten', '0 6 * * *',
--     'SELECT update_faellige_forderungen()');
--
--   cron.schedule('niimmo-check-mahnstufen', '0 7 * * *',
--     'SELECT check_and_update_mahnstufen()');
--
--   cron.schedule('niimmo-fetch-marktdaten', '0 4 1 * *',
--     'SELECT net.http_post(url:=''...fetch-marktdaten'',
--      headers:=''{"authorization":"Bearer pg-cron-internal"}''::jsonb,
--      body:=''{}''::jsonb)');
-- ─────────────────────────────────────────────────────────────────────────────
