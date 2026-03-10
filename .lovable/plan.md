

## Plan: Mahnungsprozess perfektionieren + Test-E-Mail

Das bestehende Split-Screen-Layout (Form links, PDF-Preview rechts) ist bereits implementiert. Basierend auf den hochgeladenen Vorlagen und dem gewünschten Workflow gibt es folgende Aufgaben:

---

### 1. PDF-Layout exakt an Vorlage anpassen (`mahnungPdfGenerator.ts`)

Das aktuelle PDF kommt dem Ziel schon nah, aber die Vorlage zeigt Details, die fehlen oder abweichen:

- **Blocksatz** für den Fließtext (jsPDF `text()` mit `{ align: 'justify' }`)
- **Absenderzeile** oberhalb des Empfängers exakt wie in der Vorlage (unterstrichen, kleinere Schrift)
- **Kontaktbox rechts**: Icons für Telefon/Fax/Mail besser positionieren (Unicode-Symbole ersetzen durch saubere Text-Labels: `☎`, `⌸`, `✉`)
- **Betreff-Zeile**: Format `MV – [Adresse], [WE X]` + Untertitel je nach Mahnstufe -- bereits vorhanden, Formatierung prüfen
- **Fließtext Stufe 3**: Exakter Wortlaut aus der Vorlage:
  - "Sie haben seit Beginn des Mietverhältnisses am [Datum]..."
  - Verzugszinsen-Aufstellung mit monatlichen Beträgen
  - Kündigungstext + Räumungsfrist + Zahlungsfrist 7 Kalendertage
  - "Sollten Sie die Rückstände nicht innerhalb dieser Frist begleichen, werde ich die fristlose Kündigung vollumfänglich durchsetzen und Räumungsklage erheben."
- **Footer**: Registergericht, HRB-Nummer, IHK/Creditreform-Mitgliedschaft, Steuer-Nummer -- bereits vorhanden, Positionierung verbessern
- **Seitenumbruch**: Bei langen Texten automatischen Seitenumbruch einbauen (aktuell fehlt `doc.addPage()` wenn `y > 240`)

### 2. SMTP-Secrets konfigurieren

Die Edge Function `send-mahnung` erwartet folgende Supabase-Secrets (Strato SMTP):

| Secret | Wert |
|--------|------|
| `MAHNUNG_SMTP_HOST` | `smtp.strato.de` |
| `MAHNUNG_SMTP_PORT` | `587` |
| `MAHNUNG_SMTP_USER` | `mahnung@wohnungsbau.niimmo.de` |
| `MAHNUNG_SMTP_PASS` | `W$dj2qMgSbO2XP4N` |
| `MAHNUNG_SMTP_FROM_EMAIL` | `mahnung@wohnungsbau.niimmo.de` |
| `MAHNUNG_SMTP_FROM_NAME` | `NilImmo Hausverwaltung` |

Diese werden als Supabase Edge Function Secrets gesetzt.

### 3. Edge Function re-deployen

`send-mahnung` muss nach dem Setzen der Secrets neu deployed werden, damit die SMTP-Konfiguration greift.

### 4. Test-E-Mail senden

Nach dem Deployment wird eine Test-Mahnung an `ayham.a@gmx.de` gesendet, um den kompletten Flow zu verifizieren:
- PDF generieren (client-side)
- PDF in Storage hochladen
- Edge Function `send-mahnung` aufrufen mit Test-Daten
- E-Mail mit PDF-Anhang an `ayham.a@gmx.de`

### 5. Kleinere UX-Verbesserungen am Modal

- **Automatische Befüllung** der Mieter-Adresse aus der DB (falls `neue_anschrift` am Mietvertrag hinterlegt ist)
- **Einheit-Bezeichnung** automatisch aus `einheiten.etage` + Nummer ableiten statt nur "WE"

---

### Zusammenfassung der Dateiänderungen

| Datei | Änderung |
|-------|----------|
| `src/utils/mahnungPdfGenerator.ts` | PDF-Layout pixelgenau an Vorlage anpassen, Seitenumbruch |
| `src/components/dashboard/MahnungErstellungModal.tsx` | Kleinere UX-Fixes (Auto-Fill Adresse/Einheit) |
| `supabase/functions/send-mahnung/index.ts` | Keine Codeänderung, nur Re-Deploy mit neuen Secrets |

