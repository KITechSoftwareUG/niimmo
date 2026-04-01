# NiImmo – Immobilienverwaltungs-Dashboard

## Überblick
**NiImmo** ist eine vollständige Immobilienverwaltungs-Webanwendung für die NiImmo Gruppe. Sie verwaltet Immobilien, Einheiten, Mietverträge, Mieter, Zahlungen, Nebenkosten, Darlehen und Dokumente. Gebaut als React-SPA mit Supabase-Backend.

## Tech-Stack
| Schicht | Technologie |
|---------|------------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS 3, shadcn/ui (Radix), Lucide Icons |
| State | React Query (TanStack), Zustand, React Router 6 |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| PDF | jsPDF (client-seitig) |
| Charts | Recharts |

## Supabase-Projekt
- **Ref**: `kmtgzrnpitlslivdvlyq`
- **Auth**: E-Mail/Passwort, rollenbasiert (`admin`, `hausmeister`)
- **Storage-Bucket**: `dokumente` (privat)
- **RLS**: Alle Tabellen haben Row-Level Security; Admin-Check via `has_role()` Security-Definer-Funktion

## Datenmodell (Kerntabellen)

| Tabelle | Beschreibung |
|---------|-------------|
| `immobilien` | Gebäude/Objekte mit Adresse, Zählern, Versorgerdaten, `ist_angespannt` |
| `einheiten` | Wohnungen/Gewerbe je Immobilie, mit qm, Zählerständen, Personenzahl |
| `mietvertrag` | Verträge mit Kaltmiete, Betriebskosten, Kaution, Status (`aktiv`/`gekuendigt`/`beendet`), Mahnstufe |
| `mietvertrag_mieter` | m:n-Verknüpfung Vertrag↔Mieter |
| `mieter` | Kontaktdaten (Name, E-Mail, Tel, Geburtsdatum) |
| `zahlungen` | Bankbewegungen mit Kategorie (`Miete`/`Nichtmiete`/`Nebenkosten`/`Mietkaution`/`Rücklastschrift`/`Ignorieren`) |
| `mietforderungen` | Soll-Mieten pro Monat mit Fälligkeitsdatum |
| `dokumente` | Dateien (Mietvertrag, Kündigung, Übergabe, etc.) in Supabase Storage |
| `nebenkostenarten` | Umlagefähige/nicht-umlagefähige Kostenarten je Immobilie (BetrKV §2-17) |
| `kostenpositionen` | Konkrete Kostenpositionen mit Zeitraum, verknüpft mit Zahlungen |
| `kostenposition_anteile` | Verteilung auf Einheiten (qm, Personen, gleich) |
| `nebenkosten_klassifizierungen` | KI-gestützte Klassifizierung von Zahlungen |
| `darlehen` | Finanzierungen mit Zinssatz, Tilgung, Restschuld |
| `darlehen_zahlungen` | Tilgungsplan-Einträge |
| `darlehen_immobilien` | m:n Darlehen↔Immobilien |
| `versicherungen` | Gebäudeversicherungen je Immobilie |
| `zaehlerstand_historie` | Historische Zählerstände (Strom, Gas, Wasser) |
| `user_roles` | Rollen-Tabelle (admin/hausmeister), getrennt von auth.users |
| `angespannte_maerkte` | Lookup für angespannte Wohnungsmärkte (Kappungsgrenze) |
| `marktdaten` | Basiszinssatz, VPI-Werte |
| `whatsapp_nachrichten` | WhatsApp-Kommunikation mit Mietern |
| `dev_tickets` | Internes Ticket-/Feature-Board |

## Hauptfeatures

### 1. Dashboard & Übersicht
- KPI-Karten: Immobilien, Einheiten, Leerstand, Warmmiete Soll/Ist
- Immobilien-Karten mit Belegungsstatus, sortierbar
- Globale Suche über Mieter, Adressen, Verträge
- Rollenbasierte Ansicht (Admin vs. Hausmeister)

