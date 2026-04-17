# NiImmo Property Management Skill

## Description
Gives you real-time access to the NiImmo property management portfolio. You can query tenant information, outstanding payments, vacancies, dunning levels, loan data, and more — all in German.

## When to use
Use this skill whenever the user asks anything about:
- Their properties (Immobilien), apartments (Einheiten), or tenants (Mieter)
- Overdue payments, rent arrears, or dunning (Mahnwesen)
- Vacant units (Leerstand)
- Loan or financing data (Darlehen)
- Payment history (Zahlungshistorie)
- Portfolio overview or KPIs

Keywords that should trigger this skill (in German):
- Mieter, Miete, Zahlung, Immobilie, Einheit, Leerstand
- Mahnung, Rückstand, Forderung, offen
- Darlehen, Restschuld, Tilgung
- Portfolio, Übersicht, NiImmo

## How to use

Make a POST request to the NiImmo Agent API:

**Endpoint:** `https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/agent-api`

**Headers:**
```
Content-Type: application/json
x-agent-key: <AGENT_API_KEY>
```

**Body:**
```json
{
  "query": "<the user's question in their original language>"
}
```

**Response:**
```json
{
  "response": "<German text answer ready to send to the user>"
}
```

The API returns a ready-to-send German text answer. Forward it directly to the user without modification.

## Example queries

| User says | Send as query |
|-----------|--------------|
| "Wer hat nicht gezahlt?" | "Wer hat nicht gezahlt?" |
| "Zeig mir den Leerstand" | "Zeig mir den Leerstand" |
| "Portfolio Übersicht" | "Gib mir eine Portfolio-Übersicht" |
| "Was schuldet Müller?" | "Was schuldet Mieter Müller?" |
| "Mahnstufen" | "Welche Verträge haben aktive Mahnstufen?" |

## Error handling
If the API returns an error, respond: "Es gab einen technischen Fehler beim Abrufen der NiImmo-Daten. Bitte versuche es erneut."

## Configuration
Store the API key as: `NIIMMO_AGENT_KEY` in your OpenClaw environment/secrets.
In the request, use it as the value for the `x-agent-key` header.
