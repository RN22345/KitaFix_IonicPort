/**
 * =============================================================================
 * PLACEHOLDER for the generated Supabase types.
 * =============================================================================
 * This file mirrors what `supabase gen types typescript` will produce after the
 * Team 2 migration (0020_team2_booking.sql) and the other teams' migrations run.
 *
 * THIS FILE IS THE TEAM CONTRACT (Module Plan v4, rule R4).
 * Table columns and enum values may only change with a group agreement.
 *
 * HOW TO REPLACE IT WITH THE REAL FILE (after `supabase start`):
 *
 *   npx supabase gen types typescript --local > libs/shared-types/src/lib/database.types.ts
 *
 * Then rebuild. The booking code does not change because it only uses the
 * exported type names below.
 *
 * NOTE: everything below uses `type` aliases (not `interface`) exactly like the
 * generator. supabase-js only infers table types from object-literal alias
 * types - switching these to interfaces silently turns every row type into
 * `never`.
 *
 * Owners (Module Plan v4, section 5):
 *   profiles            Team 1
 *   technicians         Team 1
 *   services            Team 3
 *   repairs             Team 2 (booking columns) + Team 3 (workflow columns)
 *   v_* views           Team 4 (not needed by Team 2, omitted here)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Frozen enum owned by Team 3 (status workflow). Rule R8: never invent strings. */
export type RepairStatus = 'pending' | 'in_progress' | 'testing' | 'completed' | 'cancelled';

/** Frozen enum owned by Team 1 (identity). */
export type UserRole = 'customer' | 'technician' | 'staff' | 'admin';

/* -------------------------------------------------------------------------- */
/* Team 1 - Identity & People                                                 */
/* -------------------------------------------------------------------------- */

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  full_name?: string;
  phone?: string | null;
  role?: UserRole;
  active?: boolean;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = Partial<ProfileInsert>;

export type TechnicianRow = {
  id: string;
  profile_id: string;
  skills: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TechnicianInsert = {
  id?: string;
  profile_id: string;
  skills?: string[];
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TechnicianUpdate = Partial<TechnicianInsert>;

/* -------------------------------------------------------------------------- */
/* Team 3 - Shop & Repair Operations                                          */
/* -------------------------------------------------------------------------- */

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceInsert = {
  id?: string;
  name: string;
  description?: string | null;
  base_price?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ServiceUpdate = Partial<ServiceInsert>;

/* -------------------------------------------------------------------------- */
/* Team 2 (booking columns) + Team 3 (workflow columns)                       */
/* -------------------------------------------------------------------------- */

export type RepairRow = {
  id: string;

  /* ---- booking columns (Team 2) ---- */
  customer_id: string;
  service_id: string;
  device_brand: string;
  device_model: string;
  location: string;
  /** ISO date, e.g. "2026-09-22". */
  booking_date: string;
  /** Postgres time, e.g. "10:00:00". */
  booking_time: string;
  issue_screen: boolean;
  issue_battery: boolean;
  issue_charging: boolean;
  issue_camera: boolean;
  issue_audio: boolean;
  issue_software: boolean;

  /* ---- workflow columns (Team 3, frozen contract) ---- */
  technician_id: string | null;
  status: RepairStatus;
  staff_notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;

  created_at: string;
  updated_at: string;
};

export type RepairInsert = {
  id?: string;

  /* booking columns (Team 2 writes these) */
  customer_id: string;
  service_id: string;
  device_brand: string;
  device_model: string;
  location: string;
  booking_date: string;
  booking_time: string;
  issue_screen?: boolean;
  issue_battery?: boolean;
  issue_charging?: boolean;
  issue_camera?: boolean;
  issue_audio?: boolean;
  issue_software?: boolean;

  /* workflow columns (Team 3 writes these after creation) */
  technician_id?: string | null;
  status?: RepairStatus;
  staff_notes?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;

  created_at?: string;
  updated_at?: string;
};

export type RepairUpdate = Partial<RepairInsert>;

/* -------------------------------------------------------------------------- */
/* Database                                                                   */
/* -------------------------------------------------------------------------- */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      technicians: {
        Row: TechnicianRow;
        Insert: TechnicianInsert;
        Update: TechnicianUpdate;
        Relationships: [
          {
            foreignKeyName: 'technicians_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: ServiceRow;
        Insert: ServiceInsert;
        Update: ServiceUpdate;
        Relationships: [];
      };
      repairs: {
        Row: RepairRow;
        Insert: RepairInsert;
        Update: RepairUpdate;
        Relationships: [
          {
            foreignKeyName: 'repairs_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'repairs_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'repairs_technician_id_fkey';
            columns: ['technician_id'];
            isOneToOne: false;
            referencedRelation: 'technicians';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** Team 2: available hour slots are the ones NOT in this list. */
      get_taken_slots: {
        Args: {
          p_location: string;
          p_date: string;
          p_exclude_repair?: string | null;
        };
        Returns: { booking_time: string }[];
      };
      /** Team 1 RLS helper. */
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      /** Team 1 RLS helper. */
      my_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      /** Team 1 RLS helper. */
      current_user_no: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      repair_status: RepairStatus;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
