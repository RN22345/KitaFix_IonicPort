import { inject, isDevMode } from '@angular/core';
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
  // inject() must be called before the first await, otherwise Angular throws
  // NG0203 (no injection context after an async boundary).
  const router = inject(Router);

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

  return router.createUrlTree(['/dev-login']);
};

export const homeRouteGuard: CanActivateFn = async () => {
  const router = inject(Router);

  if (environment.useMockData) {
    const destination = environment.staffPreviewMode && isDevMode()
      ? '/staff/admin-portal'
      : '/tabs';
    return router.createUrlTree([destination]);
  }

  try {
    const db = getSupabaseClient(environment.supabaseUrl, environment.supabaseAnonKey);
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    const session = sessionData.session;
    if (sessionError || !session) {
      return router.createUrlTree(['/dev-login']);
    }

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role, active')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profileError || !profile?.active) {
      return router.createUrlTree(['/dev-login']);
    }

    if (environment.staffPreviewMode && isDevMode()) {
      return router.createUrlTree(['/staff/admin-portal']);
    }

    const { data: isStaff, error: roleError } = await db.rpc('is_staff');
    const staffRole = profile.role === 'staff' || profile.role === 'admin';
    return !roleError && isStaff === true && staffRole
      ? router.createUrlTree(['/staff/admin-portal'])
      : router.createUrlTree(['/tabs']);
  } catch {
    return router.createUrlTree(['/dev-login']);
  }
};
