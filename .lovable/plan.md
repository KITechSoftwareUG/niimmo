

## Plan: Absicherung gegen versehentliche Aktionen in Übergabe und Mahnung

### Problem
Beide Workflows erlauben es, durch einen versehentlichen Klick irreversible Aktionen auszulösen (Daten speichern, PDFs hochladen, E-Mails senden) -- ohne dass der Nutzer vorher eine Vorschau gesehen und explizit bestätigt hat.

### Änderungen

#### 1. Übergabe-Dialog (`UebergabeDialog.tsx`)

- **"Übergabe abschließen (ohne Vorschau)"-Button entfernen** (Zeilen 486-497). Es darf keinen Weg geben, den Vorgang ohne Preview abzuschließen.
- **Im Preview-Screen**: Den "Abschließen & Senden"-Button (Zeile 515-521) mit einem **Bestätigungsdialog** (AlertDialog) absichern: "Sind Sie sicher? Zählerstände werden gespeichert und das Protokoll abgeschlossen."
- Erst nach expliziter Bestätigung wird `handleSubmit()` aufgerufen.

#### 2. Mahnung-Modal (`MahnungErstellungModal.tsx`)

- **"Speichern & weiter"-Button** (Zeile 391-403): Vor dem Upload einen **Bestätigungsdialog** zwischenschalten: "Mahnung Stufe X wird gespeichert und als Dokument abgelegt. Fortfahren?"
- Erst nach Bestätigung wird `handleSaveAndUpload()` ausgeführt.
- **"E-Mail senden"-Button** im Email-Step: Ebenfalls mit Bestätigung absichern: "Mahnung wird an [E-Mail] versendet. Dies kann nicht rückgängig gemacht werden."

#### 3. Technische Umsetzung

- Nutze den bereits vorhandenen `AlertDialog` aus `@/components/ui/alert-dialog`
- Jeweils ein State-Flag (`showConfirmSave`, `showConfirmSend`) das den AlertDialog steuert
- Button-Klick setzt nur das Flag → AlertDialog zeigt sich → "Bestätigen" führt die eigentliche Aktion aus

### Betroffene Dateien
- `src/components/dashboard/handover/UebergabeDialog.tsx`
- `src/components/dashboard/MahnungErstellungModal.tsx`

