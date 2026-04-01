## Code Review — NiImmo (2026-03-30)

Geprüfte Dateien: 5 (Vite + React + TypeScript + Supabase)

---

## Datei 1: `useBasiszinsPerioden.ts`

### Verdict: PASS WITH NOTES

### Issues

- **[severity: low] correctness**: `useBasiszinsPerioden` fragt die rohe Tabelle `marktdaten` ab (alle Einträge mit `typ = "basiszinssatz"`), während `useAktuellerVpi` die View `aktuelle_marktdaten` nutzt. Das ist bewusst unterschiedlich (Perioden vs. neuester Wert) und korrekt — aber inkonsistent benannt. Falls die View irgendwann für beide genutzt werden soll, wäre ein Kommentar hilfreich.

- **[severity: low] error handling**: Supabase-Fehler werden im `queryFn` stillschweigend als `null` behandelt (`if (error || !data …) return null`). Damit ist für den Aufrufer nicht erkennbar ob ein echter DB-Fehler aufgetreten ist oder die Tabelle leer war. Für `fromDB` ist das relevant: `fromDB` ist `false` sowohl bei Netzwerkfehler als auch bei leerem Ergebnis — beide Fälle landen im Fallback, was für die Anzeige des "● DB"-Indikators irreführend sein kann.

---

## Datei 2: `verzugszinsen.ts`

### Verdict: PASS WITH NOTES

### Issues

- **[severity: medium] correctness — Tag der Deutschen Einheit**: In `FEIERTAGE_FEST` ist der Eintrag `'10-03'` angegeben. Das korrekte Datum ist der **3. Oktober** (MM-DD: `10-03`). Im verwendeten Format `datum.toISOString().slice(5, 10)` liefert `toISOString()` das Format `YYYY-MM-DDTHH:mm:ss.sssZ` in UTC. Slice `[5,10]` ergibt `MM-DD` — also `10-03` für den 3. Oktober. **Das stimmt.** Kein Bug, aber das Format ist unkonventionell (kein dediziertes Datum-Objekt), was leicht zu Verwechslungen führt. *(Achtung: Pfingstsonntag ist kein bundesweiter gesetzlicher Feiertag — er ist in der Bewegliche-Feiertage-Liste enthalten, hat aber keine arbeitsrechtliche Relevanz in allen Bundesländern. Für die Werktags-Berechnung nach § 556b BGB ist das jedoch irrelevant, da Sonntage ohnehin keine Werktage sind.)*

- **[severity: medium] correctness — UTC-Drift in `isFeiertag`**: `datum.toISOString()` gibt immer UTC zurück. Bei einem lokalen Datum z. B. `new Date(2024, 11, 25)` (25. Dez., lokal) ist die UTC-Zeit `2024-12-24T23:00:00Z` wenn die Zeitzone UTC+1 ist. `toISOString().slice(5,10)` würde dann `12-24` ergeben statt `12-25`. Weihnachten würde **nicht** als Feiertag erkannt. **Dasselbe gilt für `berechneOsternSonntag`**: `new Date(jahr, monat - 1, tag)` erzeugt ein lokales Datum — beim anschließenden Vergleich via `toISOString().split('T')[0]` in `isFeiertag` entsteht dieselbe UTC-Drift. Der Fix: konsistent lokale Datumsoperationen nutzen (z. B. `toLocaleDateString` oder manuelle `YYYY-MM-DD`-Formatierung ohne `toISOString`).

- **[severity: low] correctness — `berechneVerzugszins` monatLabel**: `monatLabel` wird aus `verzugVon` gebildet (dem 4. Werktag des Folgemonats), nicht aus dem eigentlichen Fälligkeitsmonat. D. h. für Dezember-Miete steht im Label "Januar 2025" statt "Dezember 2024". Das ist verwirrend für den Benutzer im Mahnschreiben.

