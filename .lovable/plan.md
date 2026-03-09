

## Plan: Development Status Board

### Übersicht

Ein neuer Bereich "Entwicklung" im Dashboard, erreichbar über einen Button in der Admin-Toolbar (wie Zahlungen, Übergabe etc.). Leichtgewichtiges Issue-Tracking mit Kanban-Ansicht und Listenansicht.

### Datenbankstruktur

Neue Tabelle `dev_tickets`:

| Spalte | Typ | Default |
|--------|-----|---------|
| id | uuid | gen_random_uuid() |
| typ | text (enum: 'bug', 'feature', 'aufgabe') | 'feature' |
| titel | text | NOT NULL |
| kurzbeschreibung | text | nullable |
| beschreibung | text | nullable |
| status | text ('offen', 'geplant', 'in_entwicklung', 'in_testing', 'fertig') | 'offen' |
| prioritaet | text ('niedrig', 'mittel', 'hoch', 'kritisch') | 'mittel' |
| erstellt_am | timestamptz | now() |
| aktualisiert_am | timestamptz | now() |
| erstellt_von | uuid | nullable |
| screenshot_urls | text[] | nullable |
| sort_order | integer | 0 |

Neue Tabelle `dev_ticket_kommentare`:

| Spalte | Typ | Default |
|--------|-----|---------|
| id | uuid | gen_random_uuid() |
| ticket_id | uuid FK → dev_tickets | NOT NULL |
| kommentar | text | NOT NULL |
| erstellt_am | timestamptz | now() |
| erstellt_von | uuid | nullable |

RLS: Authenticated users can read. Only admin can insert/update/delete (da beide Nutzer Admin-Rolle haben).

Screenshots werden im bestehenden `dokumente` Storage-Bucket gespeichert (Pfad: `dev-tickets/{ticket_id}/{filename}`).

### UI-Struktur

**1. Neuer Button im Dashboard-Header** (Index.tsx)
- Icon: `Bug` oder `ClipboardList` aus lucide-react
- Label: "Entwicklung"
- Navigiert zu neuem View via `showDevBoard` in NavigationState

**2. Neue Komponente: `DevStatusBoard.tsx`**
- Header mit Back-Button, Titel "Entwicklungsstatus"
- Toggle zwischen Kanban und Liste
- Filter: Typ (Bug/Feature/Aufgabe), Priorität, Status
- "Neues Ticket" Button

**3. Kanban-Ansicht** (Default)
- 5 Spalten: Offen → Geplant → In Entwicklung → In Testing → Fertig
- Tickets als Cards mit: Typ-Badge, Titel, Priorität-Indikator, Datum
- Drag-and-drop optional (kann erstmal über Klick-Menü Status ändern)

**4. Listen-Ansicht**
- Tabelle mit allen Tickets, sortierbar nach Status/Priorität/Datum

**5. Ticket-Detail-Modal**
- Titel (editierbar)
- Typ-Auswahl
- Status-Dropdown
- Priorität-Dropdown
- Kurzbeschreibung + Detail-Beschreibung (Textarea)
- Screenshot-Upload (Drag & Drop auf bestehenden dokumente-Bucket)
- Kommentar-Bereich: Liste bestehender Kommentare + neuen hinzufügen

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| Migration (SQL) | `dev_tickets` + `dev_ticket_kommentare` Tabellen + RLS |
| `src/hooks/useNavigationState.ts` | `showDevBoard` State hinzufügen |
| `src/pages/Index.tsx` | Button + Routing zu DevStatusBoard |
| `src/components/devboard/DevStatusBoard.tsx` | **NEU** - Hauptkomponente |
| `src/components/devboard/DevTicketCard.tsx` | **NEU** - Ticket-Karte für Kanban |
| `src/components/devboard/DevTicketModal.tsx` | **NEU** - Detail/Edit Modal |
| `src/components/devboard/DevTicketKommentare.tsx` | **NEU** - Kommentar-Bereich |

### Status-Workflow

```text
Offen → Geplant → In Entwicklung → In Testing → Fertig
  ↑         ↑           ↑              ↑
  └─────────┴───────────┴──────────────┘
        (Rücksetzen jederzeit möglich)
```

Jeder Status kann frei gewählt werden — kein erzwungener linearer Flow.

### Prioritäts-Farbschema

- Kritisch: Rot
- Hoch: Orange  
- Mittel: Gelb/Neutral
- Niedrig: Grau/Grün

### Typ-Badges

- Bug: Rot-Badge mit Bug-Icon
- Feature: Blau-Badge
- Aufgabe: Grau-Badge

