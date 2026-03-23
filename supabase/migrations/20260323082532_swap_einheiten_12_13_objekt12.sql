-- Feature 4: Einheiten 12 & 13 in Objekt 12 (Ronnenberg) tauschen
-- Tauscht alle zugehoerigen Daten (Mietvertraege, Zaehlerstaende, Nebenkosten etc.)
--
-- ACHTUNG: Vor Ausfuehrung Backup erstellen!
-- ACHTUNG: Die WHERE-Bedingung fuer Objekt 12 muss ggf. angepasst werden.
--
-- Strategie: Wir tauschen die `zaehler`-Nummer und alle zugehoerigen Meter-Felder
-- der beiden einheiten-Datensaetze, anstatt die FK-Referenzen zu swappen.
-- Das ist sicherer, weil dann alle Referenzen (mietvertrag, zaehlerstand_historie etc.)
-- stabil bleiben und auf die gleichen einheiten-IDs zeigen.

DO $$
DECLARE
  v_immobilie_id UUID;
  v_einheit_12_id UUID;
  v_einheit_13_id UUID;
  -- Temp vars fuer Einheit 12
  v_12_zaehler NUMERIC;
  v_12_kaltwasser_zaehler TEXT;
  v_12_warmwasser_zaehler TEXT;
  v_12_strom_zaehler TEXT;
  v_12_gas_zaehler TEXT;
  v_12_kaltwasser_stand NUMERIC;
  v_12_warmwasser_stand NUMERIC;
  v_12_strom_stand NUMERIC;
  v_12_gas_stand NUMERIC;
  v_12_qm NUMERIC;
  v_12_etage TEXT;
  v_12_einheitentyp TEXT;
  v_12_anzahl_personen INT;
  v_12_verteilerschluessel_art TEXT;
  v_12_verteilerschluessel_wert NUMERIC;
  -- Temp vars fuer Einheit 13
  v_13_zaehler NUMERIC;
  v_13_kaltwasser_zaehler TEXT;
  v_13_warmwasser_zaehler TEXT;
  v_13_strom_zaehler TEXT;
  v_13_gas_zaehler TEXT;
  v_13_kaltwasser_stand NUMERIC;
  v_13_warmwasser_stand NUMERIC;
  v_13_strom_stand NUMERIC;
  v_13_gas_stand NUMERIC;
  v_13_qm NUMERIC;
  v_13_etage TEXT;
  v_13_einheitentyp TEXT;
  v_13_anzahl_personen INT;
  v_13_verteilerschluessel_art TEXT;
  v_13_verteilerschluessel_wert NUMERIC;
