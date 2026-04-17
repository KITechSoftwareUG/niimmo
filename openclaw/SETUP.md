# NiImmo × OpenClaw × Telegram – Setup-Anleitung

Nur 3 Schritte. Du konfigurierst nur Schritt 1, 2 und 3 — alles andere ist fertig gebaut.

---

## Schritt 1: Supabase Secret setzen

Im Supabase Dashboard für das NiImmo-Projekt (`kmtgzrnpitlslivdvlyq`):

1. Gehe zu **Project Settings → Edge Functions → Secrets**
2. Füge folgende Secrets hinzu:

| Secret Name       | Wert                                      |
|-------------------|-------------------------------------------|
| `AGENT_API_KEY`   | Ein sicheres Passwort (z.B. 32 Zeichen)  |
| `ANTHROPIC_API_KEY` | Dein Anthropic API Key (sk-ant-...)    |

> **Tipp für `AGENT_API_KEY`:** Generiere einen sicheren Key:
> ```bash
> openssl rand -hex 32
> ```
> Speichere ihn — du brauchst ihn in Schritt 3.

---

## Schritt 2: Telegram Bot erstellen

1. Öffne Telegram, suche nach **@BotFather**
2. Schreibe `/newbot`
3. Wähle einen Namen: z.B. `NiImmo Assistent`
4. Wähle einen Username: z.B. `niimmo_assistent_bot`
5. BotFather gibt dir einen **Bot Token**: `123456789:ABC-DEF...`
6. Speichere diesen Token — du brauchst ihn in Schritt 3.

---

## Schritt 3: OpenClaw installieren & konfigurieren

### Installation (auf der lokalen Maschine)

**macOS/Linux:**
```bash
curl -fsSL https://openclaw.ai/install.sh | sh
```

**Windows (PowerShell):**
```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -Tag beta
```

### Konfiguration

Nach der Installation, konfiguriere OpenClaw mit diesen Werten:

```env
# Telegram
TELEGRAM_BOT_TOKEN=<Dein Bot Token aus Schritt 2>

# KI-Modell
ANTHROPIC_API_KEY=<Dein Anthropic API Key>

# NiImmo Agent Key (gleicher Wert wie in Supabase Secret)
NIIMMO_AGENT_KEY=<Dein AGENT_API_KEY aus Schritt 1>
```

### Skill laden

Kopiere die Datei `openclaw/niimmo-skill.md` in das OpenClaw Skills-Verzeichnis:

```bash
# Typischerweise:
cp niimmo-skill.md ~/.openclaw/skills/niimmo-skill.md
```

> Falls OpenClaw ein anderes Skills-Verzeichnis nutzt, check `openclaw --help` oder die OpenClaw-Dokumentation.

---

## Testen

Sobald OpenClaw läuft und mit Telegram verbunden ist, schreibe deinem Bot:

```
Portfolio Übersicht
```

Erwartete Antwort: KPI-Übersicht des NiImmo-Portfolios auf Deutsch.

Weitere Test-Nachrichten:
- `Wer hat nicht gezahlt?`
- `Zeig mir den Leerstand`
- `Mahnstufen Übersicht`
- `Was schuldet [Mieter-Name]?`

---

## API-Endpoint (zur Info)

Die Edge Function ist erreichbar unter:

```
POST https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/agent-api
x-agent-key: <AGENT_API_KEY>
Content-Type: application/json

{ "query": "Deine Frage" }
```

Du kannst sie auch direkt testen:
```bash
curl -X POST \
  https://kmtgzrnpitlslivdvlyq.supabase.co/functions/v1/agent-api \
  -H "x-agent-key: DEIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "Portfolio Übersicht"}'
```
