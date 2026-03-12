

## Problem

The `zugeordnete-nebenkosten` query (line 292) only fetches payments where `kategorie = 'Nichtmiete'`. When a payment with `kategorie = 'Nebenkosten'` is assigned to a property, it disappears from the left (unassigned) list but never appears in the right-side property cards because the query excludes it.

## Fix

**File: `src/components/controlboard/NebenkostenZuordnungTab.tsx`** (line 292)

Change the filter from `.eq('kategorie', 'Nichtmiete')` to `.in('kategorie', ['Nichtmiete', 'Nebenkosten'])` so that assigned payments of both categories show up under their respective property cards on the right side.

This is a one-line fix.

