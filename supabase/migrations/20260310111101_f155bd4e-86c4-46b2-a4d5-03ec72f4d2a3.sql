
INSERT INTO einheiten (id, immobilie_id, einheitentyp, etage, qm)
VALUES ('00000000-0000-0000-0000-000000001214', '00000000-0000-0000-0000-000000000012', 'Sonstiges', 'Gartenhaus', NULL);

UPDATE immobilien SET einheiten_anzahl = 14 WHERE id = '00000000-0000-0000-0000-000000000012';
