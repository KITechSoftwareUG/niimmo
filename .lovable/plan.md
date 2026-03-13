

## Problem
Currently, the Zählerverwaltung only stores the **current** meter reading per unit/property (e.g., `kaltwasser_stand_aktuell`, `kaltwasser_stand_datum` on `einheiten`). When a new reading is saved, the old one is overwritten. There is no history.

## Solution

### 1. New Supabase table: `zaehlerstand_historie`

Create a history table that logs every meter reading change:

```sql
CREATE TABLE public.zaehlerstand_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einheit_id uuid REFERENCES einheiten(id) ON DELETE CASCADE,
  immobilie_id uuid REFERENCES immobilien(id) ON DELETE CASCADE,
  zaehler_typ text NOT NULL, -- 'kaltwasser', 'warmwasser', 'strom', 'gas', 'wasser', 'strom_2', 'gas_2', 'wasser_2'
  zaehler_nummer text,
  stand numeric,
  datum date NOT NULL,
  quelle text DEFAULT 'manuell', -- 'manuell', 'einzug', 'auszug'
  erstellt_am timestamptz DEFAULT now(),
  erstellt_von uuid
);

ALTER TABLE public.zaehlerstand_historie ENABLE ROW LEVEL SECURITY;

-- Admin + Hausmeister can read/write
CREATE POLICY "Admin or Hausmeister can access zaehlerstand_historie"
  ON public.zaehlerstand_historie FOR ALL TO public
  USING (is_admin(auth.uid()) OR is_hausmeister(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_hausmeister(auth.uid()));

-- Authenticated can read
CREATE POLICY "Authenticated can read zaehlerstand_historie"
  ON public.zaehlerstand_historie FOR SELECT TO authenticated
  USING (true);
```

- `einheit_id` is set for unit-level readings, `immobilie_id` for property-level (Hausanschluss) readings.
- `quelle` tracks whether it came from manual entry, Einzug, or Auszug.

### 2. Update save logic in `ZaehlerVerwaltung.tsx`

In `saveUnitChanges` and `savePropertyChanges`, after updating `einheiten`/`immobilien`, also **insert** into `zaehlerstand_historie` with the new stand, datum, zaehler_nummer, and type.

### 3. Display history in the Zählerverwaltung UI

Add a collapsible "Historie" section per unit row (or per property meter). When expanded, it fetches from `zaehlerstand_historie` filtered by `einheit_id` or `immobilie_id`, ordered by `datum DESC`. Display as a small table:

```
Datum       | Typ   | Zähler-Nr | Stand   | Quelle
12.03.2026  | Strom | 12345     | 4521.3  | manuell
01.01.2026  | Strom | 12345     | 4200.0  | einzug
```

Use a `Collapsible` with a small "Historie" button/icon per unit row. Fetch data lazily (only when expanded) using `useQuery` with `enabled` flag.

### 4. Backfill existing data (optional, on migration)

Insert current readings from `einheiten` and `immobilien` into the history table so existing data appears immediately:

```sql
INSERT INTO zaehlerstand_historie (einheit_id, zaehler_typ, zaehler_nummer, stand, datum, quelle)
SELECT id, 'kaltwasser', kaltwasser_zaehler, kaltwasser_stand_aktuell, 
       COALESCE(kaltwasser_stand_datum, CURRENT_DATE), 'manuell'
FROM einheiten WHERE kaltwasser_stand_aktuell IS NOT NULL;
-- Repeat for warmwasser, strom, gas...
-- Same pattern for immobilien Hausanschluss readings
```

### Files to modify
- **New migration**: Create `zaehlerstand_historie` table + backfill
- **`src/components/dashboard/ZaehlerVerwaltung.tsx`**: Insert history on save, add collapsible history display per unit/property
- **`src/integrations/supabase/types.ts`**: Will auto-update after migration

