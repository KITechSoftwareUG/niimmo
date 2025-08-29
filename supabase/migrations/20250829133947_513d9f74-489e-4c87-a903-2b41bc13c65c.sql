-- Setze alle Mahnstufen auf 0 zurück
UPDATE mietvertrag 
SET mahnstufe = 0, 
    letzte_mahnung_am = NULL,
    naechste_mahnung_am = NULL,
    aktualisiert_am = now();