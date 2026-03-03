

## Plan: Nebenkosten-Zahlungen im Zuordnungsdialog einer Immobilie zuweisen

### Problem
Nach dem CSV-Upload und der AI-Zuordnung zeigt das `PaymentAssignmentResultsModal` nur die Möglichkeit, Zahlungen einem **Mietvertrag** zuzuordnen. Wenn eine Zahlung als "Nebenkosten" kategorisiert wird, soll sie stattdessen einer **Immobilie** zugeordnet werden können — nicht einem Mieter.

### Lösung

**3 Dateien ändern:**

#### 1. `PaymentAssignmentResultsModal.tsx`
- **`immobilie_id` zum `ProcessedPayment`-Interface hinzufügen** — neues optionales Feld.
- **Immobilien-Daten laden**: Zweites `useQuery` für `immobilien` (id, name, adresse), aktiviert wenn `open`.
- **`immobilieCorrections` State** hinzufügen (analog zu `manualCorrections`): `Record<number, string | null>`.
- **Zuordnungsspalte anpassen**: Wenn Kategorie = "Nebenkosten", statt Mietvertrag-Name die Immobilie anzeigen. Prüfung: `(categoryCorrections[idx] || result.kategorie) === "Nebenkosten"`.
- **"Ändern"-Button Logik**: Bei Nebenkosten den `PaymentCorrectionDialog` im Immobilien-Modus öffnen (neues Prop `mode`).
- **`getFinalResults()` erweitern**: Bei Nebenkosten-Zahlungen `immobilie_id` aus `immobilieCorrections` übernehmen, `mietvertrag_id` auf null setzen.
- **Status-Icon**: Bei Nebenkosten grünes Häkchen wenn `immobilie_id` gesetzt, sonst Warnung.

#### 2. `PaymentCorrectionDialog.tsx`
- **Neues Prop `mode: 'mietvertrag' | 'immobilie'`** (default: `'mietvertrag'`).
- **Neues Prop `immobilien`**: Array von `{id, name, adresse}`.
- **Neues Prop `currentImmobilieId`**: Aktuell zugewiesene Immobilie.
- **Neues Callback `onSelectImmobilie`**: `(immobilieId: string | null) => void`.
- Im Immobilien-Modus:
  - Titel: "Immobilie zuordnen" statt "Mietvertrag zuordnen".
  - Liste zeigt Immobilien (Name + Adresse) statt Mietverträge.
  - Suche filtert nach Name/Adresse.
  - Auswahl ruft `onSelectImmobilie` auf.

#### 3. `PaymentManagement.tsx` — `handleApplyAssignments`
- **`immobilie_id` beim Insert/Update setzen**: Wenn `result.immobilie_id` vorhanden (= Nebenkosten), dieses Feld im Insert/Update-Payload mitgeben. `mietvertrag_id` bleibt null.
- **`ProcessedPayment` Interface**: `immobilie_id?: string | null` hinzufügen.

### Datenfluss
```text
CSV → AI (kategorie=Nebenkosten) → Modal zeigt Immobilie-Spalte
                                  → "Ändern" öffnet Immobilien-Auswahl
                                  → Übernehmen: immobilie_id in zahlungen gesetzt
                                  → Zahlung erscheint im Nebenkosten-Tab
```

### Keine DB-Änderungen nötig
`zahlungen.immobilie_id` existiert bereits.

