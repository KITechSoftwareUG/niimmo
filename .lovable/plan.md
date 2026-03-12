

## Nebenkosten-Tab: Liste verlängern + Nichtmiete/Nebenkosten trennen + "Wegdrücken"

### Ist-Zustand
- Die linke Zahlungsliste hat eine feste ScrollArea-Höhe von `h-[900px]` (Zeile 452)
- Alle Zahlungen (Nichtmiete + Nebenkosten) werden gemischt in einer Liste angezeigt
- "Nichtmiete"-Button existiert bereits pro Zahlung, aber es fehlt ein umgekehrter "Ist keine Nebenkosten"-Dismiss-Button für reine Nichtmiete-Zahlungen
- Keine visuelle Trennung zwischen Kategorie "Nebenkosten" und "Nichtmiete"

### Geplante Änderungen

**Datei: `src/components/controlboard/NebenkostenZuordnungTab.tsx`**

1. **Liste viel länger machen**: ScrollArea-Höhe von `h-[900px]` auf `h-[calc(100vh-280px)]` ändern, damit sie den verfügbaren Viewport ausfüllt.

2. **Zahlungen in zwei Gruppen trennen**:
   - `displayedPayments` in zwei Gruppen aufteilen via `useMemo`:
     - **"Nebenkosten"** (kategorie === 'Nebenkosten') — oben, prominent
     - **"Nichtmiete"** (kategorie === 'Nichtmiete') — darunter, etwas abgesetzt
   - Jede Gruppe bekommt einen eigenen Abschnitts-Header mit Zähler

3. **"Wegdrücken" für Nichtmiete-Zahlungen**:
   - Bei Nichtmiete-Zahlungen: Dismiss-Button ("Kein Nebenkosten" / X), der die Klassifizierung als `uebersprungen` markiert und die Zahlung aus der Liste entfernt (gleiche Logik wie `recategorizeNichtmieteMutation`, aber ohne Kategorie-Änderung — nur `uebersprungen: true` in `nebenkosten_klassifizierungen`)
   - Neue Mutation `dismissNichtmieteMutation`: setzt in `nebenkosten_klassifizierungen` `uebersprungen: true` für die Zahlung. Falls kein Eintrag existiert, wird einer erstellt mit `is_betriebskosten: false, uebersprungen: true`.
   - Danach Zahlung aus der lokalen Anzeige filtern (Zahlungen mit `uebersprungen`-Klassifizierung werden nicht mehr angezeigt)

4. **Visuelle Unterscheidung**:
   - Nebenkosten-Zahlungen: leichter farbiger Rand (z.B. `border-l-4 border-l-blue-400`)
   - Nichtmiete-Zahlungen: dezenter Stil, etwas blasser
   - Collapsible Nichtmiete-Sektion (standardmäßig offen, zusammenklappbar)

### Technisches Detail

```text
displayedPayments
  ├── nebenkostenPayments  (kategorie === 'Nebenkosten')
  │     → Header: "Nebenkosten (X)"
  │     → Jede Karte: [Drag] [KI-Vorschlag] [Nichtmiete-Button]
  │
  └── nichtmietePayments   (kategorie === 'Nichtmiete')
        → Collapsible Header: "Nichtmiete (Y)" 
        → Jede Karte: [Drag] [KI-Vorschlag] [Wegdrücken-Button ✕]
        → Wegdrücken = aus Ansicht entfernen (uebersprungen)
```

Filterung: Bereits übersprungene Zahlungen werden über einen Join/Check gegen `nebenkosten_klassifizierungen` (wo `uebersprungen = true`) aus der Anzeige gefiltert — entweder client-seitig (anhand der geladenen `cachedClassifications`) oder durch Erweiterung der DB-Query.