### 2. Immobilien-Detailansicht
- Tabs: Einheiten, Dokumente, Versicherungen, Nebenkosten
- Inline-Editing von Hausanschluss-Zählerständen
- Angespannter-Markt-Indikator (automatisch via DB-Trigger)

### 3. Mietvertragsverwaltung
- Vertragserstellung mit Mieterdaten, Kaution, Lastschrift-Optionen
- Status-Lifecycle: aktiv → gekündigt → beendet (DB-Trigger `auto_set_beendet_status`)
- Kündigungs-Workflow mit PDF-Vorschau und Dokumenten-Upload
- Vertragshistorie (Vor-/Nachmieter-Timeline via `LinkedContractsTimeline`)

### 4. Zahlungsverwaltung (Controlboard)
- CSV-Import von Kontoauszügen mit robustem Amount-Parsing (DE/EN)
- KI-gestützte automatische Zuordnung (Edge Function `process-payments`)
- Manuelle Zuordnung, Kategorie-Editor, Split-Zahlungen
- Rücklastschrift-Handling mit automatischer Forderungserstellung (DB-Trigger)
- Nebenkosten-Zuordnungs-Tab

### 5. Mahnwesen
- 3-stufiges Mahnsystem mit automatischer Mahnstufen-Berechnung
- PDF-Generierung mit Live-Vorschau (Split-Screen)
- Verzugszinsen-Berechnung (Basiszinssatz + 5%)
- E-Mail-Versand via SMTP (Edge Function `send-mahnung`)
- Dokument wird in Supabase Storage gespeichert

### 6. Mieterhöhung
- Prüfung Kappungsgrenze (15%/20% je nach angespanntem Markt)
- Basiszinssatz- und VPI-basierte Berechnung
- PDF-Generierung und E-Mail-Versand
- Sperrfrist-Prüfung (15 Monate)

### 7. Nebenkostenabrechnung
- BetrKV §2-17 Kategorien vorkonfiguriert
- Verteilerschlüssel: qm, Personen, gleich
- KI-Klassifizierung von Zahlungen (Edge Function `classify-nebenkosten`)
- Kostenpositionen mit Zeitraum und anteiliger Verteilung

### 8. Übergabeprotokoll
- Multi-Einheiten-Übergabe (Ein-/Auszug)
- Zählerstände, Schlüssel, Fotos, Notizen
- Digitale Unterschriften (Canvas)
- PDF-Generierung und E-Mail-Versand
- Versorger-Benachrichtigung per E-Mail

### 9. Darlehens-Verwaltung
- Darlehen mit Immobilien-Zuordnung
- Tilgungsplan mit Zins-/Tilgungsanteil
- Zahlungen aus Kontoauszügen zuordnen

### 10. Zähler-Verwaltung
- Strom, Gas, Kalt-/Warmwasser je Einheit und Immobilie
- Historische Zählerstände mit Datum und Quelle
- Automatische Historie-Einträge bei Speicherung

### 11. Dokumente
- Upload/Download mit Kategorisierung
- Drag-and-Drop-Zone
- PDF-Vorschau im Modal
- OCR-Verarbeitung von Mietverträgen (Edge Function `process-contract-ocr`)

### 12. KI-Chatbot
- Kontextbezogener Chat über Portfolio-Daten
- Streamed Responses via Edge Function `chat`
- CSV-Upload mit Fortschrittsanzeige

### 13. Analytics
- Mieteinnahmen-Charts (Recharts)
- Leerstandsquote, Zahlungsverhalten

### 14. Hausmeister-Dashboard
- Eingeschränkte Ansicht für Hausmeister-Rolle
- Zählerstand-Erfassung, Einheiten-Info

## Edge Functions

