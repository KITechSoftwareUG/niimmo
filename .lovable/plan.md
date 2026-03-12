
Ziel: Im Nebenkosten-Tab der Zahlungsverwaltung sollen immer die neuesten relevanten Zahlungen sichtbar sein (statt auf älteren Datensätzen „hängen zu bleiben“).

1) Verifizierte Hauptursache (warum bei dir 17.10.2025 erscheint)
- In `NebenkostenZuordnungTab.tsx` wird die Liste aktuell künstlich eingeschränkt:
  - Sobald es **irgendwelche** offenen KI-Klassifizierungen gibt, zeigt `displayedPayments` nur Zahlungen, die in `nebenkosten_klassifizierungen` stehen.
  - Dadurch werden neuere, noch nicht klassifizierte Zahlungen ausgeblendet.
- Genau das passt zu deinen Daten:
  - unzugeordnete `Nichtmiete` reichen bis **2026-03-09**
  - offene Klassifizierungen reichen nur bis **2025-10-17**
  - Ergebnis im UI: „letzte Nichtmiete“ wirkt alt/falsch.

2) Umsetzung (Code-Änderungsplan)
- Datei: `src/components/controlboard/NebenkostenZuordnungTab.tsx`
  1. `displayedPayments` umbauen:
     - Immer alle unzugeordneten relevanten Zahlungen anzeigen (nach Datum absteigend).
     - KI-Klassifizierung nur als Zusatzinfo/Badge verwenden, nicht als hartes Filterkriterium.
  2. Kategorien im Tab vereinheitlichen:
     - Query nicht nur auf `Nichtmiete`, sondern auf den tatsächlichen Nebenkosten-Flow erweitern (`Nichtmiete` + `Nebenkosten`), damit man nicht zwei Datenwelten hat.
  3. Optionaler UI-Filter:
     - Falls gewünscht „Nur KI-Vorschläge“ als expliziten Toggle anbieten (default: aus), statt still alle anderen zu verstecken.
  4. Sortierung deterministisch machen:
     - Primär `buchungsdatum DESC`, sekundär `import_datum DESC`, damit bei gleichen Buchungstagen stabil „neueste zuerst“ bleibt.

- Datei: `src/components/controlboard/PaymentManagement.tsx`
  5. Nach CSV-Import (`handleApplyAssignments`) zusätzlich die Nebenkosten-QueryKeys invalidieren:
     - `unzugeordnete-nebenkosten`
     - `zugeordnete-nebenkosten`
     - `nebenkosten-klassifizierungen-cached`
  - Damit der Tab sofort aktuelle Daten zeigt.

- Datei: `src/components/controlboard/PaymentKategorieEditor.tsx`
  6. Nach Kategorienänderung ebenfalls diese Nebenkosten-Keys invalidieren, damit Wechsel zwischen „Nichtmiete/Nebenkosten“ live im Nebenkosten-Tab reflektiert wird.

3) Technische Details (kurz)
```text
Aktuell:
unzugeordnete Zahlungen -> (wenn classifications.length > 0) -> nur klassifizierte IDs anzeigen
=> neuere unklassifizierte Zahlungen unsichtbar

Nach Fix:
unzugeordnete Zahlungen -> immer anzeigen (sortiert)
klassifizierungen -> nur Badges/Vorschläge
=> neueste Zahlung ist immer sichtbar
```

4) Validierung nach Umsetzung
- Fall A: neue Zahlung als `Nichtmiete`, ohne KI-Klassifizierung
  - Muss sofort oben im Nebenkosten-Tab erscheinen.
- Fall B: neue Zahlung als `Nebenkosten`
  - Muss ebenfalls im Nebenkosten-Tab erscheinen.
- Fall C: CSV-Import ausführen
  - Ohne Reload muss Nebenkosten-Tab aktualisierte Datumsreihenfolge zeigen.
- Fall D: Kategorie im „Alle Zahlungen“-Tab ändern
  - Nebenkosten-Tab muss sich direkt konsistent aktualisieren.
- End-to-end prüfen: Drag&Drop-Zuordnung, Undo, „Nichtmiete“-Aktion und Reihenfolge.

5) Ergebnis für deine konkrete Frage „Woran liegt das?“
- Nicht an fehlenden neuen Zahlungen in der DB, sondern an einer UI-Filterlogik:
  - Der Tab zeigt derzeit bevorzugt eine alte KI-Teilmenge statt der vollständigen aktuellen Liste.
