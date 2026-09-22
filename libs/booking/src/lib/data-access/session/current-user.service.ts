import { Injectable, Signal, inject, signal } from '@angular/core';
import { BookingError } from '../../models/booking-error';
import { CurrentUser } from '../../models/current-user.model';
import { BOOKING_CONFIG } from '../config';
import { MOCK_CURRENT_USER } from '../mock/mock-profile.data';
import { mapPostgrestError } from '../postgrest-errors';
import { getSupabaseClient } from '../supabase-client';

/**
 * Who is signed in.
 *
 * In mock mode this returns the .ts placeholder profile (no login needed).
 * In real mode it reads the Supabase Auth session (Team 1 owns auth) and then
 * the profiles row for the display name and role.
 *
 * Trap carried from the old build: never build a query without the session
 * user id (Module Plan v4, section 11).
 */
export abstract class CurrentUserService {
  abstract readonly user: Signal<CurrentUser | null>;
  abstract load(): Promise<CurrentUser>;
}

@Injectable()
export class MockCurrentUserService extends CurrentUserService {
  readonly user = signal<CurrentUser | null>(MOCK_CURRENT_USER);

  async load(): Promise<CurrentUser> {
    this.user.set(MOCK_CURRENT_USER);
    return MOCK_CURRENT_USER;
  }
}

@Injectable()
export class SupabaseCurrentUserService extends CurrentUserService {
  private readonly config = inject(BOOKING_CONFIG);
  readonly user = signal<CurrentUser | null>(null);

  async load(): Promise<CurrentUser> {
    const db = getSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);

    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData.user) {
      throw new BookingError('NOT_ALLOWED', 'You are not signed in. Please sign in first.');
    }

    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', authData.user.id)
      .single();

    if (error) {
      throw mapPostgrestError(error);
    }

    const user: CurrentUser = {
      id: data.id,
      full_name: data.full_name,
      email: authData.user.email ?? null,
      role: data.role,
    };
    this.user.set(user);
    return user;
  }
}
