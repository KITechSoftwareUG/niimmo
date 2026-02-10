

## IBAN beim Anlegen optional machen

Die IBAN (`bankkonto_mieter`) ist aktuell beim Anlegen eines neuen Mietvertrags ein Pflichtfeld. Sie soll wieder optional werden.

### Aenderungen in `src/components/dashboard/NewTenantContractDialog.tsx`

1. **Validierung im Step entfernen** (Zeile ~239): `validateContractStep()` prueft aktuell `contractData.bankkonto_mieter?.trim()` -- diesen Teil entfernen.

2. **Fehler-Wurf entfernen** (Zeile ~401-403): Den Block `if (!contractData.bankkonto_mieter?.trim()) { throw new Error(...) }` entfernen.

3. **Warnfarbe am Input entfernen** (Zeile ~1065): Die `className`-Logik `!contractData.bankkonto_mieter?.trim() ? 'border-amber-300' : ''` entfernen, damit das Feld neutral aussieht.

Keine weiteren Dateien betroffen -- `ContractFormStep.tsx` hat bereits kein Pflichtfeld-Kennzeichen fuer IBAN.

