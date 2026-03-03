

## Plan: Mieter-Bereich rechts redesignen — mehr Platz, Buttons unten

### Problem
Die rechte Spalte ist auf `md:w-64` fixiert — alles ist gequetscht. Die Buttons "Mahnung" und "Kündigung" stehen neben der Überschrift "Mieter" und nehmen dort wertvollen Platz weg.

### Lösung

**Datei: `MietvertragContractInfo.tsx`**

1. **Rechte Spalte breiter machen** (Zeile 365): `md:w-64 md:min-w-[16rem]` → `md:w-72 md:min-w-[18rem]` — gibt 2rem mehr Platz für Kontaktdaten.

2. **Header vereinfachen** (Zeile 366-384): Die Buttons "Mahnung" und "Kündigung" aus dem Header entfernen. Nur noch `<h3>Mieter</h3>` im Header.

3. **Buttons unter die Mieter-Liste verschieben** (nach Zeile 493): Die beiden Buttons als eigene Zeile am Ende des rechten Bereichs platzieren, mit `flex gap-2` nebeneinander, volle Breite. Das gibt der Mieter-Info Luft und die Buttons sind trotzdem gut erreichbar.

4. **Mieter-Karten etwas mehr Padding** (Zeile 389): `p-1.5` → `p-2.5` und `space-y-1` → `space-y-1.5` — die Kontaktdaten brauchen etwas Atem.

5. **Spacing des Containers** (Zeile 365): `space-y-1.5` → `space-y-2.5` — etwas mehr Abstand zwischen Header, Mieter-Karten und Buttons.

### Ergebnis
- Mieter-Kontaktdaten haben mehr Platz (breitere Spalte + weniger Header-Elemente)
- Buttons logisch unter den Mietern positioniert
- Sauberes, aufgeräumtes Design

Nur 1 Datei, reine Layout-Änderungen.