- **[severity: low] correctness — `getBasiszinssatz` leeres Array**: Wenn `perioden` ein leeres Array übergeben wird, gibt `perioden[perioden.length - 1]` (`perioden[-1]`) `undefined` zurück → Laufzeitfehler. In der Praxis tritt das nicht auf, da der Fallback nicht leer ist, aber defensiver Code wäre angebracht.

---

## Datei 3: `MahnungErstellungModal.tsx`

### Verdict: WARN

### Issues

- **[severity: high] correctness — mahnstufe-Berechnung außerhalb von useEffect**: `mahnstufe` wird als `(contractData?.mahnstufe || 0) + 1` direkt im Render-Scope berechnet (Zeile 68). `contractData` ist ein Prop. Das ist korrekt *wenn* die Komponente bei jedem `contractData`-Wechsel neu rendert. Da `contractData` null sein kann und der Wert sich zwischen Renders ändern kann, ohne dass ein `useEffect`-Reset greift, kann `mahnstufe` und der initial gesetzte `mahnkostenGesamt` (Zeile 121: `11 * Math.max(1, contractData.mahnstufe || 1)`) kurzzeitig inkonsistent sein — insbesondere wenn `isOpen` sich ändert bevor `contractData` aktualisiert wird. Niedriges Risiko in der Praxis, aber ein `useMemo` oder Berechnung innerhalb des Reset-`useEffect` wäre sicherer.

- **[severity: medium] correctness — autoBerechneVerzugszinsen Monatszuordnung**: Die Schleife in `autoBerechneVerzugszinsen` (Zeile 364–368) berechnet den Fälligkeitsmonat als `heute.getMonth() - (monate - i)` Monate zurück. Bei `monate = 3, i = 0`: `heute.getMonth() - 3`. Das Ergebnis ist der drittletzte Monat relativ zu heute — also die Annahme, dass die älteste rückständige Miete `monate` Monate zurückliegt. Das ist eine **Vereinfachung**: wenn der Benutzer 3 Monate im Rückstand ist, aber der erste Rückstand nicht genau 3 Monate her ist, stimmt die Berechnung nicht. Da `anzahlMonatsmieten` nur eine Schätzung ist (aus `Math.ceil(rueckstand / monatsmiete)`), ist das tolerierbar — sollte aber in der UI als "Schätzung" kommuniziert werden.

- **[severity: medium] error handling — `dokumente.insert` ohne Fehlerprüfung**: In `handleSaveAndUpload` (Zeile 272–278) wird der Rückgabewert von `supabase.from('dokumente').insert(...)` nicht auf Fehler geprüft. Dasselbe gilt für `RentIncreaseModal` (Zeile 217–223). Wenn der DB-Insert fehlschlägt (z. B. RLS-Fehler), bekommt der Benutzer trotzdem die Erfolgsmeldung und das Modal schließt sich — das PDF liegt zwar im Storage, aber kein Datenbankeintrag wurde angelegt.

- **[severity: medium] security — `updateVerzugszinsenDetail` verwendet `any`**: Zeile 388: `field: string, value: any`. Der `field`-Parameter ist nicht auf die tatsächlichen Keys des Objekts beschränkt. Ein Typo im Aufruf würde unbemerkt einen falschen Key setzen. Stattdessen: `field: keyof typeof detail` oder explizit `'monat' | 'betrag'`.

- **[severity: low] correctness — Blob-URL-Leak**: In `regeneratePreview` (Zeilen 204–208) wird die alte URL mit `URL.revokeObjectURL(pdfBlobUrl)` widerrufen und dann eine neue erstellt. Da `pdfBlobUrl` ein State-Wert ist, wird der Wert zum Zeitpunkt der Callback-Erstellung gecapturet. Wenn mehrere schnelle Updates stattfinden (Debounce greift, aber zwei Callbacks überlappen sich), könnte eine URL doppelt widerrufen oder eine URL nie widerrufen werden. Das Cleanup-`useEffect` (Zeile 234–238) fängt den finalen State ab, aber nicht intermediäre Werte. Risiko ist bei 500ms Debounce gering.

