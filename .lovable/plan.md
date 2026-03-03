

## Problem

Die `MietvertragContractInfo`-Komponente hat zu viel vertikalen Abstand zwischen den Feldern. Hauptursachen:

1. **`space-y-3` (12px)** auf dem Container (Zeile 126) — zu viel für diese kompakte Ansicht
2. **Personen-Feld** steht allein in einem `grid grid-cols-2` (Zeile 278) — verschwendet eine Spalte
3. **IBAN** ist in einem extra `<div>` gewrappt (Zeile 318) — unnötige Verschachtelung
4. **Kaltmiete/m²** steht allein auf einer Zeile (Zeile 268-275) — könnte mit Personen kombiniert werden

## Änderungen (1 Datei)

**`src/components/dashboard/mietvertrag-details/MietvertragContractInfo.tsx`**

- `space-y-3` → `space-y-1.5` auf dem linken Container (Zeile 126)
- Kaltmiete/m² und Personen in eine gemeinsame `grid grid-cols-2`-Zeile zusammenfassen
- IBAN-Wrapper-`<div>` entfernen bzw. flacher machen
- `mb-1` vom Header entfernen (Zeile 127), da `space-y` bereits den Abstand regelt

