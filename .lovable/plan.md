

## Plan: Darlehen-Dashboard aufräumen

### Probleme im aktuellen Code

1. **Eigenkapitalquote (Ring-Chart)** -- Die Formel `(Kaufpreis - Restschuld) / Kaufpreis` ist irreführend. Sie setzt voraus, dass Kaufpreis = Marktwert und ignoriert tatsächlich eingebrachtes Eigenkapital. Das Feld wird komplett entfernt.

2. **"Bereits getilgt"** -- Berechnung `Darlehensbetrag - Restschuld` kann falsch sein, wenn die statische Restschuld beim Import nicht korrekt war oder nie aktualisiert wurde. Die dynamische Restschuld aus `darlehen_zahlungen` wird bereits genutzt, aber das Ergebnis kann trotzdem unsinnig sein (z.B. negativ oder > Darlehensbetrag).

### Änderungen

**1. Eigenkapital-Ring komplett entfernen** (Zeilen 476-489)
- Den gesamten rechten Ring-Chart-Bereich entfernen
- Grid von `lg:grid-cols-3` auf volle Breite umstellen (`lg:col-span` anpassen)
- `CircularProgress`-Komponente und `eigenkapitalQuote`-Variable entfernen
- Imports `Shield`, `PieChart` aufräumen

**2. "Bereits getilgt" absichern**
- Wert auf `Math.max(0, totalGetilgt)` clampen, damit nie negative Werte angezeigt werden
- Tilgungsquote ebenfalls auf 0-100% begrenzen

**3. Layout vereinfachen**
- Hero-Card wird einspaltiger ohne den Ring-Chart
- KPI-Reihe bleibt: Immobilienwert, Restschuld, Bereits getilgt
- Fortschrittsbalken und Bottom-Metrics bleiben

### Betroffene Datei
- `src/components/dashboard/DarlehenVerwaltung.tsx` (Zeilen 342-489 hauptsächlich)

