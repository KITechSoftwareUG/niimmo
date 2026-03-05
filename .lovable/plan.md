

## Plan: Mahnungsprozess anpassen — Reihenfolge und editierbare Mahnstufe

### Ist-Zustand

Der aktuelle Flow ist bereits: **Formular → PDF-Vorschau → E-Mail versenden**. Die Mahnstufe wird in `send-mahnung` nach dem Versand automatisch erhöht. Das passt grundsätzlich zum gewünschten Ablauf.

**Was fehlt:**
1. Die Mahnstufe kann nach Versand nicht manuell zurückgesetzt werden (z.B. wenn der Mieter sich entschuldigt)
2. Der Workflow-Flow ist korrekt, aber es fehlt eine explizite Bestätigung/Feedback nach dem Versand

### Geplante Änderungen

#### 1. Mahnstufe editierbar machen im Mietvertrag-Detail

**Datei:** `src/components/dashboard/mietvertrag-details/MietvertragOverviewTab.tsx`

- Ein editierbares Feld für `mahnstufe` hinzufügen (Dropdown oder Zahl-Input: 0, 1, 2, 3)
- Nutzt die bestehende `handleEditMietvertrag`-Mutation
- Wird im Bereich neben den bestehenden Vertragsdetails angezeigt
- So kann die Mahnstufe jederzeit manuell korrigiert werden (z.B. auf 0 zurücksetzen)

#### 2. `useMietvertragMutations.ts` erweitern

- `handleEditMietvertrag` um den Feldtyp `mahnstufe` ergänzen (integer-Validierung, Wertebereich 0-3)

#### 3. Keine Änderung am Edge Function Flow

- `generate-mahnung-pdf`: Erstellt nur PDF (erhöht keine Mahnstufe) ✅ bereits so
- `send-mahnung`: Erhöht Mahnstufe nach erfolgreichem Versand ✅ bereits so
- Reihenfolge: Formular → PDF-Preview → E-Mail → Mahnstufe erhöht ✅ bereits so

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/dashboard/mietvertrag-details/MietvertragOverviewTab.tsx` | Editierbares Mahnstufe-Feld hinzufügen |
| `src/hooks/useMietvertragMutations.ts` | `mahnstufe`-Feld in handleEditMietvertrag unterstützen |

