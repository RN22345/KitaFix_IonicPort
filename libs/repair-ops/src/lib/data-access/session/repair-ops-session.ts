import { Injectable, Signal, inject, signal } from '@angular/core';
import { getSupabaseClient } from '@kitafix/booking';
import { RepairOpsError } from '../../models/repair-ops-error';
import { RepairOpsActor } from '../../models/repair-ops.model';
import { REPAIR_OPS_CONFIG } from '../config';
import { MOCK_TECHNICIAN_ID, MOCK_TECHNICIAN_NAMES } from '../mock/mock-repair-ops.data';
import { mapPostgrestError } from '../postgrest-errors';

/**
 * Who is using the Shop & Repair Operations module (FSD roles SA / TECH).
 *
 * Team 1 owns authentication; this only reads the signed-in profile to decide
 * which buttons to show. The DATABASE (RLS + triggers) is what actually
 * enforces the permissions - hiding a button is never the only protection.
 */
export abstract class RepairOpsSession {
  abstract readonly actor: Signal<RepairOpsActor | null>;
  abstract load(): Promise<RepairOpsActor>;
}

@Injectable()
export class MockRepairOpsSession extends RepairOpsSession {
  private readonly config = inject(REPAIR_OPS_CONFIG);
  readonly actor = signal<RepairOpsActor | null>(null);

  async load(): Promise<RepairOpsActor> {
    const actor: RepairOpsActor =
      this.config.mockRole === 'technician'
        ? {
            id: 'mock-tech',
            full_name: MOCK_TECHNICIAN_NAMES[MOCK_TECHNICIAN_ID],
            role: 'technician',
            technician_id: MOCK_TECHNICIAN_ID,
          }
        : { id: 'mock-admin', full_name: 'Mock Admin', role: 'admin', technician_id: null };
    this.actor.set(actor);
    return actor;
  }
}

@Injectable()
export class SupabaseRepairOpsSession extends RepairOpsSession {
  private readonly config = inject(REPAIR_OPS_CONFIG);
  readonly actor = signal<RepairOpsActor | null>(null);

  async load(): Promise<RepairOpsActor> {
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) {
      throw new RepairOpsError('NOT_ALLOWED', 'You are not signed in.', { cause: authError });
    }

    const { data: profile, error } = await db
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', auth.user.id)
      .single();
    if (error) throw mapPostgrestError(error);

    let actor: RepairOpsActor;
    // 0024: one 'admin' role (staff was merged into admin).
    if (profile.role === 'admin') {
      actor = { id: profile.id, full_name: profile.full_name, role: 'admin', technician_id: null };
    } else if (profile.role === 'technician') {
      const { data: technician, error: techError } = await db
        .from('technicians')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (techError) throw mapPostgrestError(techError);
      if (!technician) {
        throw new RepairOpsError('NOT_ALLOWED', 'Your account is not set up as a technician yet.');
      }
      actor = {
        id: profile.id,
        full_name: profile.full_name,
        role: 'technician',
        technician_id: technician.id,
      };
    } else {
      throw new RepairOpsError('NOT_ALLOWED', 'Repair operations are for admins and technicians only.');
    }

    this.actor.set(actor);
    return actor;
  }
}
