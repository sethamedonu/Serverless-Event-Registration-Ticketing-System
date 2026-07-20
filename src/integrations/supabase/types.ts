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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      event_settings: {
        Row: {
          accent_color: string
          badge_font_size: number
          badge_layout: string
          event_date: string | null
          event_name: string
          id: number
          logo_url: string | null
          primary_color: string
          registration_open: boolean
          show_qr: boolean
          show_registration_number: boolean
          updated_at: string
          venue: string | null
        }
        Insert: {
          accent_color?: string
          badge_font_size?: number
          badge_layout?: string
          event_date?: string | null
          event_name?: string
          id?: number
          logo_url?: string | null
          primary_color?: string
          registration_open?: boolean
          show_qr?: boolean
          show_registration_number?: boolean
          updated_at?: string
          venue?: string | null
        }
        Update: {
          accent_color?: string
          badge_font_size?: number
          badge_layout?: string
          event_date?: string | null
          event_name?: string
          id?: number
          logo_url?: string | null
          primary_color?: string
          registration_open?: boolean
          show_qr?: boolean
          show_registration_number?: boolean
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          badge_print_count: number
          badge_printed_at: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          organisation: string
          phone: string | null
          position: string | null
          registration_number: string
          registration_type: Database["public"]["Enums"]["registration_type"]
          updated_at: string
        }
        Insert: {
          badge_print_count?: number
          badge_printed_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          organisation: string
          phone?: string | null
          position?: string | null
          registration_number?: string
          registration_type?: Database["public"]["Enums"]["registration_type"]
          updated_at?: string
        }
        Update: {
          badge_print_count?: number
          badge_printed_at?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          organisation?: string
          phone?: string | null
          position?: string | null
          registration_number?: string
          registration_type?: Database["public"]["Enums"]["registration_type"]
          updated_at?: string
        }
        Relationships: []
      }
      signup_settings: {
        Row: {
          id: number
          token: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          token?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          token?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string
          disabled: boolean
          display_name: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          display_name: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_event_settings: {
        Args: never
        Returns: {
          accent_color: string
          badge_font_size: number
          badge_layout: string
          event_date: string
          event_name: string
          id: number
          logo_url: string
          primary_color: string
          registration_open: boolean
          show_qr: boolean
          show_registration_number: boolean
          venue: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      register_participant: {
        Args: {
          _email: string
          _full_name: string
          _organisation: string
          _phone: string
          _position: string
        }
        Returns: {
          id: string
          registration_number: string
        }[]
      }
      registration_is_open: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "registration_officer" | "checkin_officer"
      registration_type: "online" | "walk_in"
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
      app_role: ["admin", "registration_officer", "checkin_officer"],
      registration_type: ["online", "walk_in"],
    },
  },
} as const
