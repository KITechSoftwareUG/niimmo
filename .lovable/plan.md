

## Plan: Mahnung per E-Mail versenden — mit gebrandetem HTML-Template und PDF-Anhang

### Ist-Zustand

- **`send-mahnung/index.ts`**: Simuliert nur den Versand (`console.log`), kein echter SMTP-Versand
- **`MahnungErstellungModal.tsx`**: Workflow ist PDF-Generierung → Vorschau → Download. Kein E-Mail-Schritt
- **`generate-mahnung-pdf/index.ts`**: Erzeugt PDF und speichert es in Supabase Storage + `dokumente`-Tabelle
- Es existieren keine SMTP-Secrets für Mahnungen

### Geplante Änderungen

#### 1. Edge Function `send-mahnung/index.ts` — komplett umbauen

Die bestehende Funktion wird zum echten E-Mail-Versand umgebaut (analog zu `send-uebergabe-email`):

- **SMTP via denomailer** (wie bei `send-uebergabe-email`)
- **Dedizierte Secrets** mit Fallback:
  - `MAHNUNG_SMTP_HOST` → `SMTP_HOST`
  - `MAHNUNG_SMTP_PORT` → `SMTP_PORT`
  - `MAHNUNG_SMTP_USER` → `SMTP_USER`
  - `MAHNUNG_SMTP_PASS` → `SMTP_PASS`
  - `MAHNUNG_SMTP_FROM_EMAIL` → `SMTP_FROM_EMAIL`
  - `MAHNUNG_SMTP_FROM_NAME` → `SMTP_FROM_NAME` → "NilImmo Hausverwaltung"
- **PDF als Anhang**: `pdfPath` aus Request → PDF aus Supabase Storage laden → als Attachment anhängen
- **Gebrandetes HTML-Template** mit:
  - NilImmo-Logo (Base64 inline oder als gehostetes Bild)
  - Mahnstufen-abhängiger Betreff und Text
  - Tabelle mit offenen Forderungen
  - Gesamtbetrag, Zahlungsfrist
  - Professionelles Layout (Firmenfarben)
  - Footer mit Firmendaten
- **CC-Empfänger** optional

#### 2. `MahnungErstellungModal.tsx` — E-Mail-Schritt nach PDF-Vorschau

Der Workflow wird erweitert: `form` → `preview` → `email`

- Nach PDF-Vorschau: neuer Button "Per E-Mail versenden"
- Zeigt Empfänger-E-Mail (aus `contractData.mieter[].hauptmail`), editierbar
- Optionales CC-Feld
- Betreff und Nachricht vorausgefüllt (mahnstufen-abhängig)
- Ruft `send-mahnung` mit `pdfPath`, Empfänger, Betreff, HTML-Body auf
- Bestehende Buttons (Download, Zurück, Neu starten) bleiben erhalten

#### 3. Benötigte SMTP-Secrets

Du musst mir folgende Daten für die Mahnung-E-Mail-Adresse geben:

| Secret | Beschreibung |
|--------|-------------|
| `MAHNUNG_SMTP_HOST` | SMTP-Server (z.B. `smtp.ionos.de`) |
| `MAHNUNG_SMTP_PORT` | Port (465 für SSL, 587 für STARTTLS) |
| `MAHNUNG_SMTP_USER` | Benutzername / E-Mail-Adresse |
| `MAHNUNG_SMTP_PASS` | Passwort |
| `MAHNUNG_SMTP_FROM_EMAIL` | Absenderadresse (z.B. `mahnung@niimmo.de`) |
| `MAHNUNG_SMTP_FROM_NAME` | Absendername (z.B. "NilImmo Hausverwaltung") |

Falls dieselbe Adresse wie für Übergabe-Mails genutzt werden soll, kann ich auch auf die `UEBERGABE_SMTP_*` Secrets zurückgreifen.

#### 4. HTML-E-Mail-Template (Inhalt)

Das Template enthält:
- **Header**: NilImmo-Logo + "Mahnung Stufe X"
- **Anrede**: "Sehr geehrte/r [Vorname Nachname]"
- **Sachverhalt**: Mietobjekt, Adresse, Vertragsnummer
- **Forderungstabelle**: Monat | Sollbetrag (je offene Forderung)
- **Kostenzusammenfassung**: Rückstand + Mahngebühren + Verzugszinsen + Zusatzkosten = Gesamtbetrag
- **Zahlungsfrist**: "Bitte überweisen Sie bis zum [Datum]"
- **Eskalationstext** (mahnstufen-abhängig): Stufe 1 freundlich, Stufe 3 mit Kündigungsandrohung
- **Footer**: Firmendaten, Kontakt, Disclaimer
- **PDF im Anhang**: Das generierte Mahnungs-PDF

#### 5. Keine DB-Änderungen nötig

Das System-Log wird weiterhin über die bestehende `system_logs`-Tabelle geschrieben. Die Mahnstufen-Aktualisierung bleibt in `generate-mahnung-pdf`.

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/send-mahnung/index.ts` | Komplett umbauen: SMTP-Versand, HTML-Template, PDF-Anhang |
| `src/components/dashboard/MahnungErstellungModal.tsx` | Neuer Step "E-Mail versenden" nach PDF-Vorschau |

