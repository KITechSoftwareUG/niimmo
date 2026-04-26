---
name: niimmo
description: Gives real-time access to the NiImmo property management portfolio. Query tenants, payments, vacancies, dunning, loans, and upload documents — all in German.
---

# NiImmo Property Management Skill

## When to use

Use this skill whenever the user asks anything about:
- Properties (Immobilien), apartments (Einheiten), or tenants (Mieter)
- Overdue payments, rent arrears, or dunning (Mahnwesen)
- Vacant units (Leerstand)
- Loan or financing data (Darlehen)
- Payment history (Zahlungshistorie)
- Portfolio overview or KPIs
- Uploading a document or photo for a tenant
- Meter readings (Zählerstände)

Keywords that trigger this skill:
`Mieter`, `Miete`, `Zahlung`, `Immobilie`, `Einheit`, `Leerstand`, `Mahnung`, `Rückstand`, `Forderung`, `Darlehen`, `Restschuld`, `Portfolio`, `Übersicht`, `NiImmo`, `Zähler`, `Dokument`, `hochladen`, `speichern`

---

## Case 1: Text query (no file attached)

Make a POST request to the NiImmo Agent API:

**Endpoint:** `https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/agent-api`

**Headers:**
```
Content-Type: application/json
x-agent-key: <value of NIIMMO_AGENT_KEY env var>
```

**Body:**
```json
{
  "query": "<the user's question verbatim>"
}
```

Forward the `response` field directly to the user without modification.

---

## Case 2: File or photo attached

When the message contains a media note like `[media attached: /path/to/file.jpg]` or the context includes `MediaPath`/`MediaPaths`, the user wants to upload that file to NiImmo.

**Steps:**

1. Extract the local file path from the media note or `MediaPath`.

2. Get the base64-encoded content:
   ```bash
   base64 -w 0 "/path/to/file"
   ```

3. Get the file size in bytes:
   ```bash
   wc -c < "/path/to/file"
   ```

4. Determine the MIME type from the file extension:
   - `.jpg` / `.jpeg` → `image/jpeg`
   - `.png` → `image/png`
   - `.pdf` → `application/pdf`
   - `.webp` → `image/webp`
   - anything else → `application/octet-stream`

5. Extract the filename from the path (just the basename).

6. POST to the NiImmo Agent API with the file included:

```json
{
  "query": "<user's message, e.g. 'Speicher das für Nicole Lücke als Dokument'>",
  "file": {
    "base64": "<base64 string from step 2>",
    "filename": "<filename from step 5>",
    "mimetype": "<mimetype from step 4>",
    "size_bytes": <number from step 3>
  }
}
```

7. Forward the `response` field to the user.

**Important:** If the user didn't specify a tenant name, ask: "Für welchen Mieter soll das Dokument gespeichert werden?"

---

## Error handling

**On any error (HTTP error, timeout, unreachable):** Retry the request **once automatically** before reporting a problem to the user. Wait 2 seconds between attempts.

Only if the second attempt also fails, reply:
> "Es gab einen technischen Fehler beim Abrufen der NiImmo-Daten. Bitte versuche es erneut."

Do **not** tell the user about the failed first attempt — just retry silently.

---

## Configuration

- API key env var: `NIIMMO_AGENT_KEY`
- Use it as the value for the `x-agent-key` header.
