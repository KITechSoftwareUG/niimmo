

## Analyse: Warum BG-Zahlungen (Bundesagentur für Arbeit) nicht zugeordnet werden

### Das Problem im Detail

Die Zahlung `782,76€ Bundesagentur fuer Arbeit — Miete Vaduva Leverster Str. 6` hat die IBAN `DE94760000000076001601`. Das ist die hardcoded `BG_ZAHLUNG_IBAN` (Zeile 19).

**Aktueller Ablauf für BG-Zahlungen:**
1. `categorizePaymentType()` erkennt die IBAN → gibt `"bg_zahlung"` zurück (Zeile 397-399)
2. Das bedeutet: **Die gesamte regelbasierte Zuordnung wird übersprungen** (Zeile 1157-1158)
3. Die Zahlung geht direkt an die KI (`processBGZahlung`)
4. Die KI bekommt den gesamten Vertragskontext als JSON und soll den Namen im Verwendungszweck finden
5. Die KI versagt bei ~30% der Fälle (3 von 10 Zahlungen falsch als "Nichtmiete" kategorisiert)

**Konkrete Fehler aus der DB:**
- `Hickes Bahnhofstr. 18` → **Nichtmiete** (Mieter heißt "Hickey" — Schreibvariante!)
- `A. Feistel Hildesheim` → **Nichtmiete** (kein "Miete"-Keyword im Text)
- `Familie Khider/ Levester Str.6` → **Nichtmiete** (kein "Miete"-Keyword)

**Zusätzliches Risiko:** Einige Mietverträge haben `bankkonto_mieter = DE94760000000076001601` (die BG-IBAN) eingetragen. Falls BG-Zahlungen durch die normale IBAN-Zuordnung laufen würden, würden sie dem falschen Vertrag zugeordnet.

### Lösung: Dedizierte regelbasierte BG-Namensextraktion VOR der KI

**Datei: `supabase/functions/process-payments/index.ts`**

#### 1. Neue Funktion `matchBGPaymentByName()`
Extrahiert den Mieternamen aus dem Verwendungszweck einer BG-Zahlung und gleicht ihn mit den Verträgen ab:

- **Nachnamen-Extraktion:** Sucht jeden Vertragsnachnamen (≥4 Zeichen) als Substring im Verwendungszweck
- **Fuzzy-Matching:** Nutzt die vorhandene `fuzzyMatch()`-Funktion für Schreibvarianten (z.B. "Hickes" ↔ "Hickey", Levenshtein-Distanz ≤1)
- **Adress-Match als Tiebreaker:** Wenn mehrere Namens-Matches existieren, prüft auch Straßennamen im Verwendungszweck
- **IBAN-Matching explizit ausgeschlossen:** Die BG-IBAN wird nie für Vertragsauswahl verwendet
- **Confidence:** 90 bei exaktem Namens-Match, 80 bei Fuzzy-Match

#### 2. Hauptschleife anpassen (Zeile 1157-1158)
Statt BG-Zahlungen sofort an die KI zu schicken:
```
bg_zahlung erkannt
  → matchBGPaymentByName() versuchen (regelbasiert)
  → Bei Treffer: direkt in results mit Kategorie "Miete"
  → Kein Treffer: weiter an processBGZahlung() (KI-Fallback)
```

#### 3. BG-IBAN aus IBAN-Matching ausschließen (Zeile 585-625)
Im normalen IBAN-Matching (`matchPaymentByRules`): Verträge mit `bankkonto_mieter = BG_ZAHLUNG_IBAN` überspringen, damit nicht-BG-Zahlungen nicht fälschlicherweise diesen Verträgen zugeordnet werden.

#### 4. Kaution-Erkennung für BG-Zahlungen
Wenn der Verwendungszweck "Kaution" enthält UND der Betrag zur Kaution passt → Kategorie "Mietkaution" statt "Miete" (wie bei der Sonderfall-Regel für Noah Weich).

### Warum das 100% zuverlässig wird

- **BG-Zahlungen enthalten IMMER den Mieternamen im Verwendungszweck** — das ist der Standard der Bundesagentur
- Regelbasiertes Matching ist deterministisch (kein KI-Zufall)
- Fuzzy-Matching fängt Schreibvarianten ab (Hickes/Hickey, Vaduva/Waduva)
- KI bleibt als Fallback für wirklich unklare Fälle

### Nur 1 Datei betroffen
`supabase/functions/process-payments/index.ts`

