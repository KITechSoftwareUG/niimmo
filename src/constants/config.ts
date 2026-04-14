// Zentrale Konfigurationskonstanten — keine Magic Numbers im Code

/** Standard-Rücklastschrift-Gebühr in EUR (§675f BGB üblicher Marktpreis) */
export const RUECKLASTSCHRIFT_GEBUEHR_EUR = 7.50;

/** E-Mail-Adresse für Dev-only Features (Activity-Log, DevActivityLog etc.) */
export const DEV_EMAIL: string =
  import.meta.env.VITE_DEV_EMAIL ?? "info@kitdienstleistungen.de";
