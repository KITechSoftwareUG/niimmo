

## Plan: Dedizierte SMTP-Konfiguration für Übergabe-E-Mails

### Aktueller Stand

Die Edge Function `send-uebergabe-email` nutzt die allgemeinen SMTP-Secrets (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`). Der User möchte eine separate E-Mail-Adresse speziell für Übergabe-Benachrichtigungen verwenden.

### Änderungen

#### 1. Neue Supabase Secrets anlegen

Sobald der User die Zugangsdaten liefert, werden diese als eigene Secrets gespeichert:

- `UEBERGABE_SMTP_HOST` (falls abweichend vom bestehenden SMTP-Server)
- `UEBERGABE_SMTP_PORT`
- `UEBERGABE_SMTP_USER`
- `UEBERGABE_SMTP_PASS`
- `UEBERGABE_SMTP_FROM_EMAIL` — die neue dedizierte Adresse
- `UEBERGABE_SMTP_FROM_NAME` — z.B. "NilImmo Übergabe"

#### 2. Edge Function `send-uebergabe-email/index.ts` anpassen

- Zuerst die `UEBERGABE_SMTP_*` Secrets prüfen
- Fallback auf die allgemeinen `SMTP_*` Secrets, wenn die dedizierten nicht gesetzt sind
- So funktioniert alles weiterhin, auch bevor die neuen Secrets konfiguriert sind

```
Priorität: UEBERGABE_SMTP_HOST → SMTP_HOST (Fallback)
```

#### 3. Keine Frontend-Änderung nötig

Der Absender wird serverseitig in der Edge Function bestimmt — das Frontend bleibt unverändert.

### Nächster Schritt

Bitte teile mir die SMTP-Zugangsdaten für die neue E-Mail-Adresse mit (Host, Port, Benutzername, Passwort, Absenderadresse, Absendername). Ich speichere sie dann als Supabase Secrets und passe die Edge Function an.

