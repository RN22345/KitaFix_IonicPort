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

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.scss',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    ReactiveFormsModule,
  ],
})
export class ForgotPasswordPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AccountsAuthService);

  busy = signal(false); // true while the code is being sent (the button shows "Sending...")
  error = signal(''); // shown above the form when something goes wrong

  form = this.fb.nonNullable.group({
    email: ['', [
      Validators.required,
      Validators.email,
    ]],
  });

  get emailInvalid(): boolean {
    const email = this.form.controls.email;

    return email.invalid && email.touched;
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
      const email =
        this.form.getRawValue().email.trim();

      await this.auth.sendResetCode(email);

      await this.router.navigate(
        ['/accounts-verify-email'],
        {
          state: {
            email,
            purpose: 'reset',
            sentAt: Date.now(),
          },
        }
      );
    } catch (error) {
      this.error.set(authMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}