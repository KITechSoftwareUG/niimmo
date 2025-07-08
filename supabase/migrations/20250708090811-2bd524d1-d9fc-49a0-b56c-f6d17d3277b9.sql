
-- Füge eine Kategorie-Spalte zur zahlungen-Tabelle hinzu
ALTER TABLE public.zahlungen 
ADD COLUMN kategorie public.zahlkategorien DEFAULT 'Miete (unklar)';

-- Erstelle einen Index für bessere Performance
CREATE INDEX idx_zahlungen_kategorie ON public.zahlungen(kategorie);

-- Kommentar zur Spalte hinzufügen
COMMENT ON COLUMN public.zahlungen.kategorie IS 'Kategorisierung der Zahlung: Miete (komplett), Miete (unklar), Nichtmiete';
