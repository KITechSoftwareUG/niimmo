-- Bestätige alle existierenden Zahlungen (die vor dem Feature existierten)
-- Diese haben bereits die Wartezeit überschritten
UPDATE public.zahlungen 
SET lastschrift_bestaetigt_am = NOW() 
WHERE lastschrift_bestaetigt_am IS NULL;