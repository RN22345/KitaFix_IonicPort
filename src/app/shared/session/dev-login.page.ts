import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonNote,
  IonSpinner,
} from '@ionic/angular';
import { getSupabaseClient } from '@kitafix/booking';
import { environment } from '../../../environments/environment';

/**
 * DEV ONLY. Team 1 owns the real Login screen.
 *
 * This page exists so Team 2 can test the real Supabase database before the
 * identity module is finished. It is never shown in mock mode (the guard lets
 * mock sessions straight through).
 *
 * Styled after the KitaFix moodboard login. Markup lives in
 * dev-login.page.html, styles in dev-login.page.scss.
 */
@Component({
  selector: 'app-dev-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonButton, IonContent, IonIcon, IonInput, IonNote, IonSpinner],
  templateUrl: './dev-login.page.html',
  styleUrl: './dev-login.page.scss',
})
export class DevLoginPage {

  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  email = '';
  password = '';

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  /** Forgot password / Sign up belong to Team 1's identity module. */
  teamOneOnly(): void {
    this.error.set('Forgot password and Sign up come with Team 1\u2019s Login screen.');
  }

  async signIn(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Enter an email and a password.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const db = getSupabaseClient(environment.supabaseUrl, environment.supabaseAnonKey);
      const { error: signInError } = await db.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });
      if (signInError) {
        this.error.set(signInError.message);
        return;
      }

      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session) {
        await db.auth.signOut();
        this.error.set('Could not verify the signed-in account. Please try again.');
        return;
      }

      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('role, active')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profileError || !profile?.active) {
        await db.auth.signOut();
        this.error.set('This account is inactive or has no profile. Contact an administrator.');
        return;
      }

      if (environment.staffPreviewMode && isDevMode()) {
        await this.router.navigateByUrl('/staff/admin-portal', { replaceUrl: true });
        return;
      }

      const { data: isStaff, error: roleError } = await db.rpc('is_staff');
      if (roleError) {
        await db.auth.signOut();
        this.error.set('Could not verify this account role. Please try again.');
        return;
      }

      const staffRole = profile.role === 'staff' || profile.role === 'admin';
      const destination = isStaff === true && staffRole
        ? '/staff/admin-portal'
        : '/tabs/dashboard';
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    } catch (caught) {
      this.error.set(caught instanceof Error ? caught.message : 'Sign in failed.');
    } finally {
      this.loading.set(false);
    }
  }
}