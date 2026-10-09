import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Repair } from '../models/repair.model';
import { BOOKING_CONFIG } from '../data-access/config';
import { getSupabaseClient } from '../data-access/supabase-client';

/**
 * Recommended feature: live status update on the customer screen
 * (Supabase Realtime, Module Plan v4).
 *
 * The status column belongs to Team 3. When they change it in the staff app,
 * this channel pushes the new row to the customer screen.
 *
 * In mock mode this is a no-op: the in-memory data does not push changes.
 * The migration adds the table to the supabase_realtime publication.
 */
@Injectable({ providedIn: 'root' })
export class RepairsRealtimeService {
  private readonly config = inject(BOOKING_CONFIG);
  private channel: RealtimeChannel | null = null;

  watchCustomer(
    customerId: string,
    onChange: (repair: Repair) => void,
    onDelete?: (repairId: string) => void,
  ): void {
    if (this.config.useMockData) {
      return;
    }

    this.stop();
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    this.channel = db
      .channel(`repairs-customer-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          // A DELETE only carries the primary key in `old`; never treat it as a full row.
          if (payload.eventType === 'DELETE') {
            const removedId = (payload.old as { id?: string } | null)?.id;
            if (removedId) {
              onDelete?.(removedId);
            }
            return;
          }
          const row = payload.new as unknown as Repair;
          if (row?.id) {
            onChange(row);
          }
        },
      )
      .subscribe();
  }

  stop(): void {
    void this.channel?.unsubscribe();
    this.channel = null;
  }
}
