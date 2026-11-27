import { Component, inject, signal } from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';

import {
  AccountsAuthService,
  authMessage,
} from '../../services/accounts-auth';

import {
  getPasswordRules,
  passwordPolicy,
  passwordsMatch,
} from '../../validators/password';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    ReactiveFormsModule,
  ],
})
export class ResetPasswordPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AccountsAuthService);

  showPassword = false;
  busy = signal(false); // true while we wait for Supabase (the button shows "Saving...")
  error = signal(''); // shown above the form when something goes wrong

  form = this.fb.nonNullable.group(
    {
      password: ['', [
        Validators.required,
        passwordPolicy,
      ]],

      confirmPassword: [
        '',
        Validators.required,
      ],
    },
    {
      validators: passwordsMatch,
    }
  );

  get passwordRules() {
    return getPasswordRules(
      this.form.controls.password.value
    );
  }

  get passwordsDontMatch(): boolean {
    return this.form.hasError('mismatch') &&
      this.form.controls.confirmPassword.touched;
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);

    return !!control &&
      control.invalid &&
      control.touched;
  }

  async submit() {
    if (this.busy()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set('');

    try {
      await this.auth.resetPassword(
        this.form.getRawValue().password
      );

      this.form.reset();

      await this.router.navigate(
        ['/accounts-login'],
        {
          replaceUrl: true,
          state: {
            passwordReset: true,
          },
        }
      );
    } catch (error) {
      console.error('Reset password failed:', error);
      this.error.set(authMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}