

# Sicherheits-Audit und Behebungsplan

## Zusammenfassung der Analyse

Ich habe den gesamten Quellcode gegen die gemeldeten Schwachstellen geprüft. Einige der genannten Probleme betreffen eine andere Anwendung (z. B. AsyncStorage, OAuth-Tokens fuer Google/Outlook, DISABLE_AUTH_CHECK). Die folgenden Probleme existieren jedoch tatsaechlich in dieser Anwendung und muessen behoben werden:

---

## Gefundene Schwachstellen

### KRITISCH: Alle 15 Edge Functions ohne Authentifizierung

**Problem:** Keine einzige Edge Function prueft, ob der Aufrufer eingeloggt ist. Jeder mit der oeffentlichen Supabase-URL kann diese Funktionen aufrufen -- inklusive KI-Funktionen (auf Kosten des Betreibers), Zahlungsverarbeitung und E-Mail-Versand.

**Betroffen:** chat, process-contract-ocr, process-tilgungsplan-ocr, process-payments, classify-nebenkosten, generate-mahnung-pdf, generate-rent-increase-pdf, generate-uebergabe-pdf, generate-mietforderungen, check-faelligkeiten, check-mahnstufen, check-rent-increase-eligibility, send-mahnung, send-rent-increase-notification, send-uebergabe-email

**Behebung:** In jede Edge Function eine Auth-Pruefung einbauen:
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), 
    { status: 401, headers: corsHeaders });
}
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);
const { data, error } = await supabaseClient.auth.getUser();
if (error || !data.user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), 
    { status: 401, headers: corsHeaders });
}
```

---

### HOCH: Offene CORS-Policy

**Problem:** Alle Edge Functions verwenden `Access-Control-Allow-Origin: '*'`. Jede beliebige Website kann Anfragen an die API stellen.

**Behebung:** Den Origin auf die eigene Domain beschraenken:
```typescript
const ALLOWED_ORIGINS = [
  'https://immobilien-blick-dashboard.lovable.app',
  'https://id-preview--8e9e2f9b-7950-413f-adfd-90b0d2663ae1.lovable.app'
];
const origin = req.headers.get('Origin') || '';
const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
```

---

### MITTEL: Sensible Daten in Console-Logs

**Problem:** Mehrere Dateien loggen sensible Informationen:
- `AuthForm.tsx`: Loggt E-Mail-Adressen bei Login/Signup
- `useAuth.tsx`: Loggt E-Mail bei jeder Auth-State-Aenderung
- `PaymentManagement.tsx`: Loggt IBAN, Empfaengernamen, Betraege
- `MieterList.tsx`: Loggt komplette Mieterdaten

**Behebung:** Alle `console.log`-Aufrufe mit sensiblen Daten entfernen oder durch generische Meldungen ersetzen.

---

### MITTEL: Fehlende Security-Header

**Problem:** Die `index.html` hat keine Security-Header. Es fehlen Content-Security-Policy, X-Content-Type-Options, X-Frame-Options.

**Behebung:** Meta-Tags in `index.html` hinzufuegen:
```html
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="Content-Security-Policy" 
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co https://ai.gateway.lovable.dev;">
```

---

### NIEDRIG: Edge Functions verwenden Service-Role-Key ohne Auth

**Problem:** Mehrere Edge Functions (z. B. `send-mahnung`, `chat`) erstellen einen Supabase-Client mit dem Service-Role-Key und fuehren damit Operationen aus, ohne vorher den Aufrufer zu pruefen. Das bedeutet, dass ein unauthentifizierter Aufrufer Datenbankoperationen mit Admin-Rechten ausloesen kann.

**Wird durch die Auth-Pruefung (siehe oben) behoben.**

---

## Nicht zutreffende Punkte

Diese Punkte aus dem Bericht betreffen diese Anwendung **nicht**:
- **AsyncStorage / OAuth-Tokens**: Diese App ist eine Web-App (React), kein React Native. Es gibt kein AsyncStorage.
- **DISABLE_AUTH_CHECK=true**: Existiert nicht im Code.
- **Hardcodiertes Admin-Secret**: Nicht gefunden. Secrets werden korrekt ueber Supabase Environment Variables verwaltet.
- **Passwort-Ueberschreibung ohne Auth**: Supabase Auth wird standard-konform verwendet. Es gibt keinen unsicheren Password-Reset-Endpoint.

---

## Umsetzungsplan

### Schritt 1: Auth-Guard fuer alle 15 Edge Functions
Jede Edge Function erhaelt eine `validateAuth()`-Pruefung am Anfang. Nur authentifizierte Benutzer koennen die Funktionen aufrufen.

### Schritt 2: CORS einschraenken
Origin-Whitelist in allen Edge Functions.

### Schritt 3: Sensible Logs entfernen
Alle `console.log`-Aufrufe mit E-Mails, IBANs, Betraegen und Mieterdaten entfernen.

### Schritt 4: Security-Header in index.html
CSP, X-Frame-Options, X-Content-Type-Options hinzufuegen.

### Schritt 5: Korrekte CORS-Headers
`Access-Control-Allow-Headers` in allen Edge Functions auf den vollstaendigen Satz aktualisieren (inkl. `x-supabase-client-platform` etc.).

---

## Technische Details

**Dateien die geaendert werden:**

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/*/index.ts` (15 Dateien) | Auth-Guard + CORS-Einschraenkung |
| `src/hooks/useAuth.tsx` | Sensible Logs entfernen |
| `src/components/auth/AuthForm.tsx` | E-Mail aus Logs entfernen |
| `src/components/controlboard/PaymentManagement.tsx` | IBAN/Betrag aus Logs entfernen |
| `src/components/dashboard/MieterList.tsx` | Mieterdaten aus Logs entfernen |
| `src/components/dashboard/MietvertragDetail.tsx` | Mieterdaten aus Logs entfernen |
| `index.html` | Security-Meta-Tags |

**Geschaetzter Umfang:** 15 Edge Functions + 5 Frontend-Dateien + 1 HTML-Datei

