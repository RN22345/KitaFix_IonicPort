import { ChangeDetectorRef, Component, NgZone, OnDestroy, inject } from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';

import {
  AccountsAuthService,
  accountLoginDestination,
  authMessage,
} from '../../services/accounts-auth';
import { timeLoginStage } from '../../services/login-timing';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.scss',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    ReactiveFormsModule,
  ],
})
export class LoginPage implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly cooldownKey = 'kitafix.login.cooldown';
  private readonly cooldownMs = 10 * 60 * 1000;
  private failedAttempts = 0;
  private lockExpiresAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  private pageActive = false;
  remainingSeconds = 0;

  get locked(): boolean {
    return this.remainingSeconds > 0;
  }

  get countdown(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === this.cooldownKey || event.key === null) {
      this.restoreCooldown();
    }
  };

  private readonly onResume = () => {
    if (document.visibilityState === 'visible') this.restoreCooldown();
  };

  private persistCooldown() {
    try {
      localStorage.setItem(this.cooldownKey, JSON.stringify({
        failedAttempts: this.failedAttempts,
        lockExpiresAt: this.lockExpiresAt,
      }));
    } catch {
      // Keep the in-memory cooldown if browser storage is unavailable.
    }
  }

  private resetCooldown() {
    this.failedAttempts = 0;
    this.lockExpiresAt = 0;
    this.remainingSeconds = 0;
    this.stopTimer();
    this.persistCooldown();
  }

  private restoreCooldown() {
    try {
      const raw = localStorage.getItem(this.cooldownKey);
      const saved = raw ? JSON.parse(raw) : null;
      this.failedAttempts = Number.isInteger(saved?.failedAttempts)
        && saved.failedAttempts >= 0 && saved.failedAttempts <= 3
        ? saved.failedAttempts : 0;
      this.lockExpiresAt = Number.isFinite(saved?.lockExpiresAt)
        && saved.lockExpiresAt > 0 ? saved.lockExpiresAt : 0;
    } catch {
      // Retain the current state if browser storage is unavailable.
    }
    this.updateCountdown();
    this.stopTimer();
    if (this.locked && this.pageActive) {
      this.timer = setInterval(() => {
        this.zone.run(() => this.updateCountdown());
      }, 1000);
    }
  }

  private updateCountdown() {
    this.remainingSeconds = Math.max(
      0, Math.ceil((this.lockExpiresAt - Date.now()) / 1000)
    );
    if (this.lockExpiresAt && !this.locked) this.resetCooldown();
    this.changeDetector.markForCheck();
  }

  private stopTimer() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  ionViewWillLeave() {
    this.pageActive = false;
    this.stopTimer();
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('focus', this.onResume);
    document.removeEventListener('visibilitychange', this.onResume);
  }

  ngOnDestroy() {
    this.ionViewWillLeave();
  }

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AccountsAuthService);

  showPassword = false;
  busy = false;
  error = '';
  invalidCredentials = false;
  get remainingAttempts(): number {
    return Math.max(0, 3 - this.failedAttempts);
  }
  notice = '';

  form = this.fb.nonNullable.group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
      ],
    ],
    password: ['', Validators.required],
  });

  ionViewWillEnter() {
    this.invalidCredentials = false;
    this.pageActive = true;
    this.restoreCooldown();
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('focus', this.onResume);
    document.addEventListener('visibilitychange', this.onResume);
    const accessError = this.router.parseUrl(this.router.url).queryParams['accessError'];
    this.error = accessError === 'forbidden'
      ? 'Your assigned role does not have access to this page.'
      : accessError === 'unavailable'
        ? 'Please sign in. Your active account and assigned role must be verified to access this page.'
        : '';

    this.notice = history.state?.passwordReset
      ? 'Password updated. Sign in with your new password.'
      : history.state?.accountCreated
        ? 'Account created. Log in to continue.'
        : '';
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);

    return !!control &&
      control.invalid &&
      control.touched;
  }

  async submit() {
    if (this.busy) return;
    this.restoreCooldown();
    if (this.locked) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.invalidCredentials = false;
    this.error = '';
    this.notice = '';

    let authenticated = false;
    try {
      const { email, password } =
        this.form.getRawValue();

      const role = await this.auth.login(email, password);
      authenticated = true;
      this.resetCooldown();

      this.form.controls.password.reset();

      await timeLoginStage('navigation', () => this.router.navigate(
        [accountLoginDestination(role)],
        { replaceUrl: true }
      ));
    } catch (error) {
      if (!authenticated &&
        (error as { code?: string } | null)?.code === 'invalid_credentials') {
        this.restoreCooldown();
        if (!this.locked) {
          this.failedAttempts += 1;
          if (this.failedAttempts >= 3) {
            this.lockExpiresAt = Date.now() + this.cooldownMs;
          }
          this.persistCooldown();
          this.restoreCooldown();
        }
      }
      this.error = authMessage(error);
      if (!authenticated &&
        (error as { code?: string } | null)?.code === 'invalid_credentials') {
        this.invalidCredentials = true;
        this.error = 'Unable to log in. Check your email and password. If you don’t have an account yet, sign up.';
      }
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }
}