| Funktion | Zweck |
|----------|-------|
| `process-payments` | CSV-Zahlungen verarbeiten und zuordnen |
| `classify-nebenkosten` | KI-Klassifizierung von Nebenkosten-Zahlungen |
| `chat` | Portfolio-Chatbot mit Streaming |
| `process-contract-ocr` | Mietvertrag-OCR |
| `process-tilgungsplan-ocr` | Tilgungsplan-OCR |
| `generate-mahnung-pdf` | Mahnung-PDF serverseitig |
| `generate-rent-increase-pdf` | Mieterhöhungs-PDF |
| `generate-uebergabe-pdf` | Übergabeprotokoll-PDF |
| `generate-mietforderungen` | Soll-Mieten generieren |
| `send-mahnung` | Mahnung per SMTP versenden |
| `send-rent-increase-notification` | Mieterhöhung per SMTP |
| `send-uebergabe-email` | Übergabeprotokoll per SMTP |
| `check-faelligkeiten` | Fällige Forderungen prüfen |
| `check-mahnstufen` | Mahnstufen automatisch aktualisieren |
| `check-rent-increase-eligibility` | Mieterhöhungs-Berechtigung prüfen |
| `fetch-marktdaten` | Basiszinssatz/VPI abrufen |

## DB-Trigger & Funktionen
- `auto_set_beendet_status`: Vertragsstatus automatisch setzen bei Ende-Datum
- `check_contract_status_on_update`: Gekündigte Verträge → beendet wenn Datum vorbei
- `update_kaution_ist`: Kautionssumme bei Zahlungsänderung aktualisieren
- `create_ruecklastschrift_forderung`: Rücklastschrift-Gebühr als Forderung
- `set_faelligkeitsdatum_trigger`: Fälligkeitsdatum 7 Tage nach Monatsbeginn
- `set_zugeordneter_monat_trigger`: Zahlungen ab 28. dem Folgemonat zuordnen
- `check_angespannter_markt`: Immobilie automatisch als angespannt markieren
- `update_deposit_status_on_payment`: Kautionsstatus bei Zahlung aktualisieren
- `update_expired_terminated_contracts`: Batch-Update abgelaufener Verträge

## SMTP-Konfiguration
- **Mahnung**: `mahnung@niimmo.de` (Secrets: `MAHNUNG_SMTP_*`)
- **Übergabe**: Eigener SMTP (Secrets: `UEBERGABE_SMTP_*`)

## Projektstruktur
```
src/
├── pages/           # Index (Dashboard), Auth, Uebergabe
├── components/
│   ├── dashboard/   # Immobilien, Einheiten, Mietverträge, Zahlungen, Dokumente
│   │   ├── nebenkosten/      # Nebenkostenabrechnung
│   │   ├── rent-increase/    # Mieterhöhung
│   │   ├── termination/      # Kündigung
│   │   ├── handover/         # Übergabeprotokoll
│   │   └── mietvertrag-details/  # Vertragsdetails
│   ├── controlboard/  # Zahlungsverwaltung, CSV-Import
│   ├── chatbot/       # KI-Chatbot
│   ├── devboard/      # Dev-Ticket-Board
│   ├── auth/          # Login, ProtectedRoute
│   └── ui/            # shadcn/ui Komponenten
├── hooks/           # Auth, Rollen, Realtime, Navigation
├── utils/           # PDF-Generatoren, Berechnungen
├── services/        # Webhook-Services
└── integrations/    # Supabase Client & Types
supabase/
├── functions/       # Edge Functions (Deno)
├── migrations/      # SQL-Migrationen
└── config.toml      # Function-Konfiguration
```

## Authentifizierung & Rollen
- Supabase Auth (E-Mail/Passwort)
- Rollen in `user_roles`-Tabelle (nicht in auth.users!)
- `has_role()` Security-Definer-Funktion für RLS
- Admin: Vollzugriff | Hausmeister: Lese- + eingeschränkter Schreibzugriff

## Besonderheiten
- **Realtime**: Supabase Realtime-Subscriptions für Live-Updates
- **Navigation-State**: Zustand-Store für persistente Navigation
- **Angespannte Märkte**: Automatische Erkennung via PLZ/Stadt aus Adresse
- **Verzugszinsen**: Basiszinssatz + 5% (§288 BGB), periodengerecht
- **Rücklastschrift**: Automatische Gebühren-Forderung via DB-Trigger
- **PDF-Generierung**: Client-seitig (jsPDF) mit Blocksatz-Layout
