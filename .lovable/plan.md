

## Problem Analysis

Two issues in the "Alle Zahlungen" tab:

1. **Display Bug**: When a "Nebenkosten" payment is selected, the right-side detail panel doesn't properly reflect the category context. The `AssignPaymentDialog` gets opened but may show "Mietvertrag" as default assignment type despite the payment being "Nebenkosten".

2. **Missing Feature**: No way to assign Nebenkosten payments directly to an Immobilie from the detail panel. The Zuordnung section doesn't adapt its UI based on category.

**Root cause of category display issue**: The detail panel (lines 728-734 of `ZahlungenUebersicht.tsx`) shows a static Badge with `selectedZahlung.kategorie`, but there's no `PaymentKategorieEditor` allowing inline category changes. Additionally, the Zuordnung section doesn't distinguish between Nebenkosten and Miete workflows.

## Plan

### 1. `ZahlungenUebersicht.tsx` — Enhance detail panel

- **Add `PaymentKategorieEditor`** to the detail panel (replacing static Badge) so users can change categories inline
- **Adapt Zuordnung section**: When `kategorie === 'Nebenkosten'`, show "Immobilie zuordnen" button instead of generic "Zuordnen". Change the assignment prompt text to match
- **Pass correct `kategorie`** to `AssignPaymentDialog` so it defaults to the right assignment type

### 2. `AssignPaymentDialog.tsx` — Improve Nebenkosten handling

- Ensure `assignmentType` correctly initializes to `'property'` when `kategorie === 'Nebenkosten'` (the `useEffect` already does this, but verify it fires correctly)
- After assigning a Nebenkosten payment to a property, also invalidate `unzugeordnete-nebenkosten` and `zugeordnete-nebenkosten` query keys for cross-tab consistency

### 3. Query invalidation

- In `AssignPaymentDialog`, add invalidation of Nebenkosten-related query keys (`unzugeordnete-nebenkosten`, `zugeordnete-nebenkosten`) after any assignment change, ensuring the Nebenkosten tab stays in sync

