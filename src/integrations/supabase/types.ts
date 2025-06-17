export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      dokumente: {
        Row: {
          dateityp: string | null
          hochgeladen_am: string | null
          id: string
          mietvertrag_id: string | null
          pfad: string | null
          titel: string | null
        }
        Insert: {
          dateityp?: string | null
          hochgeladen_am?: string | null
          id?: string
          mietvertrag_id?: string | null
          pfad?: string | null
          titel?: string | null
        }
        Update: {
          dateityp?: string | null
          hochgeladen_am?: string | null
          id?: string
          mietvertrag_id?: string | null
          pfad?: string | null
          titel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dokumente_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "aktive_mietvertraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dokumente_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertraege"
            referencedColumns: ["id"]
          },
        ]
      }
      einheiten: {
        Row: {
          aktualisiert_am: string | null
          erstellt_am: string | null
          etage: string | null
          id: string
          immobilie_id: string | null
          nummer: string | null
          qm: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          erstellt_am?: string | null
          etage?: string | null
          id?: string
          immobilie_id?: string | null
          nummer?: string | null
          qm?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          erstellt_am?: string | null
          etage?: string | null
          id?: string
          immobilie_id?: string | null
          nummer?: string | null
          qm?: number | null
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
          beschreibung: string | null
          einheiten_anzahl: number
          erstellt_am: string | null
          id: string
          name: string
        }
        Insert: {
          adresse: string
          aktualisiert_am?: string | null
          beschreibung?: string | null
          einheiten_anzahl: number
          erstellt_am?: string | null
          id?: string
          name: string
        }
        Update: {
          adresse?: string
          aktualisiert_am?: string | null
          beschreibung?: string | null
          einheiten_anzahl?: number
          erstellt_am?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      mieter: {
        Row: {
          aktualisiert_am: string | null
          erstellt_am: string | null
          hauptmail: string
          id: string
          Nachname: string | null
          Vorname: string
          weitere_mails: string | null
        }
        Insert: {
          aktualisiert_am?: string | null
          erstellt_am?: string | null
          hauptmail: string
          id?: string
          Nachname?: string | null
          Vorname: string
          weitere_mails?: string | null
        }
        Update: {
          aktualisiert_am?: string | null
          erstellt_am?: string | null
          hauptmail?: string
          id?: string
          Nachname?: string | null
          Vorname?: string
          weitere_mails?: string | null
        }
        Relationships: []
      }
      mietvertraege: {
        Row: {
          aktualisiert_am: string | null
          einheit_id: string | null
          ende_datum: string | null
          erstellt_am: string | null
          id: string
          kaltmiete: number
          start_datum: string
          status: Database["public"]["Enums"]["mietstatus"] | null
          warmmiete: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          einheit_id?: string | null
          ende_datum?: string | null
          erstellt_am?: string | null
          id?: string
          kaltmiete: number
          start_datum: string
          status?: Database["public"]["Enums"]["mietstatus"] | null
          warmmiete?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          einheit_id?: string | null
          ende_datum?: string | null
          erstellt_am?: string | null
          id?: string
          kaltmiete?: number
          start_datum?: string
          status?: Database["public"]["Enums"]["mietstatus"] | null
          warmmiete?: number | null
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
          rolle: Database["public"]["Enums"]["mieterrolle"] | null
        }
        Insert: {
          mieter_id: string
          mietvertrag_id: string
          rolle?: Database["public"]["Enums"]["mieterrolle"] | null
        }
        Update: {
          mieter_id?: string
          mietvertrag_id?: string
          rolle?: Database["public"]["Enums"]["mieterrolle"] | null
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
            referencedRelation: "aktive_mietvertraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mietvertrag_mieter_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertraege"
            referencedColumns: ["id"]
          },
        ]
      }
      mietzahlungen: {
        Row: {
          aktualisiert_am: string | null
          betrag: number
          bezahlt_am: string | null
          erstellt_am: string | null
          id: string
          mietvertrag_id: string | null
          monat: string
        }
        Insert: {
          aktualisiert_am?: string | null
          betrag: number
          bezahlt_am?: string | null
          erstellt_am?: string | null
          id?: string
          mietvertrag_id?: string | null
          monat: string
        }
        Update: {
          aktualisiert_am?: string | null
          betrag?: number
          bezahlt_am?: string | null
          erstellt_am?: string | null
          id?: string
          mietvertrag_id?: string | null
          monat?: string
        }
        Relationships: [
          {
            foreignKeyName: "mietzahlungen_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "aktive_mietvertraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mietzahlungen_mietvertrag_id_fkey"
            columns: ["mietvertrag_id"]
            isOneToOne: false
            referencedRelation: "mietvertraege"
            referencedColumns: ["id"]
          },
        ]
      }
      "niimmo chat history": {
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
    }
    Views: {
      aktive_mietvertraege: {
        Row: {
          aktualisiert_am: string | null
          einheit_id: string | null
          ende_datum: string | null
          erstellt_am: string | null
          id: string | null
          immobilie_id: string | null
          kaltmiete: number | null
          mieter_name: string | null
          nummer: string | null
          start_datum: string | null
          status: Database["public"]["Enums"]["mietstatus"] | null
        }
        Relationships: [
          {
            foreignKeyName: "einheiten_immobilie_id_fkey"
            columns: ["immobilie_id"]
            isOneToOne: false
            referencedRelation: "immobilien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mietvertraege_einheit_id_fkey"
            columns: ["einheit_id"]
            isOneToOne: false
            referencedRelation: "einheiten"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      mieterrolle: "Hauptmieter" | "Zweitmieter" | "Drittmieter"
      mietstatus: "aktiv" | "gekündigt" | "beendet"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      mieterrolle: ["Hauptmieter", "Zweitmieter", "Drittmieter"],
      mietstatus: ["aktiv", "gekündigt", "beendet"],
    },
  },
} as const
