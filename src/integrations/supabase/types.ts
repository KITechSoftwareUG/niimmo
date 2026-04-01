export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      angespannte_maerkte: {
        Row: {
          bundesland: string
          created_at: string
          gemeinde: string
          gueltig_bis: string | null
          id: string
          kappungsgrenze_prozent: number
          updated_at: string
          verordnung: string | null
        }
        Insert: {
          bundesland: string
          created_at?: string
          gemeinde: string
          gueltig_bis?: string | null
          id?: string
          kappungsgrenze_prozent?: number
          updated_at?: string
          verordnung?: string | null
        }
        Update: {
          bundesland?: string
          created_at?: string
          gemeinde?: string
          gueltig_bis?: string | null
          id?: string
          kappungsgrenze_prozent?: number
          updated_at?: string
          verordnung?: string | null
        }
        Relationships: []
      }
      csv_uploads: {
        Row: {
          anzahl_datensaetze: number | null
          dateigroe_bytes: number | null
          dateiname: string
          erstellt_am: string | null
          hochgeladen_am: string | null
          id: string
          status: string | null
        }
        Insert: {
          anzahl_datensaetze?: number | null
          dateigroe_bytes?: number | null
          dateiname: string
          erstellt_am?: string | null
          hochgeladen_am?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          anzahl_datensaetze?: number | null
          dateigroe_bytes?: number | null
          dateiname?: string
          erstellt_am?: string | null
          hochgeladen_am?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      darlehen: {
        Row: {
          aktualisiert_am: string | null
          bank: string | null
          bezeichnung: string
          darlehensbetrag: number
          ende_datum: string | null
          erstellt_am: string | null
          id: string
          kontonummer: string | null
          monatliche_rate: number | null
          notizen: string | null
          restschuld: number | null
          start_datum: string | null
          tilgungssatz_prozent: number | null
          zinssatz_prozent: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          bank?: string | null
          bezeichnung: string
          darlehensbetrag?: number
          ende_datum?: string | null
          erstellt_am?: string | null
          id?: string
          kontonummer?: string | null
          monatliche_rate?: number | null
          notizen?: string | null
          restschuld?: number | null
          start_datum?: string | null
          tilgungssatz_prozent?: number | null
          zinssatz_prozent?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          bank?: string | null
          bezeichnung?: string
          darlehensbetrag?: number
          ende_datum?: string | null
          erstellt_am?: string | null
          id?: string
          kontonummer?: string | null
          monatliche_rate?: number | null
          notizen?: string | null
          restschuld?: number | null
          start_datum?: string | null
          tilgungssatz_prozent?: number | null
          zinssatz_prozent?: number | null
        }
        Relationships: []
      }
      darlehen_immobilien: {
        Row: {
          darlehen_id: string
          erstellt_am: string | null
          id: string
          immobilie_id: string
        }
        Insert: {
          darlehen_id: string
          erstellt_am?: string | null
          id?: string
          immobilie_id: string
        }
        Update: {
          darlehen_id?: string
          erstellt_am?: string | null
          id?: string
          immobilie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "darlehen_immobilien_darlehen_id_fkey"
            columns: ["darlehen_id"]
            isOneToOne: false
            referencedRelation: "darlehen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "darlehen_immobilien_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
        ]
      }
      darlehen_zahlungen: {
        Row: {
          betrag: number
          buchungsdatum: string
          darlehen_id: string
          erstellt_am: string | null
          id: string
          notizen: string | null
          restschuld_danach: number | null
          tilgungsanteil: number | null
          zahlung_id: string | null
          zinsanteil: number | null
        }
        Insert: {
          betrag?: number
          buchungsdatum: string
          darlehen_id: string
          erstellt_am?: string | null
          id?: string
          notizen?: string | null
          restschuld_danach?: number | null
          tilgungsanteil?: number | null
          zahlung_id?: string | null
          zinsanteil?: number | null
        }
        Update: {
          betrag?: number
          buchungsdatum?: string
          darlehen_id?: string
          erstellt_am?: string | null
          id?: string
          notizen?: string | null
          restschuld_danach?: number | null
          tilgungsanteil?: number | null
          zahlung_id?: string | null
          zinsanteil?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "darlehen_zahlungen_darlehen_id_fkey"
            columns: ["darlehen_id"]
            isOneToOne: false
            referencedRelation: "darlehen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "darlehen_zahlungen_zahlung_id_fkey"
            columns: ["zahlung_id"]
            isOneToOne: false
            referencedRelation: "zahlungen"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_ticket_kommentare: {
        Row: {
          erstellt_am: string
          erstellt_von: string | null
          id: string
          kommentar: string
          ticket_id: string
        }
        Insert: {
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kommentar: string
          ticket_id: string
        }
        Update: {
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kommentar?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_ticket_kommentare_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dev_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_tickets: {
        Row: {
          aktualisiert_am: string
          beschreibung: string | null
          erstellt_am: string
          erstellt_von: string | null
          id: string
          kurzbeschreibung: string | null
          prioritaet: string
          screenshot_urls: string[] | null
          sort_order: number
          status: string
          titel: string
          typ: string
        }
        Insert: {
          aktualisiert_am?: string
          beschreibung?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kurzbeschreibung?: string | null
          prioritaet?: string
          screenshot_urls?: string[] | null
          sort_order?: number
          status?: string
          titel: string
          typ?: string
        }
        Update: {
          aktualisiert_am?: string
          beschreibung?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kurzbeschreibung?: string | null
          prioritaet?: string
          screenshot_urls?: string[] | null
          sort_order?: number
          status?: string
          titel?: string
          typ?: string
        }
        Relationships: []
      }
      dokumente: {
        Row: {
          dateityp: string | null
          erstellt_von: string | null
          geloescht: boolean
          groesse_bytes: number | null
          hochgeladen_am: string | null
          id: string
          immobilie_id: string | null
          kategorie: Database["public"]["Enums"]["kategorie"] | null
          mietvertrag_id: string | null
          pfad: string | null
          titel: string | null
        }
        Insert: {
          dateityp?: string | null
          erstellt_von?: string | null
          geloescht?: boolean
          groesse_bytes?: number | null
          hochgeladen_am?: string | null
          id?: string
          immobilie_id?: string | null
          kategorie?: Database["public"]["Enums"]["kategorie"] | null
          mietvertrag_id?: string | null
          pfad?: string | null
          titel?: string | null
        }
        Update: {
          dateityp?: string | null
          erstellt_von?: string | null
          geloescht?: boolean
          groesse_bytes?: number | null
          hochgeladen_am?: string | null
          id?: string
          immobilie_id?: string | null
          kategorie?: Database["public"]["Enums"]["kategorie"] | null
          mietvertrag_id?: string | null
          pfad?: string | null
          titel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dokumente_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dokumente_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dokumente_mietvertrag"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
        ]
      }
      einheiten: {
        Row: {
          aktualisiert_am: string | null
          anzahl_personen: number | null
          einheitentyp: Database["public"]["Enums"]["einheitentyp"] | null
          erstellt_am: string | null
          etage: string | null
          gas_stand_aktuell: number | null
          gas_stand_datum: string | null
          gas_zaehler: string | null
          id: string
          immobilie_id: string | null
          kaltwasser_stand_aktuell: number | null
          kaltwasser_stand_datum: string | null
          kaltwasser_zaehler: string | null
          qm: number | null
          soll_miete: number | null
          strom_stand_aktuell: number | null
          strom_stand_datum: string | null
          strom_zaehler: string | null
          verteilerschluessel_art: string | null
          verteilerschluessel_wert: number | null
          warmwasser_stand_aktuell: number | null
          warmwasser_stand_datum: string | null
          warmwasser_zaehler: string | null
          zaehler: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          anzahl_personen?: number | null
          einheitentyp?: Database["public"]["Enums"]["einheitentyp"] | null
          erstellt_am?: string | null
          etage?: string | null
          gas_stand_aktuell?: number | null
          gas_stand_datum?: string | null
          gas_zaehler?: string | null
          id?: string
          immobilie_id?: string | null
          kaltwasser_stand_aktuell?: number | null
          kaltwasser_stand_datum?: string | null
          kaltwasser_zaehler?: string | null
          qm?: number | null
          soll_miete?: number | null
          strom_stand_aktuell?: number | null
          strom_stand_datum?: string | null
          strom_zaehler?: string | null
          verteilerschluessel_art?: string | null
          verteilerschluessel_wert?: number | null
          warmwasser_stand_aktuell?: number | null
          warmwasser_stand_datum?: string | null
          warmwasser_zaehler?: string | null
          zaehler?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          anzahl_personen?: number | null
          einheitentyp?: Database["public"]["Enums"]["einheitentyp"] | null
          erstellt_am?: string | null
          etage?: string | null
          gas_stand_aktuell?: number | null
          gas_stand_datum?: string | null
          gas_zaehler?: string | null
          id?: string
          immobilie_id?: string | null
          kaltwasser_stand_aktuell?: number | null
          kaltwasser_stand_datum?: string | null
          kaltwasser_zaehler?: string | null
          qm?: number | null
          soll_miete?: number | null
          strom_stand_aktuell?: number | null
          strom_stand_datum?: string | null
          strom_zaehler?: string | null
          verteilerschluessel_art?: string | null
          verteilerschluessel_wert?: number | null
          warmwasser_stand_aktuell?: number | null
          warmwasser_stand_datum?: string | null
          warmwasser_zaehler?: string | null
          zaehler?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "einheiten_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
        ]
      }
      immobilien: {
        Row: {
          adresse: string
          aktualisiert_am: string | null
          allgemein_gas_datum: string | null
          allgemein_gas_datum_2: string | null
          allgemein_gas_stand: number | null
          allgemein_gas_stand_2: number | null
          allgemein_gas_zaehler: string | null
          allgemein_gas_zaehler_2: string | null
          allgemein_strom_datum: string | null
          allgemein_strom_datum_2: string | null
          allgemein_strom_stand: number | null
          allgemein_strom_stand_2: number | null
          allgemein_strom_zaehler: string | null
          allgemein_strom_zaehler_2: string | null
          allgemein_wasser_datum: string | null
          allgemein_wasser_datum_2: string | null
          allgemein_wasser_stand: number | null
          allgemein_wasser_stand_2: number | null
          allgemein_wasser_zaehler: string | null
          allgemein_wasser_zaehler_2: string | null
          Annuität: number | null
          baujahr: number | null
          beschreibung: string | null
          einheiten_anzahl: number
          erstellt_am: string | null
          hat_gas: boolean
          hat_strom: boolean
          hat_wasser: boolean
          id: string
          ist_angespannt: boolean
          kaufpreis: number | null
          "Kontonr.": string | null
          marktwert: number | null
          name: string
          objekttyp: Database["public"]["Enums"]["objekttyp"] | null
          restschuld: number | null
          versorger_gas_email: string | null
          versorger_gas_name: string | null
          versorger_strom_email: string | null
          versorger_strom_name: string | null
          versorger_wasser_email: string | null
          versorger_wasser_name: string | null
        }
        Insert: {
          adresse: string
          aktualisiert_am?: string | null
          allgemein_gas_datum?: string | null
          allgemein_gas_datum_2?: string | null
          allgemein_gas_stand?: number | null
          allgemein_gas_stand_2?: number | null
          allgemein_gas_zaehler?: string | null
          allgemein_gas_zaehler_2?: string | null
          allgemein_strom_datum?: string | null
          allgemein_strom_datum_2?: string | null
          allgemein_strom_stand?: number | null
          allgemein_strom_stand_2?: number | null
          allgemein_strom_zaehler?: string | null
          allgemein_strom_zaehler_2?: string | null
          allgemein_wasser_datum?: string | null
          allgemein_wasser_datum_2?: string | null
          allgemein_wasser_stand?: number | null
          allgemein_wasser_stand_2?: number | null
          allgemein_wasser_zaehler?: string | null
          allgemein_wasser_zaehler_2?: string | null
          Annuität?: number | null
          baujahr?: number | null
          beschreibung?: string | null
          einheiten_anzahl: number
          erstellt_am?: string | null
          hat_gas?: boolean
          hat_strom?: boolean
          hat_wasser?: boolean
          id?: string
          ist_angespannt?: boolean
          kaufpreis?: number | null
          "Kontonr."?: string | null
          marktwert?: number | null
          name: string
          objekttyp?: Database["public"]["Enums"]["objekttyp"] | null
          restschuld?: number | null
          versorger_gas_email?: string | null
          versorger_gas_name?: string | null
          versorger_strom_email?: string | null
          versorger_strom_name?: string | null
          versorger_wasser_email?: string | null
          versorger_wasser_name?: string | null
        }
        Update: {
          adresse?: string
          aktualisiert_am?: string | null
          allgemein_gas_datum?: string | null
          allgemein_gas_datum_2?: string | null
          allgemein_gas_stand?: number | null
          allgemein_gas_stand_2?: number | null
          allgemein_gas_zaehler?: string | null
          allgemein_gas_zaehler_2?: string | null
          allgemein_strom_datum?: string | null
          allgemein_strom_datum_2?: string | null
          allgemein_strom_stand?: number | null
          allgemein_strom_stand_2?: number | null
          allgemein_strom_zaehler?: string | null
          allgemein_strom_zaehler_2?: string | null
          allgemein_wasser_datum?: string | null
          allgemein_wasser_datum_2?: string | null
          allgemein_wasser_stand?: number | null
          allgemein_wasser_stand_2?: number | null
          allgemein_wasser_zaehler?: string | null
          allgemein_wasser_zaehler_2?: string | null
          Annuität?: number | null
          baujahr?: number | null
          beschreibung?: string | null
          einheiten_anzahl?: number
          erstellt_am?: string | null
          hat_gas?: boolean
          hat_strom?: boolean
          hat_wasser?: boolean
          id?: string
          ist_angespannt?: boolean
          kaufpreis?: number | null
          "Kontonr."?: string | null
          marktwert?: number | null
          name?: string
          objekttyp?: Database["public"]["Enums"]["objekttyp"] | null
          restschuld?: number | null
          versorger_gas_email?: string | null
          versorger_gas_name?: string | null
          versorger_strom_email?: string | null
          versorger_strom_name?: string | null
          versorger_wasser_email?: string | null
          versorger_wasser_name?: string | null
        }
        Relationships: []
      }
      kostenposition_anteile: {
        Row: {
          anteil_betrag: number
          anteil_prozent: number
          bezugsgroesse_einheit: number | null
          bezugsgroesse_gesamt: number | null
          einheit_id: string
          erstellt_am: string | null
          id: string
          kostenposition_id: string
          verteilerschluessel_art: string
          zeitanteil_faktor: number | null
          zeitraum_bis: string | null
          zeitraum_von: string | null
        }
        Insert: {
          anteil_betrag: number
          anteil_prozent: number
          bezugsgroesse_einheit?: number | null
          bezugsgroesse_gesamt?: number | null
          einheit_id: string
          erstellt_am?: string | null
          id?: string
          kostenposition_id: string
          verteilerschluessel_art: string
          zeitanteil_faktor?: number | null
          zeitraum_bis?: string | null
          zeitraum_von?: string | null
        }
        Update: {
          anteil_betrag?: number
          anteil_prozent?: number
          bezugsgroesse_einheit?: number | null
          bezugsgroesse_gesamt?: number | null
          einheit_id?: string
          erstellt_am?: string | null
          id?: string
          kostenposition_id?: string
          verteilerschluessel_art?: string
          zeitanteil_faktor?: number | null
          zeitraum_bis?: string | null
          zeitraum_von?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kostenposition_anteile_einheit_id_fkey"
            columns: ["einheit_id"]
            isOneToOne: false
            referencedRelation: "einheiten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kostenposition_anteile_kostenposition_id_fkey"
            columns: ["kostenposition_id"]
            isOneToOne: false
            referencedRelation: "kostenpositionen"
            referencedColumns: ["id"]
          },
        ]
      }
      kostenpositionen: {
        Row: {
          aktualisiert_am: string | null
          bezeichnung: string | null
          erstellt_am: string | null
          erstellt_von: string | null
          gesamtbetrag: number
          id: string
          immobilie_id: string
          ist_umlagefaehig: boolean
          nebenkostenart_id: string | null
          quelle: string
          zahlung_id: string | null
          zeitraum_bis: string
          zeitraum_von: string
        }
        Insert: {
          aktualisiert_am?: string | null
          bezeichnung?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          gesamtbetrag: number
          id?: string
          immobilie_id: string
          ist_umlagefaehig?: boolean
          nebenkostenart_id?: string | null
          quelle?: string
          zahlung_id?: string | null
          zeitraum_bis: string
          zeitraum_von: string
        }
        Update: {
          aktualisiert_am?: string | null
          bezeichnung?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          gesamtbetrag?: number
          id?: string
          immobilie_id?: string
          ist_umlagefaehig?: boolean
          nebenkostenart_id?: string | null
          quelle?: string
          zahlung_id?: string | null
          zeitraum_bis?: string
          zeitraum_von?: string
        }
        Relationships: [
          {
            foreignKeyName: "kostenpositionen_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kostenpositionen_nebenkostenart_id_fkey"
            columns: ["nebenkostenart_id"]
            isOneToOne: false
            referencedRelation: "nebenkostenarten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kostenpositionen_zahlung_id_fkey"
            columns: ["zahlung_id"]
            isOneToOne: false
            referencedRelation: "zahlungen"
            referencedColumns: ["id"]
          },
        ]
      }
      marktdaten: {
        Row: {
          abgerufen_am: string
          created_at: string
          id: string
          quelle: string
          stichtag: string
          typ: string
          wert: number
        }
        Insert: {
          abgerufen_am?: string
          created_at?: string
          id?: string
          quelle: string
          stichtag: string
          typ: string
          wert: number
        }
        Update: {
          abgerufen_am?: string
          created_at?: string
          id?: string
          quelle?: string
          stichtag?: string
          typ?: string
          wert?: number
        }
        Relationships: []
      }
      mieter: {
        Row: {
          aktualisiert_am: string | null
          erstellt_am: string | null
          geburtsdatum: string | null
          hauptmail: string | null
          id: string
          nachname: string | null
          telnr: string | null
          vorname: string
          weitere_mails: string | null
        }
        Insert: {
          aktualisiert_am?: string | null
          erstellt_am?: string | null
          geburtsdatum?: string | null
          hauptmail?: string | null
          id?: string
          nachname?: string | null
          telnr?: string | null
          vorname: string
          weitere_mails?: string | null
        }
        Update: {
          aktualisiert_am?: string | null
          erstellt_am?: string | null
          geburtsdatum?: string | null
          hauptmail?: string | null
          id?: string
          nachname?: string | null
          telnr?: string | null
          vorname?: string
          weitere_mails?: string | null
        }
        Relationships: []
      }
      mietforderungen: {
        Row: {
          erzeugt_am: string | null
          faellig_seit: string | null
          faelligkeitsdatum: string | null
          id: string
          ist_faellig: boolean | null
          mietvertrag_id: string | null
          sollbetrag: number | null
          sollmonat: string
        }
        Insert: {
          erzeugt_am?: string | null
          faellig_seit?: string | null
          faelligkeitsdatum?: string | null
          id?: string
          ist_faellig?: boolean | null
          mietvertrag_id?: string | null
          sollbetrag?: number | null
          sollmonat: string
        }
        Update: {
          erzeugt_am?: string | null
          faellig_seit?: string | null
          faelligkeitsdatum?: string | null
          id?: string
          ist_faellig?: boolean | null
          mietvertrag_id?: string | null
          sollbetrag?: number | null
          sollmonat?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_mietvertrag_id_on_mietforderungen"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mietforderungen_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
        ]
      }
      mietvertrag: {
        Row: {
          aktualisiert_am: string | null
          anzahl_personen: number | null
          bankkonto_mieter: string | null
          bankkonto_mieter_geprueft: boolean
          betriebskosten: number | null
          einheit_id: string
          ende_datum: string | null
          erstellt_am: string | null
          gas_auszug: number | null
          gas_einzug: number | null
          id: string
          kaltmiete: number | null
          kaltwasser_auszug: number | null
          kaltwasser_einzug: number | null
          kaution_betrag: number | null
          kaution_gezahlt_am: string | null
          kaution_ist: number | null
          kaution_status: string | null
          kuendigungsdatum: string | null
          lastschrift: boolean
          lastschrift_wartetage: number | null
          letzte_mahnung_am: string | null
          letzte_mieterhoehung_am: string | null
          mahnstufe: number | null
          naechste_mahnung_am: string | null
          neue_anschrift: string | null
          ruecklastschrift_gebuehr: number | null
          start_datum: string | null
          status: Database["public"]["Enums"]["mietstatus"] | null
          strom_auszug: number | null
          strom_einzug: number | null
          verwendungszweck: string[] | null
          warmwasser_auszug: number | null
          warmwasser_einzug: number | null
          weitere_bankkonten: string | null
        }
        Insert: {
          aktualisiert_am?: string | null
          anzahl_personen?: number | null
          bankkonto_mieter?: string | null
          bankkonto_mieter_geprueft?: boolean
          betriebskosten?: number | null
          einheit_id: string
          ende_datum?: string | null
          erstellt_am?: string | null
          gas_auszug?: number | null
          gas_einzug?: number | null
          id?: string
          kaltmiete?: number | null
          kaltwasser_auszug?: number | null
          kaltwasser_einzug?: number | null
          kaution_betrag?: number | null
          kaution_gezahlt_am?: string | null
          kaution_ist?: number | null
          kaution_status?: string | null
          kuendigungsdatum?: string | null
          lastschrift?: boolean
          lastschrift_wartetage?: number | null
          letzte_mahnung_am?: string | null
          letzte_mieterhoehung_am?: string | null
          mahnstufe?: number | null
          naechste_mahnung_am?: string | null
          neue_anschrift?: string | null
          ruecklastschrift_gebuehr?: number | null
          start_datum?: string | null
          status?: Database["public"]["Enums"]["mietstatus"] | null
          strom_auszug?: number | null
          strom_einzug?: number | null
          verwendungszweck?: string[] | null
          warmwasser_auszug?: number | null
          warmwasser_einzug?: number | null
          weitere_bankkonten?: string | null
        }
        Update: {
          aktualisiert_am?: string | null
          anzahl_personen?: number | null
          bankkonto_mieter?: string | null
          bankkonto_mieter_geprueft?: boolean
          betriebskosten?: number | null
          einheit_id?: string
          ende_datum?: string | null
          erstellt_am?: string | null
          gas_auszug?: number | null
          gas_einzug?: number | null
          id?: string
          kaltmiete?: number | null
          kaltwasser_auszug?: number | null
          kaltwasser_einzug?: number | null
          kaution_betrag?: number | null
          kaution_gezahlt_am?: string | null
          kaution_ist?: number | null
          kaution_status?: string | null
          kuendigungsdatum?: string | null
          lastschrift?: boolean
          lastschrift_wartetage?: number | null
          letzte_mahnung_am?: string | null
          letzte_mieterhoehung_am?: string | null
          mahnstufe?: number | null
          naechste_mahnung_am?: string | null
          neue_anschrift?: string | null
          ruecklastschrift_gebuehr?: number | null
          start_datum?: string | null
          status?: Database["public"]["Enums"]["mietstatus"] | null
          strom_auszug?: number | null
          strom_einzug?: number | null
          verwendungszweck?: string[] | null
          warmwasser_auszug?: number | null
          warmwasser_einzug?: number | null
          weitere_bankkonten?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mietvertraege_einheit_id_fkey"
            columns: ["einheit_id"]
            isOneToOne: false
            referencedRelation: "einheiten"
            referencedColumns: ["id"]
          },
        ]
      }
      mietvertrag_mieter: {
        Row: {
          mieter_id: string
          mietvertrag_id: string
        }
        Insert: {
          mieter_id: string
          mietvertrag_id: string
        }
        Update: {
          mieter_id?: string
          mietvertrag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mietvertrag_mieter_mieter_id_fkey"
            columns: ["mieter_id"]
            isOneToOne: false
            referencedRelation: "mieter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mietvertrag_mieter_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      nebenkosten_anteile: {
        Row: {
          aktualisiert_am: string | null
          anteil_wert: number | null
          einheit_id: string
          erstellt_am: string | null
          id: string
          nebenkostenart_id: string
        }
        Insert: {
          aktualisiert_am?: string | null
          anteil_wert?: number | null
          einheit_id: string
          erstellt_am?: string | null
          id?: string
          nebenkostenart_id: string
        }
        Update: {
          aktualisiert_am?: string | null
          anteil_wert?: number | null
          einheit_id?: string
          erstellt_am?: string | null
          id?: string
          nebenkostenart_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nebenkosten_anteile_einheit_id_fkey"
            columns: ["einheit_id"]
            isOneToOne: false
            referencedRelation: "einheiten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nebenkosten_anteile_nebenkostenart_id_fkey"
            columns: ["nebenkostenart_id"]
            isOneToOne: false
            referencedRelation: "nebenkostenarten"
            referencedColumns: ["id"]
          },
        ]
      }
      nebenkosten_klassifizierungen: {
        Row: {
          bestaetigt: boolean
          bestaetigt_am: string | null
          category: string
          confidence: string
          id: string
          is_betriebskosten: boolean
          klassifiziert_am: string
          reasoning: string | null
          suggested_immobilie_id: string | null
          uebersprungen: boolean
          zahlung_id: string
        }
        Insert: {
          bestaetigt?: boolean
          bestaetigt_am?: string | null
          category: string
          confidence: string
          id?: string
          is_betriebskosten?: boolean
          klassifiziert_am?: string
          reasoning?: string | null
          suggested_immobilie_id?: string | null
          uebersprungen?: boolean
          zahlung_id: string
        }
        Update: {
          bestaetigt?: boolean
          bestaetigt_am?: string | null
          category?: string
          confidence?: string
          id?: string
          is_betriebskosten?: boolean
          klassifiziert_am?: string
          reasoning?: string | null
          suggested_immobilie_id?: string | null
          uebersprungen?: boolean
          zahlung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nebenkosten_klassifizierungen_suggested_immobilie_id_fkey"
            columns: ["suggested_immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nebenkosten_klassifizierungen_zahlung_id_fkey"
            columns: ["zahlung_id"]
            isOneToOne: true
            referencedRelation: "zahlungen"
            referencedColumns: ["id"]
          },
        ]
      }
      nebenkosten_zahlungen: {
        Row: {
          einheit_id: string | null
          erstellt_am: string | null
          id: string
          nebenkostenart_id: string | null
          verteilung_typ: string
          zahlung_id: string
        }
        Insert: {
          einheit_id?: string | null
          erstellt_am?: string | null
          id?: string
          nebenkostenart_id?: string | null
          verteilung_typ?: string
          zahlung_id: string
        }
        Update: {
          einheit_id?: string | null
          erstellt_am?: string | null
          id?: string
          nebenkostenart_id?: string | null
          verteilung_typ?: string
          zahlung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nebenkosten_zahlungen_einheit_id_fkey"
            columns: ["einheit_id"]
            isOneToOne: false
            referencedRelation: "einheiten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nebenkosten_zahlungen_nebenkostenart_id_fkey"
            columns: ["nebenkostenart_id"]
            isOneToOne: false
            referencedRelation: "nebenkostenarten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nebenkosten_zahlungen_zahlung_id_fkey"
            columns: ["zahlung_id"]
            isOneToOne: true
            referencedRelation: "zahlungen"
            referencedColumns: ["id"]
          },
        ]
      }
      nebenkostenarten: {
        Row: {
          aktualisiert_am: string | null
          beschreibung: string | null
          erstellt_am: string | null
          id: string
          immobilie_id: string
          ist_umlagefaehig: boolean
          name: string
          verteilerschluessel_art: string
        }
        Insert: {
          aktualisiert_am?: string | null
          beschreibung?: string | null
          erstellt_am?: string | null
          id?: string
          immobilie_id: string
          ist_umlagefaehig?: boolean
          name: string
          verteilerschluessel_art?: string
        }
        Update: {
          aktualisiert_am?: string | null
          beschreibung?: string | null
          erstellt_am?: string | null
          id?: string
          immobilie_id?: string
          ist_umlagefaehig?: boolean
          name?: string
          verteilerschluessel_art?: string
        }
        Relationships: [
          {
            foreignKeyName: "nebenkostenarten_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
        ]
      }
      nichtmiete_regeln: {
        Row: {
          aktiv: boolean
          aktualisiert_am: string
          beschreibung: string | null
          erstellt_am: string
          id: string
          regel_typ: string
          wert: string
        }
        Insert: {
          aktiv?: boolean
          aktualisiert_am?: string
          beschreibung?: string | null
          erstellt_am?: string
          id?: string
          regel_typ: string
          wert: string
        }
        Update: {
          aktiv?: boolean
          aktualisiert_am?: string
          beschreibung?: string | null
          erstellt_am?: string
          id?: string
          regel_typ?: string
          wert?: string
        }
        Relationships: []
      }
      sonderfall_regeln: {
        Row: {
          aktiv: boolean
          aktualisiert_am: string
          beschreibung: string | null
          confidence: number
          erstellt_am: string
          id: string
          match_typ: string
          match_wert: string
          name: string
          ziel_kategorie: string
          ziel_mieter_name: string | null
        }
        Insert: {
          aktiv?: boolean
          aktualisiert_am?: string
          beschreibung?: string | null
          confidence?: number
          erstellt_am?: string
          id?: string
          match_typ: string
          match_wert: string
          name: string
          ziel_kategorie?: string
          ziel_mieter_name?: string | null
        }
        Update: {
          aktiv?: boolean
          aktualisiert_am?: string
          beschreibung?: string | null
          confidence?: number
          erstellt_am?: string
          id?: string
          match_typ?: string
          match_wert?: string
          name?: string
          ziel_kategorie?: string
          ziel_mieter_name?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          component: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          page_path: string | null
          session_id: string | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          page_path?: string | null
          session_id?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          page_path?: string | null
          session_id?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      versicherungen: {
        Row: {
          aktualisiert_am: string | null
          email: string | null
          erstellt_am: string | null
          firma: string | null
          id: string
          immobilie_id: string
          jahresbeitrag: number | null
          kontaktperson: string | null
          notizen: string | null
          telefon: string | null
          typ: string
          vertragsnummer: string | null
        }
        Insert: {
          aktualisiert_am?: string | null
          email?: string | null
          erstellt_am?: string | null
          firma?: string | null
          id?: string
          immobilie_id: string
          jahresbeitrag?: number | null
          kontaktperson?: string | null
          notizen?: string | null
          telefon?: string | null
          typ: string
          vertragsnummer?: string | null
        }
        Update: {
          aktualisiert_am?: string | null
          email?: string | null
          erstellt_am?: string | null
          firma?: string | null
          id?: string
          immobilie_id?: string
          jahresbeitrag?: number | null
          kontaktperson?: string | null
          notizen?: string | null
          telefon?: string | null
          typ?: string
          vertragsnummer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "versicherungen_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_nachrichten: {
        Row: {
          absender_name: string | null
          empfaenger_name: string | null
          erstellt_am: string
          gelesen: boolean
          id: string
          media_url: string | null
          mieter_id: string | null
          mietvertrag_id: string | null
          nachricht: string
          richtung: string
          telefonnummer: string
          zeitstempel: string
        }
        Insert: {
          absender_name?: string | null
          empfaenger_name?: string | null
          erstellt_am?: string
          gelesen?: boolean
          id?: string
          media_url?: string | null
          mieter_id?: string | null
          mietvertrag_id?: string | null
          nachricht: string
          richtung: string
          telefonnummer: string
          zeitstempel?: string
        }
        Update: {
          absender_name?: string | null
          empfaenger_name?: string | null
          erstellt_am?: string
          gelesen?: boolean
          id?: string
          media_url?: string | null
          mieter_id?: string | null
          mietvertrag_id?: string | null
          nachricht?: string
          richtung?: string
          telefonnummer?: string
          zeitstempel?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_nachrichten_mieter_id_fkey"
            columns: ["mieter_id"]
            isOneToOne: false
            referencedRelation: "mieter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_nachrichten_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
        ]
      }
      zaehlerstand_historie: {
        Row: {
          datum: string
          einheit_id: string | null
          erstellt_am: string | null
          erstellt_von: string | null
          id: string
          immobilie_id: string | null
          quelle: string | null
          stand: number | null
          zaehler_nummer: string | null
          zaehler_typ: string
        }
        Insert: {
          datum: string
          einheit_id?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          immobilie_id?: string | null
          quelle?: string | null
          stand?: number | null
          zaehler_nummer?: string | null
          zaehler_typ: string
        }
        Update: {
          datum?: string
          einheit_id?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          immobilie_id?: string | null
          quelle?: string | null
          stand?: number | null
          zaehler_nummer?: string | null
          zaehler_typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "zaehlerstand_historie_einheit_id_fkey"
            columns: ["einheit_id"]
            isOneToOne: false
            referencedRelation: "einheiten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlerstand_historie_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
        ]
      }
      zahlungen: {
        Row: {
          betrag: number
          buchungsdatum: string
          empfaengername: string | null
          iban: string | null
          id: string
          immobilie_id: string | null
          import_datum: string | null
          kategorie: Database["public"]["Enums"]["zahlkategorien"] | null
          lastschrift_bestaetigt_am: string | null
          mietvertrag_id: string | null
          ruecklastschrift_gebuehr: number | null
          verwendungszweck: string | null
          zugeordneter_monat: string | null
        }
        Insert: {
          betrag?: number
          buchungsdatum: string
          empfaengername?: string | null
          iban?: string | null
          id?: string
          immobilie_id?: string | null
          import_datum?: string | null
          kategorie?: Database["public"]["Enums"]["zahlkategorien"] | null
          lastschrift_bestaetigt_am?: string | null
          mietvertrag_id?: string | null
          ruecklastschrift_gebuehr?: number | null
          verwendungszweck?: string | null
          zugeordneter_monat?: string | null
        }
        Update: {
          betrag?: number
          buchungsdatum?: string
          empfaengername?: string | null
          iban?: string | null
          id?: string
          immobilie_id?: string | null
          import_datum?: string | null
          kategorie?: Database["public"]["Enums"]["zahlkategorien"] | null
          lastschrift_bestaetigt_am?: string | null
          mietvertrag_id?: string | null
          ruecklastschrift_gebuehr?: number | null
          verwendungszweck?: string | null
          zugeordneter_monat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zahlungen_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zahlungen_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertrag"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      aktuelle_marktdaten: {
        Row: {
          abgerufen_am: string | null
          quelle: string | null
          stichtag: string | null
          typ: string | null
          wert: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_zeitanteil: {
        Args: {
          abrechnungs_bis: string
          abrechnungs_von: string
          position_bis: string
          position_von: string
        }
        Returns: number
      }
      calculate_zugeordneter_monat: {
        Args: { buchungsdatum: string }
        Returns: string
      }
      check_and_update_mahnstufen: {
        Args: never
        Returns: {
          alte_mahnstufe: number
          grund: string
          mietvertrag_id: string
          neue_mahnstufe: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search: {
        Args: {
          full_text_weight?: number
          match_count: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          content: string
          dense_rank: number
          fts_rank: number
          id: number
          rrf_score: number
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_hausmeister: { Args: { _user_id: string }; Returns: boolean }
      update_expired_terminated_contracts: { Args: never; Returns: number }
      update_faellige_forderungen: {
        Args: never
        Returns: {
          faelligkeitsdatum: string
          forderung_id: string
          mietvertrag_id: string
          sollbetrag: number
          sollmonat: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "hausmeister"
      einheitentyp:
        | "Wohnung"
        | "Gewerbe"
        | "Stellplatz"
        | "Garage"
        | "Haus (Doppelhaushälfte, Reihenhaus)"
        | "Lager"
        | "Sonstiges"
      kategorie:
        | "Mietvertrag"
        | "Kündigung"
        | "Übergabeprotokoll"
        | "Sonstiges"
        | "Mietkaution"
        | "Mieterunterlagen"
        | "Schriftverkehr"
        | "Versicherungen"
      mieterrolle: "Hauptmieter" | "Zweitmieter" | "Drittmieter"
      mietstatus: "aktiv" | "gekuendigt" | "beendet"
      objekttyp: "Wohnhaus" | "Gewerbe" | "Mischnutzung"
      zahlkategorien:
        | "Miete"
        | "Nichtmiete"
        | "Mietkaution"
        | "Ignorieren"
        | "Rücklastschrift"
        | "Nebenkosten"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "hausmeister"],
      einheitentyp: [
        "Wohnung",
        "Gewerbe",
        "Stellplatz",
        "Garage",
        "Haus (Doppelhaushälfte, Reihenhaus)",
        "Lager",
        "Sonstiges",
      ],
      kategorie: [
        "Mietvertrag",
        "Kündigung",
        "Übergabeprotokoll",
        "Sonstiges",
        "Mietkaution",
        "Mieterunterlagen",
        "Schriftverkehr",
        "Versicherungen",
      ],
      mieterrolle: ["Hauptmieter", "Zweitmieter", "Drittmieter"],
      mietstatus: ["aktiv", "gekuendigt", "beendet"],
      objekttyp: ["Wohnhaus", "Gewerbe", "Mischnutzung"],
      zahlkategorien: [
        "Miete",
        "Nichtmiete",
        "Mietkaution",
        "Ignorieren",
        "Rücklastschrift",
        "Nebenkosten",
      ],
    },
  },
} as const
