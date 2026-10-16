import { Injectable, inject } from '@angular/core';
import { getSupabaseClient } from '@kitafix/booking';
import { RepairOpsError } from '../models/repair-ops-error';
import { ServiceInput, ServiceItem } from '../models/repair-ops.model';
import { REPAIR_OPS_CONFIG } from './config';
import { MOCK_SERVICE_ITEMS } from './mock/mock-repair-ops.data';
import { mapPostgrestError } from './postgrest-errors';

/** Team 3 owns the `services` table (shop menu + prices). */
export abstract class ServiceCatalogRepository {
  abstract list(): Promise<ServiceItem[]>;
  abstract add(input: ServiceInput): Promise<ServiceItem>;
  abstract update(id: string, input: ServiceInput): Promise<ServiceItem>;
  abstract setActive(id: string, active: boolean): Promise<ServiceItem>;
}

@Injectable()
export class MockServiceCatalogRepository extends ServiceCatalogRepository {
  private rows: ServiceItem[] = MOCK_SERVICE_ITEMS.map((s) => ({ ...s }));

  private async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  private assertUniqueName(name: string, ignoreId?: string): void {
    const clash = this.rows.some(
      (s) => s.id !== ignoreId && s.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (clash) throw new RepairOpsError('INVALID_INPUT', 'A service with that name already exists.');
  }

  async list(): Promise<ServiceItem[]> {
    await this.delay();
    return this.rows.map((s) => ({ ...s }));
  }

  async add(input: ServiceInput): Promise<ServiceItem> {
    await this.delay();
    this.assertUniqueName(input.name);
    const now = new Date().toISOString();
    const row: ServiceItem = { id: crypto.randomUUID(), ...input, name: input.name.trim(), created_at: now, updated_at: now };
    this.rows = [...this.rows, row];
    return { ...row };
  }

  async update(id: string, input: ServiceInput): Promise<ServiceItem> {
    await this.delay();
    this.assertUniqueName(input.name, id);
    const current = this.rows.find((s) => s.id === id);
    if (!current) throw new RepairOpsError('NOT_FOUND', 'That service was not found.');
    const row: ServiceItem = { ...current, ...input, name: input.name.trim(), updated_at: new Date().toISOString() };
    this.rows = this.rows.map((s) => (s.id === id ? row : s));
    return { ...row };
  }

  setActive(id: string, active: boolean): Promise<ServiceItem> {
    const current = this.rows.find((s) => s.id === id);
    if (!current) return Promise.reject(new RepairOpsError('NOT_FOUND', 'That service was not found.'));
    return this.update(id, {
      name: current.name,
      description: current.description,
      base_price: current.base_price,
      active,
    });
  }
}

@Injectable()
export class SupabaseServiceCatalogRepository extends ServiceCatalogRepository {
  private readonly config = inject(REPAIR_OPS_CONFIG);

  private get db() {
    return getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
  }

  async list(): Promise<ServiceItem[]> {
    const { data, error } = await this.db.from('services').select('*').order('name', { ascending: true });
    if (error) throw mapPostgrestError(error);
    return data ?? [];
  }

  async add(input: ServiceInput): Promise<ServiceItem> {
    const { data, error } = await this.db
      .from('services')
      .insert({ ...input, name: input.name.trim() })
      .select('*')
      .single();
    if (error) throw mapPostgrestError(error);
    return data;
  }

  async update(id: string, input: ServiceInput): Promise<ServiceItem> {
    const { data, error } = await this.db
      .from('services')
      .update({ ...input, name: input.name.trim() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw mapPostgrestError(error);
    return data;
  }

  async setActive(id: string, active: boolean): Promise<ServiceItem> {
    const { data, error } = await this.db
      .from('services')
      .update({ active })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw mapPostgrestError(error);
    return data;
  }
}
