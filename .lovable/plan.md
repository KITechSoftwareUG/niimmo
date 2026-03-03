

## Plan: Tilgungsplan-Import für Volksbank optimieren

### Probleme identifiziert

1. **Restschuld wird als 0 gespeichert**: `loanData.restschuld || 0` — wenn der Wert negativ ist (z.B. `-290933.56`), greift `|| 0` zwar nicht, aber die KI extrahiert den Wert teilweise gar nicht oder als 0.
2. **AI-Prompt zu generisch**: Sagt nur "letzte Restschuld im Plan", aber der User will den "Aktueller Kontostand" aus den Kopfdaten des Volksbank-Dokuments.
3. **Negative Werte**: Volksbank zeigt Restschuld/Kontostand als negative Zahlen (z.B. `-290.933,56 EUR`). Diese müssen als positive Beträge gespeichert werden.
4. **Volksbank-spezifische Felder** werden nicht extrahiert: Zinsbindungsende, Restschuld zum Zinsbindungsende, BIC, Ursprungsdarlehen.

### Änderungen

#### 1. Edge Function `process-tilgungsplan-ocr/index.ts` — AI-Prompt optimieren

Den System-Prompt komplett auf das Volksbank-Format ausrichten:

- **Kopfdaten-Priorität betonen**: "Die wichtigsten Daten stehen im Kopfbereich des Dokuments (Kontoinhaber, IBAN, Ursprungsdarlehen, Aktueller Kontostand, Zinsbindungsende, Restschuld zum Zinsbindungsende)."
- **`restschuld`** = Absoluter Wert von "Aktueller Kontostand" (nicht letzte Zeile im Tilgungsplan)
- **Neues Feld `restschuld_zinsbindungsende`**: Separates Feld für "Restschuld zum Zinsbindungsende"
- **Vorzeichen-Anweisung**: "Alle Beträge als positive Zahlen zurückgeben. Negative Vorzeichen im Dokument ignorieren."
- **Volksbank-Beispiel** im Prompt mit dem exakten Format aus dem Screenshot (Kontoinhaber, IBAN, BIC, Zinsbindungsende, Ursprungsdarlehen, Aktueller Kontostand, Restschuld zum Zinsbindungsende)
- **Tilgungsplan-Spalten**: Zeitraum (MM.YYYY → YYYY-MM-01), Zahlung, Tilgung, Sollzinsen, Restschuld
- **`max_tokens` auf 32000 erhöhen** — Tilgungspläne können lang sein

#### 2. `DarlehenVerwaltung.tsx` — Import-Speicherlogik korrigieren

- **Restschuld-Übernahme**: `Math.abs(loanData.restschuld)` statt `loanData.restschuld || 0` — negative Werte werden positiv, und `0` bleibt `0` wenn wirklich kein Wert da ist.
- **Alle numerischen Felder mit `Math.abs()`**: darlehensbetrag, restschuld, monatliche_rate, zinssatz_prozent, tilgungssatz_prozent
- **Restschuld zum Zinsbindungsende** in Notizen aufnehmen, wenn vorhanden
- **Review-Modal**: "Aktueller Kontostand" Label statt "Restschuld" für bessere Klarheit

### Kein DB-Schema-Änderung nötig
`restschuld_zinsbindungsende` wird in `notizen` aufgenommen.

