

## Plan: Einheit 14 (Gartenhaus) zu Objekt 12 Ronnenberg hinzufügen

### Was passiert

1. **Neue Einheit einfügen** in `einheiten`-Tabelle:
   - ID: `00000000-0000-0000-0000-000000001214`
   - `immobilie_id`: `00000000-0000-0000-0000-000000000012`
   - `einheitentyp`: `Sonstiges` (Gartenhaus passt nicht in Garage/Wohnung)
   - `etage`: `Gartenhaus`
   - `qm`: NULL

2. **`einheiten_anzahl` auf 13 erhöhen** in `immobilien` (aktuell 12, stimmt schon nicht mit den 13 vorhandenen Einheiten überein -- wird auf 14 korrigiert, da es dann 14 Einheiten sind).

### Betroffene Bereiche (automatisch abgedeckt)

Die App lädt Einheiten dynamisch per Supabase-Query (`einheiten` WHERE `immobilie_id`), daher wird Einheit 14 automatisch in folgenden Views angezeigt:
- **ImmobilienDetail** (Einheiten-Tab)
- **Stammdaten/Mietübersicht** (EditableMietUebersicht)
- **Nebenkostenabrechnung** (NebenkostenBuildingView, Verteilung)
- **Zählerverwaltung** (ZaehlerVerwaltung)
- **Übergabe** (falls ein Vertrag angelegt wird)

Es sind **keine Code-Änderungen** nötig -- nur zwei Daten-Operationen (INSERT + UPDATE).

