-- Funktion zur automatischen Mahnstufen-Prüfung
CREATE OR REPLACE FUNCTION public.check_and_update_mahnstufen()
RETURNS TABLE(
  mietvertrag_id uuid,
  alte_mahnstufe integer,
  neue_mahnstufe integer,
  grund text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vertrag_record RECORD;
  forderung_record RECORD;
  zahlung_exists boolean;
  forderung_datum date;
  neue_stufe integer;
BEGIN
  -- Gehe durch alle aktiven Mietverträge
  FOR vertrag_record IN 
    SELECT * FROM mietvertrag 
    WHERE status = 'aktiv'
  LOOP
    neue_stufe := COALESCE(vertrag_record.mahnstufe, 0);
    
    -- Prüfe alle Forderungen für diesen Vertrag
    FOR forderung_record IN
      SELECT * FROM mietforderungen 
      WHERE mietvertrag_id = vertrag_record.id
      ORDER BY sollmonat
    LOOP
      -- Bestimme das Fälligkeitsdatum (1. des Folgemonats)
      forderung_datum := (forderung_record.sollmonat || '-01')::date + INTERVAL '1 month';
      
      -- Prüfe ob eine Zahlung im ±7 Tage Zeitraum existiert
      SELECT EXISTS(
        SELECT 1 FROM zahlungen z
        WHERE z.mietvertrag_id = vertrag_record.id
        AND z.buchungsdatum BETWEEN (forderung_datum - INTERVAL '7 days') 
                                AND (forderung_datum + INTERVAL '7 days')
        AND ABS(z.betrag - forderung_record.sollbetrag) <= 50 -- Toleranz von 50€
      ) INTO zahlung_exists;
      
      -- Wenn keine passende Zahlung gefunden und Fälligkeitsdatum überschritten
      IF NOT zahlung_exists AND forderung_datum < CURRENT_DATE THEN
        -- Erhöhe Mahnstufe, aber max. 3
        neue_stufe := LEAST(neue_stufe + 1, 3);
        
        -- Aktualisiere den Mietvertrag
        UPDATE mietvertrag 
        SET 
          mahnstufe = neue_stufe,
          letzte_mahnung_am = CURRENT_TIMESTAMP,
          naechste_mahnung_am = CURRENT_DATE + INTERVAL '30 days'
        WHERE id = vertrag_record.id;
        
        -- Rückgabe für Logging
        mietvertrag_id := vertrag_record.id;
        alte_mahnstufe := COALESCE(vertrag_record.mahnstufe, 0);
        neue_mahnstufe := neue_stufe;
        grund := 'Keine Zahlung für ' || forderung_record.sollmonat || ' im ±7 Tage Zeitraum gefunden';
        
        RETURN NEXT;
        
        -- Verlasse die Schleife nach der ersten unbezahlten Forderung
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN;
END;
$$;