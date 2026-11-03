import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
      const { error } = await db.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });
      if (error) {
        this.error.set(error.message);
        return;
      }
      await this.router.navigateByUrl('/tabs', { replaceUrl: true });
    } catch (caught) {
      this.error.set(caught instanceof Error ? caught.message : 'Sign in failed.');
    } finally {
      this.loading.set(false);
    }
  }
}