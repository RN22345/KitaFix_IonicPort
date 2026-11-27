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
          active: boolean
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "profiles"
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
        ]
      }
      repair_ops_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          event_type: "note" | "schedule" | "status" | "technician"
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
          event_type: "note" | "schedule" | "status" | "technician"
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
          event_type?: "note" | "schedule" | "status" | "technician"
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
          action_type: "diagnosis" | "inspection" | "other" | "repair" | "testing"
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
          action_type: "diagnosis" | "inspection" | "other" | "repair" | "testing"
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
          action_type?: "diagnosis" | "inspection" | "other" | "repair" | "testing"
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
        Relationships: []
      }
    }
    Functions: {
      current_user_no: { Args: never; Returns: string }
      get_taken_slots: {
        Args: { p_date: string; p_exclude_repair?: string; p_location: string }
        Returns: {
          booking_time: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      set_user_active: {
        Args: { is_active: boolean; target: string }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          target: string
        }
        Returns: undefined
      }
      t3_can_log_service: {
        Args: { p_repair_id: string; p_technician_id: string }
        Returns: boolean
      }
      t3_is_assigned_technician: { Args: { p_repair_id: string }; Returns: boolean }
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
