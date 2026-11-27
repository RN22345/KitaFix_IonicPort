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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          account_no: string | null
          active: boolean
          address: string | null
          avatar_url: string | null
          birthday: string | null
          contact_no: string | null
          created_at: string
          first_name: string | null
          full_name: string
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          account_no?: string | null
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          contact_no?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string
          gender?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          account_no?: string | null
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          contact_no?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      repair_ops_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          event_type: string
          id: string
          new_booking_date: string | null
          new_booking_time: string | null
          new_status: Database["public"]["Enums"]["repair_status"] | null
          new_technician_id: string | null
          note: string | null
          previous_booking_date: string | null
          previous_booking_time: string | null
          previous_status: Database["public"]["Enums"]["repair_status"] | null
          previous_technician_id: string | null
          remarks: string | null
          repair_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          event_type: string
          id?: string
          new_booking_date?: string | null
          new_booking_time?: string | null
          new_status?: Database["public"]["Enums"]["repair_status"] | null
          new_technician_id?: string | null
          note?: string | null
          previous_booking_date?: string | null
          previous_booking_time?: string | null
          previous_status?: Database["public"]["Enums"]["repair_status"] | null
          previous_technician_id?: string | null
          remarks?: string | null
          repair_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          event_type?: string
          id?: string
          new_booking_date?: string | null
          new_booking_time?: string | null
          new_status?: Database["public"]["Enums"]["repair_status"] | null
          new_technician_id?: string | null
          note?: string | null
          previous_booking_date?: string | null
          previous_booking_time?: string | null
          previous_status?: Database["public"]["Enums"]["repair_status"] | null
          previous_technician_id?: string | null
          remarks?: string | null
          repair_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_ops_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_ops_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_ops_history_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_service_logs: {
        Row: {
          action_type: string
          created_at: string
          details: string
          id: string
          location: string
          logged_by: string | null
          performed_at: string
          repair_id: string
          technician_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details: string
          id?: string
          location: string
          logged_by?: string | null
          performed_at?: string
          repair_id: string
          technician_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: string
          id?: string
          location?: string
          logged_by?: string | null
          performed_at?: string
          repair_id?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_service_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_service_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_service_logs_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_service_logs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_service_logs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "v_technician_performance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      repairs: {
        Row: {
          booking_date: string
          booking_slot: unknown
          booking_time: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string
          device_brand: string
          device_model: string
          id: string
          issue_audio: boolean
          issue_battery: boolean
          issue_camera: boolean
          issue_charging: boolean
          issue_description: string | null
          issue_screen: boolean
          issue_software: boolean
          location: string
          repair_started_at: string | null
          service_id: string
          service_name_snapshot: string | null
          service_price_snapshot: number | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["repair_status"]
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          booking_date: string
          booking_slot?: unknown
          booking_time: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id: string
          device_brand: string
          device_model: string
          id?: string
          issue_audio?: boolean
          issue_battery?: boolean
          issue_camera?: boolean
          issue_charging?: boolean
          issue_description?: string | null
          issue_screen?: boolean
          issue_software?: boolean
          location: string
          repair_started_at?: string | null
          service_id: string
          service_name_snapshot?: string | null
          service_price_snapshot?: number | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_date?: string
          booking_slot?: unknown
          booking_time?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string
          device_brand?: string
          device_model?: string
          id?: string
          issue_audio?: boolean
          issue_battery?: boolean
          issue_camera?: boolean
          issue_charging?: boolean
          issue_description?: string | null
          issue_screen?: boolean
          issue_software?: boolean
          location?: string
          repair_started_at?: string | null
          service_id?: string
          service_name_snapshot?: string | null
          service_price_snapshot?: number | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repairs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "v_technician_performance"
            referencedColumns: ["technician_id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          rating: number
          repair_id: string
          replied_at: string | null
          replied_by: string | null
          reply_text: string | null
          review_id: string | null
          review_no: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          rating: number
          repair_id: string
          replied_at?: string | null
          replied_by?: string | null
          reply_text?: string | null
          review_id?: string | null
          review_no?: never
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          rating?: number
          repair_id?: string
          replied_at?: string | null
          replied_by?: string | null
          reply_text?: string | null
          review_id?: string | null
          review_no?: never
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: true
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          active: boolean
          created_at: string
          id: string
          profile_id: string
          skills: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          profile_id: string
          skills?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          profile_id?: string
          skills?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technicians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_profile: {
        Row: {
          account_no: string | null
          active: boolean | null
          address: string | null
          avatar_url: string | null
          birthday: string | null
          contact_no: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
        }
        Insert: {
          account_no?: string | null
          active?: boolean | null
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          contact_no?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
        }
        Update: {
          account_no?: string | null
          active?: boolean | null
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          contact_no?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      repair_status_events: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string | null
          new_status: Database["public"]["Enums"]["repair_status"] | null
          previous_status: Database["public"]["Enums"]["repair_status"] | null
          remarks: string | null
          repair_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string | null
          new_status?: Database["public"]["Enums"]["repair_status"] | null
          previous_status?: Database["public"]["Enums"]["repair_status"] | null
          remarks?: string | null
          repair_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string | null
          new_status?: Database["public"]["Enums"]["repair_status"] | null
          previous_status?: Database["public"]["Enums"]["repair_status"] | null
          remarks?: string | null
          repair_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_ops_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_ops_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_ops_history_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_repair_status_summary: {
        Row: {
          repair_count: number | null
          status: Database["public"]["Enums"]["repair_status"] | null
        }
        Relationships: []
      }
      v_review_summary: {
        Row: {
          average_rating: number | null
          star_1: number | null
          star_2: number | null
          star_3: number | null
          star_4: number | null
          star_5: number | null
          total_reviews: number | null
        }
        Relationships: []
      }
      v_technician_performance: {
        Row: {
          average_rating: number | null
          completed_repairs: number | null
          review_count: number | null
          technician_id: string | null
          technician_name: string | null
          total_repairs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_assign_account_role: {
        Args: {
          account_id: string
          new_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      admin_read_accounts: {
        Args: { account_id?: string }
        Returns: {
          account_no: string
          active: boolean
          address: string
          avatar_url: string
          birthday: string
          contact_no: string
          email: string
          first_name: string
          full_name: string
          gender: string
          id: string
          joined_at: string
          last_name: string
          profile_exists: boolean
          role: string
        }[]
      }
      admin_set_account_active: {
        Args: { account_id: string; new_active: boolean }
        Returns: boolean
      }
      current_user_no: { Args: never; Returns: string }
      deactivate_own_account: { Args: never; Returns: boolean }
      generate_account_no: { Args: { for_date?: string }; Returns: string }
      get_public_reviews: {
        Args: { p_limit?: number }
        Returns: {
          comment: string
          created_at: string
          id: string
          rating: number
          replied_at: string
          reply_text: string
          service_name: string
          technician_name: string
        }[]
      }
      get_taken_slots: {
        Args: { p_date: string; p_exclude_repair?: string; p_location: string }
        Returns: {
          booking_time: string
        }[]
      }
      get_technician_ratings: {
        Args: never
        Returns: {
          average_rating: number
          review_count: number
          technician_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      profile_is_my_repair_customer: {
        Args: { p_profile: string }
        Returns: boolean
      }
      record_terms_acceptance: {
        Args: { accepted_version: string }
        Returns: string
      }
      t3_can_log_service: {
        Args: { p_repair_id: string; p_technician_id: string }
        Returns: boolean
      }
      t3_is_assigned_technician: {
        Args: { p_repair_id: string }
        Returns: boolean
      }
      t3_update_repair_status: {
        Args: {
          p_remarks?: string
          p_repair_id: string
          p_status: Database["public"]["Enums"]["repair_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      repair_status:
        | "pending"
        | "in_progress"
        | "testing"
        | "completed"
        | "cancelled"
      user_role: "customer" | "technician" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      repair_status: [
        "pending",
        "in_progress",
        "testing",
        "completed",
        "cancelled",
      ],
      user_role: ["customer", "technician", "admin"],
    },
  },
} as const
