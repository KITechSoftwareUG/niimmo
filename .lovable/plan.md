

## Plan: Übergabe-Workflow radikal vereinfachen

### Kernidee

Die Übergabe wird zu einem einfachen Dokumentations-Tool: Mietvertrag auswählen → Protokoll ausfüllen → PDF generieren & speichern → fertig. Kein Status-Tracking, keine "Erledigt"-Sektion, keine Statusänderungen am Mietvertrag.

### Änderungen

#### 1. `UebergabeContractList.tsx` — Massiv vereinfachen

- **Komplette "Erledigt"-Sektion entfernen** (`checkContractIsCompleted`, `completedGroups`)
- **Keine `beendet`-Verträge mehr anzeigen** — nur `aktiv` und `gekuendigt`
- **Prioritäts-Logik beibehalten** (Vorschläge), aber stark vereinfacht:
  - Einzug: Frisch eingezogene Verträge (aktiv, kürzlich gestartet) oben
  - Auszug: Gekündigte und bald auslaufende Verträge oben
- **Suche bleibt stark** — bei Suche werden alle aktiven/gekündigten Verträge durchsucht, keine Warnung-Dialoge mehr
- **Warning-System entfernen** — jeder Vertrag ist direkt anklickbar, keine "meetsCriteria"-Logik

#### 2. `Uebergabe.tsx` — Warning-Dialog entfernen

- `showWarningContract`-State und Warning-Dialog-UI komplett raus
- `handleContractClick` ruft direkt `proceedWithContracts` auf
- Kein `meetsCriteria`-Check mehr

#### 3. `UebergabeDialog.tsx` — Keine Statusänderungen mehr

- **`finalizeAuszugStatus()` entfernen** — Vertragsstatus wird NICHT auf "beendet" gesetzt
- **`handleSubmit`**: Speichert nur noch Zählerstände + generiert PDF + speichert PDF als Dokument zum Mietvertrag
- Bei Auszug: Kein automatisches "beendet"-Setzen, keine `ende_datum`-Änderung
- Bei Einzug: Kein `start_datum`-Update
- Die E-Mail-Funktion (Protokoll versenden) bleibt erhalten
- Man kann den Dialog mehrfach für denselben Vertrag nutzen → es entstehen einfach mehrere PDFs

#### 4. Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/dashboard/handover/UebergabeContractList.tsx` | Erledigt-Sektion raus, keine beendet-Verträge, Warning-System raus, nur Vorschläge + starke Suche |
| `src/pages/Uebergabe.tsx` | Warning-Dialog entfernen, direkter Klick auf Vertrag |
| `src/components/dashboard/handover/UebergabeDialog.tsx` | `finalizeAuszugStatus` entfernen, kein `start_datum`/`ende_datum`/Status-Update, nur Zählerstände + PDF |

