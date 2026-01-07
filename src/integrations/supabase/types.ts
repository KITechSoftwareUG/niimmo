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
          allgemein_gas_stand: number | null
          allgemein_gas_zaehler: string | null
          allgemein_strom_datum: string | null
          allgemein_strom_stand: number | null
          allgemein_strom_zaehler: string | null
          allgemein_wasser_datum: string | null
          allgemein_wasser_stand: number | null
          allgemein_wasser_zaehler: string | null
          Annuität: number | null
          baujahr: number | null
          beschreibung: string | null
          einheiten_anzahl: number
          erstellt_am: string | null
          id: string
          kaufpreis: number | null
          "Kontonr.": string | null
          name: string
          objekttyp: Database["public"]["Enums"]["objekttyp"] | null
          restschuld: number | null
        }
        Insert: {
          adresse: string
          aktualisiert_am?: string | null
          allgemein_gas_datum?: string | null
          allgemein_gas_stand?: number | null
          allgemein_gas_zaehler?: string | null
          allgemein_strom_datum?: string | null
          allgemein_strom_stand?: number | null
          allgemein_strom_zaehler?: string | null
          allgemein_wasser_datum?: string | null
          allgemein_wasser_stand?: number | null
          allgemein_wasser_zaehler?: string | null
          Annuität?: number | null
          baujahr?: number | null
          beschreibung?: string | null
          einheiten_anzahl: number
          erstellt_am?: string | null
          id?: string
          kaufpreis?: number | null
          "Kontonr."?: string | null
          name: string
          objekttyp?: Database["public"]["Enums"]["objekttyp"] | null
          restschuld?: number | null
        }
        Update: {
          adresse?: string
          aktualisiert_am?: string | null
          allgemein_gas_datum?: string | null
          allgemein_gas_stand?: number | null
          allgemein_gas_zaehler?: string | null
          allgemein_strom_datum?: string | null
          allgemein_strom_stand?: number | null
          allgemein_strom_zaehler?: string | null
          allgemein_wasser_datum?: string | null
          allgemein_wasser_stand?: number | null
          allgemein_wasser_zaehler?: string | null
          Annuität?: number | null
          baujahr?: number | null
          beschreibung?: string | null
          einheiten_anzahl?: number
          erstellt_am?: string | null
          id?: string
          kaufpreis?: number | null
          "Kontonr."?: string | null
          name?: string
          objekttyp?: Database["public"]["Enums"]["objekttyp"] | null
          restschuld?: number | null
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
          bankkonto_mieter: string | null
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
          bankkonto_mieter?: string | null
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
          bankkonto_mieter?: string | null
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
      [_ in never]: never
    }
    Functions: {
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
      mieterrolle: "Hauptmieter" | "Zweitmieter" | "Drittmieter"
      mietstatus: "aktiv" | "gekuendigt" | "beendet"
      objekttyp: "Wohnhaus" | "Gewerbe" | "Mischnutzung"
      zahlkategorien:
        | "Miete"
        | "Nichtmiete"
        | "Mietkaution"
        | "Ignorieren"
        | "Rücklastschrift"
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
      ],
    },
  },
} as const