- **[severity: low] readability — Zeile 108**: `setAnrede(firstMieter ? "Herr" : "Herr")` — beide Branches sind identisch. Der ternäre Ausdruck hat keinen Effekt und sollte bereinigt werden.

---

## Datei 4: `RentIncreaseModal.tsx`

### Verdict: WARN

### Issues

- **[severity: high] correctness — Kappungsgrenze wird nicht durchgesetzt**: Die Kappungsgrenze wird korrekt berechnet (`ueberKappung`, Zeile 68) und visuell angezeigt, aber in `handleSaveAndUpload` (Zeile 227) wird `parseFloat(neueKaltmiete) || contractData.current_kaltmiete` direkt in die DB geschrieben — **ohne zu prüfen ob `ueberKappung === true`**. Ein Benutzer kann die Kappungsgrenze ignorieren und trotzdem speichern. Wenn das nur eine Warnung sein soll, ist das ok — dann fehlt aber mindestens ein explizites Confirm-Dialog für den Überschreitungsfall.

- **[severity: medium] error handling — `mietvertrag.update` und `dokumente.insert` ohne Fehlerprüfung**: In `handleSaveAndUpload` (Zeilen 217–230) werden beide Supabase-Operationen nicht auf Fehler geprüft — weder `dokumente.insert` noch `mietvertrag.update`. Wenn das Update fehlschlägt (z. B. der Mietvertrag wurde zwischenzeitlich gelöscht), bekommt der Benutzer trotzdem "Gespeichert".

- **[severity: medium] correctness — Wirksamkeitsdatum**: Das Wirksamkeitsdatum wird als `heute + 3 Monate` berechnet (Zeile 126–128). Nach § 558b BGB muss der Mieter die Zustimmung bis zum Ende des zweiten Kalendermonats nach Zugang erteilen, die Erhöhung wird dann zum dritten Monat wirksam. Drei Monate ab Erstellungsdatum ist eine Näherung — korrekter wäre: Ende des übernächsten Monats + 1 Monat. Für ein Vorschaudokument ist das tolerierbar, sollte aber dokumentiert sein.

- **[severity: medium] correctness — debounce useEffect Dependencies**: Der debounce-`useEffect` (Zeile 167–176) listet `regeneratePreview` **nicht** in seinen Dependencies auf, obwohl er es aufruft. Er hat stattdessen manuell die Felder aufgelistet (Zeile 176). Das funktioniert in der Praxis, verstößt aber gegen die React-Regel "exhaustive-deps". Wenn `regeneratePreview` sich ändert (weil `buildPdfData` sich ändert), ohne dass einer der manuell gelisteten Werte sich ändert, wird kein neues Preview generiert. Konkretes Risiko: `aktuellerVpi` ändert sich nach dem ersten Laden (DB-Response kommt zurück) → `vpiNeu` wird im Reset-Effect aktualisiert → das ist in den Dependencies, also funktioniert es. Aber andere `buildPdfData`-Inputs könnten ähnlich übersprungen werden.

- **[severity: low] correctness — VPI-Berechnung erlaubt Negativwerte ohne Warnung**: Der VPI-`useEffect` (Zeile 103–113) berechnet nur dann eine neue Miete wenn `prozent > 0`. Bei `vpiNeu < vpiAlt` (Deflation) passiert nichts — das ist korrekt, aber es gibt keine UI-Hinweis dass der Index gesunken ist und daher keine Anpassung erfolgt.

- **[severity: low] security — `err: any` in catch**: Zeile 234: `catch (err: any)`. Laut Projekt-Regeln ist `any` nicht erlaubt. Stattdessen: `catch (err: unknown)` mit `instanceof Error`-Narrowing — wie korrekt in `MahnungErstellungModal` gemacht.

---

## Datei 5: `DarlehenVerwaltung.tsx` (Zeilen 475–620, 880–1050)

### Verdict: PASS WITH NOTES

### Issues

