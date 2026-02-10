
-- 1) IBAN im Mietvertrag korrigieren
UPDATE public.mietvertrag 
SET bankkonto_mieter = 'DE62250501801904296971',
    bankkonto_mieter_geprueft = false
WHERE id = 'a144419f-1c75-4a18-8d95-39411eed0ec7';

-- 2) Alle 6 falsch zugeordneten Darlehens-Zahlungen auf Nichtmiete setzen und Zuordnung entfernen
UPDATE public.zahlungen 
SET kategorie = 'Nichtmiete',
    mietvertrag_id = NULL
WHERE id IN (
  '3e9c32ee-f494-4423-8fc8-7fc215091046',
  'e9cffd5e-de83-481e-bfdc-d84443ce9720',
  'a6fd0299-5143-4703-8115-ae1d876a89ac',
  'adbbc892-a639-4515-b691-95d39ba62a97',
  '00c9cfe3-cf02-4d61-8a39-2f9e2487027a',
  '9f632883-e507-43f3-ad1f-1687acbde8eb'
);
