
-- Darlehen anlegen
INSERT INTO public.darlehen (
  id, bezeichnung, darlehensbetrag, restschuld, bank, kontonummer,
  monatliche_rate, zinssatz_prozent,
  ende_datum, notizen
) VALUES (
  gen_random_uuid(),
  'Kredit Objekt 9 Bennigsen',
  680000.00,
  655733.00,
  'Volksbank (BIC: GENODEF1BCK)',
  'DE06 2559 1413 3155 4105 40',
  3258.33,
  4.25,
  '2032-08-30'::date,
  'Zinsbindungsende 30.08.2032. Restschuld zum Zinsbindungsende: 570.586,40 EUR. Abbuchungskonto: DE89 2559 1413 3155 4105 01'
);

-- Zuordnung zur Immobilie Objekt 9 Bennigsen
INSERT INTO public.darlehen_immobilien (darlehen_id, immobilie_id)
SELECT d.id, '00000000-0000-0000-0000-000000000009'::uuid
FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';

-- Tilgungsplan-Zahlungen 2026 (monatlich)
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-02-01'::date, 3258.33, 935.94, 2322.39, 654797.06 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-03-01'::date, 3258.33, 939.26, 2319.07, 653857.80 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-04-01'::date, 3258.33, 942.58, 2315.75, 652915.22 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-05-01'::date, 3258.33, 945.92, 2312.41, 651969.30 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-06-01'::date, 3258.33, 949.27, 2309.06, 651020.03 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-07-01'::date, 3258.33, 952.63, 2305.70, 650067.40 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-08-01'::date, 3258.33, 956.01, 2302.32, 649111.39 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-09-01'::date, 3258.33, 959.39, 2298.94, 648152.00 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-10-01'::date, 3258.33, 962.79, 2295.54, 647189.21 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-11-01'::date, 3258.33, 966.20, 2292.13, 646223.01 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
INSERT INTO public.darlehen_zahlungen (darlehen_id, buchungsdatum, betrag, tilgungsanteil, zinsanteil, restschuld_danach)
SELECT d.id, '2026-12-01'::date, 3258.33, 969.62, 2288.71, 645253.39 FROM darlehen d WHERE d.bezeichnung = 'Kredit Objekt 9 Bennigsen';