- **[severity: medium] correctness — `berechneTilgungsplan` Sicherheitsabbruch lässt `laufzeitEnde = null`**: Zeile 508: `if (monat > 600) { laufzeitEnde = null; break; }`. Nach dem Break wird Zeile 510 (`if (rs <= 0.01) laufzeitEnde = current`) nicht erreicht da `rs` noch > 0.01 ist. Das Verhalten ist korrekt (kein Ende anzeigen bei >600 Monaten), aber der Code macht es durch `laufzeitEnde = null` im Break explizit, während direkt darunter die gleiche Variable nochmal gesetzt wird — leicht verwirrend. Kein Bug, aber ein Kommentar würde helfen.

- **[severity: medium] correctness — LTV-Berechnung nutzt Kaufpreis statt Marktwert**: Zeile 523: `ltv = totalRestschuld / totalKaufpreis`. In der Immobilienbranche ist der übliche LTV (Loan-to-Value) `Restschuld / Marktwert`. Kaufpreis-basierter LTV ist eine andere Kennzahl (historisch). Wenn in der UI "LTV" angezeigt wird ohne Klarstellung, könnte das zu falschen Einschätzungen führen. Ggf. als "Kaufpreis-LTV" labeln oder auf `totalMarktwert` umstellen (falls vorhanden).

- **[severity: low] performance — `portfolioMetrics` useMemo mit `darlehenZahlungen` in Dependencies**: Zeile 605: `darlehenZahlungen` ist in den `useMemo`-Dependencies, wird aber im `portfolioMetrics`-Block (Zeilen 516–604) nicht direkt verwendet — `getEffectiveRestschuld(d.id, d.restschuld)` ruft eine externe Funktion auf die potenziell `darlehenZahlungen` liest. Das ist korrekt wenn `getEffectiveRestschuld` ein Closure über `darlehenZahlungen` ist. Ohne den Funktionskörper zu sehen kann nicht abschließend beurteilt werden ob die Dependency zu aggressiv oder nötig ist.

- **[severity: low] correctness — Monatsdauer-Approximation in Zinsbindungswarnung**: Zeile 579: `monthsLeft = diff / (1000 * 60 * 60 * 24 * 30)`. 30 Tage pro Monat ist eine Näherung. Bei Fristen nahe 12 Monaten kann das zu "11 Monate" statt "12 Monate" führen und eine Warnung auslösen oder unterdrücken. Für eine Warnung ist das tolerierbar.

- **[severity: low] security — `window.confirm` für Löschbestätigung**: Zeile 911: `if (confirm("Darlehen wirklich löschen?"))`. `window.confirm` ist ein blockierender Browser-Dialog der in einigen Umgebungen (z. B. iframes, bestimmte Browser-Einstellungen) unterdrückt wird und dann `false` zurückgibt — was zum unbeabsichtigten Nicht-Löschen führt, aber kein Sicherheitsrisiko darstellt. Konsistenter mit dem restlichen shadcn/ui-Stack wäre ein `AlertDialog`.

---

## Zusammenfassung

| Datei | Verdict |
|-------|---------|
| `useBasiszinsPerioden.ts` | PASS WITH NOTES |
| `verzugszinsen.ts` | PASS WITH NOTES |
| `MahnungErstellungModal.tsx` | WARN |
| `RentIncreaseModal.tsx` | WARN |
| `DarlehenVerwaltung.tsx` (Teilbereich) | PASS WITH NOTES |

**Kritischste Punkte (sofortiger Handlungsbedarf):**

1. **UTC-Drift in `verzugszinsen.ts`** — Feiertage werden bei UTC+1/+2 falsch erkannt. `toISOString()` durch lokale Datumsformatierung ersetzen.
2. **Fehlende Fehlerprüfung auf `dokumente.insert` und `mietvertrag.update`** in beiden Modals — Benutzer erhält Erfolgsmeldung auch bei DB-Fehler.
3. **Kappungsgrenze in `RentIncreaseModal`** wird nicht beim Speichern durchgesetzt — zumindest ein Confirm-Dialog bei Überschreitung nötig.
