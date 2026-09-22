import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getSupabaseClient } from '@kitafix/booking';
import { environment } from '../../../environments/environment';

/**
 * PLACEHOLDER guard. Team 1 owns the real route guard (role model), this one
 * is only here so the module runs alone.
 *
 * Mock mode: there is always a placeholder session -> allow.
 * Real mode: read the Supabase Auth session -> otherwise go to /dev-login.
 */
export const authGuard: CanActivateFn = async () => {
  if (environment.useMockData) {
    return true;
  }

  try {
    const db = getSupabaseClient(environment.supabaseUrl, environment.supabaseAnonKey);
    const { data } = await db.auth.getSession();
    if (data.session) {
      return true;
    }
  } catch {
    // Supabase not configured yet: fall through to the dev login screen.
  }

  return inject(Router).createUrlTree(['/dev-login']);
};
