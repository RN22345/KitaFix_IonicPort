import { InjectionToken } from '@angular/core';

/** What libs/repair-ops needs from the host app (same idea as BOOKING_CONFIG). */
export interface RepairOpsConfig {
  /** true -> in-memory .ts data (offline demo). false -> real Supabase. */
  useMockData: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  currency: string;
  /**
   * Offline demo only (useMockData: true): which role the placeholder session
   * has. 'staff' (default) sees everything; 'technician' sees only their own
   * jobs, can add notes and service logs, and cannot change anything else.
   */
  mockRole?: 'staff' | 'technician';
}

export const REPAIR_OPS_CONFIG = new InjectionToken<RepairOpsConfig>('REPAIR_OPS_CONFIG');
