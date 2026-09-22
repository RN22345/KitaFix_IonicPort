import { Injectable, inject } from '@angular/core';
import { ServiceOption } from '../../models/catalog.model';
import { BOOKING_CONFIG } from '../config';
import { MOCK_SERVICES } from '../mock/mock-services.data';
import { mapPostgrestError } from '../postgrest-errors';
import { getSupabaseClient } from '../supabase-client';

/**
 * Team 2 READS the service menu (name + price) from Team 3
 * (Module Plan v4, section 12). We never write to the services table.
 *
 * Real query (RLS on services must allow authenticated read):
 *   select id, name, description, base_price
 *   from services
 *   where active is true
 *   order by name;
 */
export abstract class ServicesGateway {
  abstract listActive(): Promise<ServiceOption[]>;
}

@Injectable()
export class MockServicesGateway extends ServicesGateway {
  async listActive(): Promise<ServiceOption[]> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return MOCK_SERVICES.map((service) => ({ ...service }));
  }
}

@Injectable()
export class SupabaseServicesGateway extends ServicesGateway {
  private readonly config = inject(BOOKING_CONFIG);

  async listActive(): Promise<ServiceOption[]> {
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    const { data, error } = await db
      .from('services')
      .select('id, name, description, base_price')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      throw mapPostgrestError(error);
    }
    return data ?? [];
  }
}
