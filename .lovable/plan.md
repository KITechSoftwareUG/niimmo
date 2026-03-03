

## Plan: Mieter-Kontaktdaten kompakter darstellen

### Änderungen in `MietvertragContractInfo.tsx`

1. **Container-Spacing** (Zeile 365): `space-y-3` → `space-y-1.5`, analog zur linken Spalte
2. **Header-Margin** (Zeile 366): `mb-1` entfernen
3. **Mieter-Karten** (Zeile 389): `space-y-1.5 p-2` → `space-y-1 p-1.5` — weniger Innenabstand und Zeilenabstand
4. **Mieter-Liste** (Zeile 387): `space-y-2` → `space-y-1.5` — weniger Abstand zwischen mehreren Mietern

Nur 1 Datei betroffen, reine CSS-Klassen-Änderungen.

