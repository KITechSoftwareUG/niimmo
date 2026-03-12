

## Bug: "XX% getilgt" zeigt falsche Werte

### Ursache

Die Funktion `getEffectiveRestschuld` (Zeile 332-340) holt den letzten Eintrag aus `darlehen_zahlungen` sortiert nach `buchungsdatum DESC`. Das Problem: Der Tilgungsplan-Import speichert **zukünftige projizierte Zahlungen** (bis z.B. 2055). Die letzte projizierte Zahlung hat `restschuld_danach: 0` — das Darlehen wäre dann theoretisch abbezahlt.

Beispiel aus der DB:
- Darlehen 400.000€, echte Restschuld 398.037€
- Aber letzter Tilgungsplan-Eintrag (01.01.2055): `restschuld_danach: 0`
- → Code berechnet: (400.000 - 0) / 400.000 = **100% getilgt** ← FALSCH

### Fix

**Datei: `src/components/dashboard/DarlehenVerwaltung.tsx`**

In `getEffectiveRestschuld` nur Zahlungen berücksichtigen, deren `buchungsdatum <= heute` liegt:

```typescript
const getEffectiveRestschuld = (darlehenId: string, staticRestschuld: number | null): number => {
  const today = new Date().toISOString().split('T')[0]; // "2026-03-12"
  const zahlungen = darlehenZahlungen
    ?.filter((z) => z.darlehen_id === darlehenId 
      && z.restschuld_danach != null 
      && z.buchungsdatum <= today)  // ← NUR vergangene/heutige Zahlungen
    ?.sort((a, b) => new Date(b.buchungsdatum).getTime() - new Date(a.buchungsdatum).getTime());
  if (zahlungen && zahlungen.length > 0) {
    return Math.abs(zahlungen[0].restschuld_danach!);
  }
  return Math.abs(staticRestschuld || 0);
};
```

Eine Zeile Änderung — der Datumsfilter `&& z.buchungsdatum <= today` stellt sicher, dass nur tatsächlich vergangene Zahlungen für die Restschuld-Berechnung herangezogen werden. Zukünftige Tilgungsplan-Projektionen werden ignoriert.

### Auswirkung

- Darlehen mit 400.000€ und Restschuld 398.037€ → ca. **0,5% getilgt** (korrekt)
- Darlehen mit 300.000€ und Restschuld 227.119€ → ca. **24,3% getilgt** (korrekt, da `restschuld_danach` aus vergangenen Zahlungen)
- Darlehen ohne vergangene Zahlungen → Fallback auf `darlehen.restschuld`

