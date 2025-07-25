export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          fts: unknown | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          fts?: unknown | null
          id?: never
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          fts?: unknown | null
          id?: never
          metadata?: Json | null
        }
        Relationships: []
      }
      dokumente: {
        Row: {
          dateityp: string | null
          erstellt_von: string | null
          groesse_bytes: number | null
          hochgeladen_am: string | null
          id: string
          kategorie: Database["public"]["Enums"]["kategorie"] | null
          mietvertrag_id: string
          pfad: string | null
          titel: string | null
        }
        Insert: {
          dateityp?: string | null
          erstellt_von?: string | null
          groesse_bytes?: number | null
          hochgeladen_am?: string | null
          id?: string
          kategorie?: Database["public"]["Enums"]["kategorie"] | null
          mietvertrag_id: string
          pfad?: string | null
          titel?: string | null
        }
        Update: {
          dateityp?: string | null
          erstellt_von?: string | null
          groesse_bytes?: number | null
          hochgeladen_am?: string | null
          id?: string
          kategorie?: Database["public"]["Enums"]["kategorie"] | null
          mietvertrag_id?: string
          pfad?: string | null
          titel?: string | null
        }
        Relationships: [
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
      dokumente_embeddings: {
        Row: {
          dokument_id: string | null
          embedding: string | null
          text: string | null
        }
        Insert: {
          dokument_id?: string | null
          embedding?: string | null
          text?: string | null
        }
        Update: {
          dokument_id?: string | null
          embedding?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dokumente_embeddings_dokument_id_fkey"
            columns: ["dokument_id"]
            isOneToOne: false
            referencedRelation: "dokumente"
            referencedColumns: ["id"]
          },
        ]
      }
      einheiten: {
        Row: {
          aktualisiert_am: string | null
          einheitentyp: Database["public"]["Enums"]["einheitentyp"] | null
          erstellt_am: string | null
          etage: string | null
          id: string
          immobilie_id: string | null
          qm: number | null
          zaehler: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          einheitentyp?: Database["public"]["Enums"]["einheitentyp"] | null
          erstellt_am?: string | null
          etage?: string | null
          id?: string
          immobilie_id?: string | null
          qm?: number | null
          zaehler?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          einheitentyp?: Database["public"]["Enums"]["einheitentyp"] | null
          erstellt_am?: string | null
          etage?: string | null
          id?: string
          immobilie_id?: string | null
          qm?: number | null
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
          Annuität: number | null
          baujahr: number | null
          beschreibung: string | null
          einheiten_anzahl: number
          erstellt_am: string | null
          id: string
          "Kontonr.": number | null
          name: string
          objekttyp: Database["public"]["Enums"]["objekttyp"] | null
        }
        Insert: {
          adresse: string
          aktualisiert_am?: string | null
          Annuität?: number | null
          baujahr?: number | null
          beschreibung?: string | null
          einheiten_anzahl: number
          erstellt_am?: string | null
          id?: string
          "Kontonr."?: number | null
          name: string
          objekttyp?: Database["public"]["Enums"]["objekttyp"] | null
        }
        Update: {
          adresse?: string
          aktualisiert_am?: string | null
          Annuität?: number | null
          baujahr?: number | null
          beschreibung?: string | null
          einheiten_anzahl?: number
          erstellt_am?: string | null
          id?: string
          "Kontonr."?: number | null
          name?: string
          objekttyp?: Database["public"]["Enums"]["objekttyp"] | null
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
          id: string
          mietvertrag_id: string | null
          sollbetrag: number | null
          sollmonat: string
        }
        Insert: {
          erzeugt_am?: string | null
          id?: string
          mietvertrag_id?: string | null
          sollbetrag?: number | null
          sollmonat: string
        }
        Update: {
          erzeugt_am?: string | null
          id?: string
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
          id: string
          kaltmiete: number | null
          kaution_betrag: number | null
          kuendigungsdatum: string | null
          lastschrift: boolean
          start_datum: string | null
          status: Database["public"]["Enums"]["mietstatus"] | null
          verwendungszweck: string[] | null
          weitere_bankkonten: string | null
        }
        Insert: {
          aktualisiert_am?: string | null
          bankkonto_mieter?: string | null
          betriebskosten?: number | null
          einheit_id: string
          ende_datum?: string | null
          erstellt_am?: string | null
          id?: string
          kaltmiete?: number | null
          kaution_betrag?: number | null
          kuendigungsdatum?: string | null
          lastschrift?: boolean
          start_datum?: string | null
          status?: Database["public"]["Enums"]["mietstatus"] | null
          verwendungszweck?: string[] | null
          weitere_bankkonten?: string | null
        }
        Update: {
          aktualisiert_am?: string | null
          bankkonto_mieter?: string | null
          betriebskosten?: number | null
          einheit_id?: string
          ende_datum?: string | null
          erstellt_am?: string | null
          id?: string
          kaltmiete?: number | null
          kaution_betrag?: number | null
          kuendigungsdatum?: string | null
          lastschrift?: boolean
          start_datum?: string | null
          status?: Database["public"]["Enums"]["mietstatus"] | null
          verwendungszweck?: string[] | null
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
          hinweis: string | null
          mieter_id: string
          mietvertrag_id: string
          rolle: string | null
        }
        Insert: {
          hinweis?: string | null
          mieter_id: string
          mietvertrag_id: string
          rolle?: string | null
        }
        Update: {
          hinweis?: string | null
          mieter_id?: string
          mietvertrag_id?: string
          rolle?: string | null
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
      zahlungen: {
        Row: {
          betrag: number
          buchungsdatum: string
          empfaengername: string | null
          iban: string | null
          id: string
          import_datum: string | null
          kategorie: Database["public"]["Enums"]["zahlkategorien"] | null
          mietvertrag_id: string | null
          verwendungszweck: string | null
        }
        Insert: {
          betrag?: number
          buchungsdatum: string
          empfaengername?: string | null
          iban?: string | null
          id?: string
          import_datum?: string | null
          kategorie?: Database["public"]["Enums"]["zahlkategorien"] | null
          mietvertrag_id?: string | null
          verwendungszweck?: string | null
        }
        Update: {
          betrag?: number
          buchungsdatum?: string
          empfaengername?: string | null
          iban?: string | null
          id?: string
          import_datum?: string | null
          kategorie?: Database["public"]["Enums"]["zahlkategorien"] | null
          mietvertrag_id?: string | null
          verwendungszweck?: string | null
        }
        Relationships: [
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
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      hybrid_search: {
        Args: {
          query_text: string
          query_embedding: string
          match_count: number
          full_text_weight?: number
          semantic_weight?: number
          rrf_k?: number
        }
        Returns: {
          id: number
          content: string
          fts_rank: number
          dense_rank: number
          rrf_score: number
        }[]
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      einheitentyp:
        | "Wohnung"
        | "Gewerbe"
        | "Stellplatz"
        | "Garage"
        | "Haus (Doppelhaushälfte, Reihenhaus)"
        | "Lager"
        | "Sonstiges"
      kategorie: "Mietvertrag" | "Kündigung" | "Übergabeprotokoll" | "Sonstiges"
      mieterrolle: "Hauptmieter" | "Zweitmieter" | "Drittmieter"
      mietstatus: "aktiv" | "gekuendigt" | "beendet"
      objekttyp: "Wohnhaus" | "Gewerbe" | "Mischnutzung"
      zahlkategorien: "Miete (komplett)" | "Miete (unklar)" | "Nichtmiete"
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
      einheitentyp: [
        "Wohnung",
        "Gewerbe",
        "Stellplatz",
        "Garage",
        "Haus (Doppelhaushälfte, Reihenhaus)",
        "Lager",
        "Sonstiges",
      ],
      kategorie: ["Mietvertrag", "Kündigung", "Übergabeprotokoll", "Sonstiges"],
      mieterrolle: ["Hauptmieter", "Zweitmieter", "Drittmieter"],
      mietstatus: ["aktiv", "gekuendigt", "beendet"],
      objekttyp: ["Wohnhaus", "Gewerbe", "Mischnutzung"],
      zahlkategorien: ["Miete (komplett)", "Miete (unklar)", "Nichtmiete"],
    },
  },
} as const
