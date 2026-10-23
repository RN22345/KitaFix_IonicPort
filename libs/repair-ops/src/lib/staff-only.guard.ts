import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getSupabaseClient } from '@kitafix/booking';
import { REPAIR_OPS_CONFIG } from './data-access/config';

export const staffOnlyGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const config = inject(REPAIR_OPS_CONFIG);
  const denied = router.createUrlTree(['/tabs']);
  const previewMode = config.staffPreviewMode === true && isDevMode();

  if (config.useMockData) {
    return previewMode ? true : denied;
  }

  try {
    const db = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    const session = sessionData.session;
    if (sessionError || !session) {
      return router.createUrlTree(['/dev-login']);
    }

    if (previewMode) {
      return true;
    }

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role, active')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profileError || !profile?.active) {
      return denied;
    }

    const { data: isStaff, error } = await db.rpc('is_staff');
    const staffRole = profile.role === 'staff' || profile.role === 'admin';
    return !error && isStaff === true && staffRole ? true : denied;
  } catch {
    return denied;
  }
};