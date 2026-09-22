import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { getSupabaseClient } from '@kitafix/booking';
import { environment } from '../../../environments/environment';

/**
 * DEV ONLY. Team 1 owns the real Login screen.
 *
 * This page exists so Team 2 can test the real Supabase database before the
 * identity module is finished. It is never shown in mock mode (the guard lets
 * mock sessions straight through).
 */
@Component({
  selector: 'app-dev-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonInput,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>Dev login (Team 2 only)</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-content>
          <p class="hint">
            Temporary sign-in for testing the real database. The real Login screen
            belongs to Team 1 (libs/identity).
          </p>

          <ion-input
            label="Email"
            labelPlacement="stacked"
            type="email"
            placeholder="customer@kitafix.test"
            [(ngModel)]="email"
          ></ion-input>

          <ion-input
            label="Password"
            labelPlacement="stacked"
            type="password"
            [(ngModel)]="password"
          ></ion-input>

          @if (error(); as message) {
            <ion-note color="danger">{{ message }}</ion-note>
          }

          <ion-button expand="block" [disabled]="loading()" (click)="signIn()">
            @if (loading()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              Sign in
            }
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: [
    `
      .hint {
        color: var(--ion-color-medium);
        font-size: 0.9rem;
      }
      ion-note {
        display: block;
        padding: 0.5rem 0;
      }
      ion-button {
        margin-top: 0.75rem;
      }
    `,
  ],
})
export class DevLoginPage {
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  email = '';
  password = '';

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
