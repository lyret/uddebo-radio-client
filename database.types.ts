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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcast_programs: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          edited_at: string | null
          edited_by: string | null
          id: string
          is_active: boolean
          recordings: Json
          start_time: string | null
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          is_active?: boolean
          recordings?: Json
          start_time?: string | null
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          is_active?: boolean
          recordings?: Json
          start_time?: string | null
          title?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          author: string | null
          captions_url: string | null
          cover_url: string | null
          description: string | null
          duration: number
          edited_at: string | null
          edited_by: string | null
          file_size: number
          file_url: string
          id: string
          link_out_url: string | null
          okey_at: string | null
          okey_by: string | null
          title: string | null
          type: Database["public"]["Enums"]["recording_type"]
          uploaded_at: string
          uploaded_by: string | null
          uploaded_filename: string
        }
        Insert: {
          author?: string | null
          captions_url?: string | null
          cover_url?: string | null
          description?: string | null
          duration: number
          edited_at?: string | null
          edited_by?: string | null
          file_size: number
          file_url: string
          id?: string
          link_out_url?: string | null
          okey_at?: string | null
          okey_by?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["recording_type"]
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_filename: string
        }
        Update: {
          author?: string | null
          captions_url?: string | null
          cover_url?: string | null
          description?: string | null
          duration?: number
          edited_at?: string | null
          edited_by?: string | null
          file_size?: number
          file_url?: string
          id?: string
          link_out_url?: string | null
          okey_at?: string | null
          okey_by?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["recording_type"]
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_filename?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_user: { Args: { p_uid: string }; Returns: boolean }
    }
    Enums: {
      recording_type:
        | "unknown"
        | "jingle"
        | "poetry"
        | "music"
        | "news"
        | "commentary"
        | "talk"
        | "comedy"
        | "talkshow"
        | "interview"
        | "other"
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
      recording_type: [
        "unknown",
        "jingle",
        "poetry",
        "music",
        "news",
        "commentary",
        "talk",
        "comedy",
        "talkshow",
        "interview",
        "other",
      ],
    },
  },
} as const
