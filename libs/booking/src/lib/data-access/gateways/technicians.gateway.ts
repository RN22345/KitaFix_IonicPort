import { Injectable, inject } from '@angular/core';
import { TechnicianOption } from '../../models/catalog.model';
import { BOOKING_CONFIG } from '../config';
import { MOCK_TECHNICIANS } from '../mock/mock-technicians.data';
import { mapPostgrestError } from '../postgrest-errors';
import { getSupabaseClient } from '../supabase-client';

/**
 * Team 2 READS the technician list from Team 1 (Module Plan v4, section 12).
 * We never write to the technicians table.
 *
 * Real query (RLS on technicians must allow authenticated read):
 *   select t.id, p.full_name, t.skills
 *   from technicians t
 *   join profiles p on p.id = t.profile_id
 *   where t.active is true
 *   order by p.full_name;
 */
export abstract class TechniciansGateway {
  abstract listActive(): Promise<TechnicianOption[]>;
}

@Injectable()
export class MockTechniciansGateway extends TechniciansGateway {
  async listActive(): Promise<TechnicianOption[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return MOCK_TECHNICIANS.map((technician) => ({
      ...technician,
      skills: [...technician.skills],
    }));
  }
}

@Injectable()
export class SupabaseTechniciansGateway extends TechniciansGateway {
  private readonly config = inject(BOOKING_CONFIG);

  async listActive(): Promise<TechnicianOption[]> {
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    const { data, error } = await db
      .from('technicians')
      .select('id, profile_id, skills, active, profiles!inner(full_name)')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw mapPostgrestError(error);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      full_name: row.profiles?.full_name ?? 'Unnamed technician',
      skills: row.skills ?? [],
    }));
  }
}
