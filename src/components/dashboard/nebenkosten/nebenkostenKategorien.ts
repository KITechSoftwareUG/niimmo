import {
  Building2,
  Droplets,
  Flame,
  Zap,
  Trash2,
  TreePine,
  Shield,
  User,
  Tv,
  WashingMachine,
  MoreHorizontal,
  Wrench,
  Home,
  Euro,
} from "lucide-react";

// BetrKV § 2 - 17 umlagefähige Nebenkostenarten
export const BETRKV_KATEGORIEN = [
  { id: "grundsteuer", name: "Grundsteuer", icon: Building2, beschreibung: "Laufende öffentliche Lasten des Grundstücks", umlagefaehig: true, schluessel: "qm" },
  { id: "wasserversorgung", name: "Wasserversorgung", icon: Droplets, beschreibung: "Kosten des Wasserverbrauchs, Grundgebühren", umlagefaehig: true, schluessel: "personen" },
  { id: "entwaesserung", name: "Entwässerung", icon: Droplets, beschreibung: "Kosten der Abwasserentsorgung", umlagefaehig: true, schluessel: "personen" },
  { id: "heizkosten", name: "Heizkosten", icon: Flame, beschreibung: "Kosten der zentralen Heizungsanlage", umlagefaehig: true, schluessel: "qm" },
  { id: "warmwasserkosten", name: "Warmwasserkosten", icon: Flame, beschreibung: "Kosten der zentralen Warmwasserversorgung", umlagefaehig: true, schluessel: "personen" },
  { id: "verbundene_anlagen", name: "Verbundene Anlagen", icon: Flame, beschreibung: "Heizung und Warmwasser kombiniert", umlagefaehig: true, schluessel: "qm" },
  { id: "aufzug", name: "Aufzug", icon: Building2, beschreibung: "Betriebsstrom, Wartung, Überwachung", umlagefaehig: true, schluessel: "gleich" },
  { id: "strassenreinigung_muell", name: "Straßenreinigung & Müll", icon: Trash2, beschreibung: "Müllabfuhr, Straßenreinigung", umlagefaehig: true, schluessel: "personen" },
  { id: "gebaeudereinigung", name: "Gebäudereinigung", icon: Home, beschreibung: "Reinigung, Ungezieferbekämpfung", umlagefaehig: true, schluessel: "qm" },
  { id: "gartenpflege", name: "Gartenpflege", icon: TreePine, beschreibung: "Pflege von Gärten, Spielplätzen", umlagefaehig: true, schluessel: "qm" },
  { id: "beleuchtung", name: "Beleuchtung", icon: Zap, beschreibung: "Außenbeleuchtung, Treppenhaus", umlagefaehig: true, schluessel: "gleich" },
  { id: "schornsteinreinigung", name: "Schornsteinreinigung", icon: Flame, beschreibung: "Kehrgebühren, Emissionsmessungen", umlagefaehig: true, schluessel: "qm" },
  { id: "versicherungen", name: "Versicherungen", icon: Shield, beschreibung: "Gebäude-, Haftpflichtversicherungen", umlagefaehig: true, schluessel: "qm" },
  { id: "hauswart", name: "Hauswart", icon: User, beschreibung: "Vergütung, Sozialbeiträge", umlagefaehig: true, schluessel: "qm" },
  { id: "antenne_kabel", name: "Antenne/Kabel", icon: Tv, beschreibung: "Gemeinschaftsantenne, Kabelanschluss", umlagefaehig: true, schluessel: "gleich" },
  { id: "waeschepflege", name: "Wäschepflege", icon: WashingMachine, beschreibung: "Gemeinschaftliche Waschmaschinen", umlagefaehig: true, schluessel: "gleich" },
  { id: "sonstige_betriebskosten", name: "Sonstige Betriebskosten", icon: MoreHorizontal, beschreibung: "Vertraglich vereinbarte Kosten", umlagefaehig: true, schluessel: "qm" },
];

// Nicht umlagefähige Kostenarten
export const NICHT_UMLAGEFAEHIGE_KATEGORIEN = [
  { id: "reparaturen", name: "Reparaturen", icon: Wrench, beschreibung: "Instandhaltungskosten", umlagefaehig: false, schluessel: "qm" },
  { id: "wartungen", name: "Wartungen", icon: Wrench, beschreibung: "Instandsetzungswartungen", umlagefaehig: false, schluessel: "qm" },
  { id: "bankgebuehren", name: "Bankgebühren", icon: Euro, beschreibung: "Kontoführung, Porto", umlagefaehig: false, schluessel: "qm" },
  { id: "hausverwaltung", name: "Hausverwaltung", icon: Building2, beschreibung: "Verwaltungskosten", umlagefaehig: false, schluessel: "qm" },
];