BEGIN
  -- 1. Objekt 12 Ronnenberg finden
  SELECT id INTO v_immobilie_id
  FROM public.immobilien
  WHERE name ILIKE '%ronnenberg%' OR name ILIKE '%objekt 12%'
  LIMIT 1;

  IF v_immobilie_id IS NULL THEN
    RAISE EXCEPTION 'Objekt 12 Ronnenberg nicht gefunden! Bitte name-Filter anpassen.';
  END IF;

  -- 2. Einheiten 12 und 13 finden
  SELECT id INTO v_einheit_12_id
  FROM public.einheiten
  WHERE immobilie_id = v_immobilie_id AND zaehler = 12;

  SELECT id INTO v_einheit_13_id
  FROM public.einheiten
  WHERE immobilie_id = v_immobilie_id AND zaehler = 13;

  IF v_einheit_12_id IS NULL OR v_einheit_13_id IS NULL THEN
    RAISE EXCEPTION 'Einheit 12 (%) oder 13 (%) nicht gefunden!', v_einheit_12_id, v_einheit_13_id;
  END IF;

  RAISE NOTICE 'Tausche Einheit 12 (%) mit Einheit 13 (%) in Objekt %', v_einheit_12_id, v_einheit_13_id, v_immobilie_id;

  -- 3. Werte von Einheit 12 lesen
  SELECT zaehler, kaltwasser_zaehler, warmwasser_zaehler, strom_zaehler, gas_zaehler,
         kaltwasser_stand_aktuell, warmwasser_stand_aktuell, strom_stand_aktuell, gas_stand_aktuell,
         qm, etage, einheitentyp, anzahl_personen, verteilerschluessel_art, verteilerschluessel_wert
  INTO v_12_zaehler, v_12_kaltwasser_zaehler, v_12_warmwasser_zaehler, v_12_strom_zaehler, v_12_gas_zaehler,
       v_12_kaltwasser_stand, v_12_warmwasser_stand, v_12_strom_stand, v_12_gas_stand,
       v_12_qm, v_12_etage, v_12_einheitentyp, v_12_anzahl_personen, v_12_verteilerschluessel_art, v_12_verteilerschluessel_wert
  FROM public.einheiten WHERE id = v_einheit_12_id;

  -- 4. Werte von Einheit 13 lesen
  SELECT zaehler, kaltwasser_zaehler, warmwasser_zaehler, strom_zaehler, gas_zaehler,
         kaltwasser_stand_aktuell, warmwasser_stand_aktuell, strom_stand_aktuell, gas_stand_aktuell,
         qm, etage, einheitentyp, anzahl_personen, verteilerschluessel_art, verteilerschluessel_wert
  INTO v_13_zaehler, v_13_kaltwasser_zaehler, v_13_warmwasser_zaehler, v_13_strom_zaehler, v_13_gas_zaehler,
       v_13_kaltwasser_stand, v_13_warmwasser_stand, v_13_strom_stand, v_13_gas_stand,
       v_13_qm, v_13_etage, v_13_einheitentyp, v_13_anzahl_personen, v_13_verteilerschluessel_art, v_13_verteilerschluessel_wert
  FROM public.einheiten WHERE id = v_einheit_13_id;

  -- 5. Einheit 12 bekommt Werte von Einheit 13
  UPDATE public.einheiten SET
    zaehler = v_13_zaehler,
    kaltwasser_zaehler = v_13_kaltwasser_zaehler,
    warmwasser_zaehler = v_13_warmwasser_zaehler,
    strom_zaehler = v_13_strom_zaehler,
    gas_zaehler = v_13_gas_zaehler,
    kaltwasser_stand_aktuell = v_13_kaltwasser_stand,
    warmwasser_stand_aktuell = v_13_warmwasser_stand,
    strom_stand_aktuell = v_13_strom_stand,
    gas_stand_aktuell = v_13_gas_stand,
    qm = v_13_qm,
    etage = v_13_etage,
    einheitentyp = v_13_einheitentyp,
    anzahl_personen = v_13_anzahl_personen,
    verteilerschluessel_art = v_13_verteilerschluessel_art,
    verteilerschluessel_wert = v_13_verteilerschluessel_wert,
    aktualisiert_am = now()
  WHERE id = v_einheit_12_id;

  -- 6. Einheit 13 bekommt Werte von Einheit 12
  UPDATE public.einheiten SET
    zaehler = v_12_zaehler,
    kaltwasser_zaehler = v_12_kaltwasser_zaehler,
    warmwasser_zaehler = v_12_warmwasser_zaehler,
    strom_zaehler = v_12_strom_zaehler,
    gas_zaehler = v_12_gas_zaehler,
    kaltwasser_stand_aktuell = v_12_kaltwasser_stand,
    warmwasser_stand_aktuell = v_12_warmwasser_stand,
    strom_stand_aktuell = v_12_strom_stand,
    gas_stand_aktuell = v_12_gas_stand,
    qm = v_12_qm,
    etage = v_12_etage,
    einheitentyp = v_12_einheitentyp,
    anzahl_personen = v_12_anzahl_personen,
    verteilerschluessel_art = v_12_verteilerschluessel_art,
    verteilerschluessel_wert = v_12_verteilerschluessel_wert,
    aktualisiert_am = now()
  WHERE id = v_einheit_13_id;

  RAISE NOTICE 'Einheiten 12 und 13 erfolgreich getauscht!';
END $$;
