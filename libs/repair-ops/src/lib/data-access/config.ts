import { InjectionToken } from '@angular/core';

/** What libs/repair-ops needs from the host app (same idea as BOOKING_CONFIG). */
export interface RepairOpsConfig {
  /** true -> in-memory .ts data (offline demo). false -> real Supabase. */
  useMockData: boolean;
  /** Development-only staff UI preview using mock data. */
  staffPreviewMode?: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  currency: string;
}

export const REPAIR_OPS_CONFIG = new InjectionToken<RepairOpsConfig>('REPAIR_OPS_CONFIG');
