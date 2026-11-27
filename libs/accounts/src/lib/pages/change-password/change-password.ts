import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { AccountsAuthService, authMessage } from '../../services/accounts-auth';
import { getPasswordRules, passwordPolicy, passwordsMatch } from '../../validators/password';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  styleUrl: '../../styles/accounts.scss',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink, ReactiveFormsModule],
})
export class ChangePasswordPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AccountsAuthService);

  showPassword = false;
  saving = signal(false); // true while we wait for Supabase (the button shows "Saving...")
  errorMsg = signal(''); // shown above the button when something goes wrong
  showSuccess = signal(false); // shows the "Password changed" box
  otherDevicesLoggedOut = signal(true); // false if we couldn't log out the other devices

  // The field names "password" and "confirmPassword" are used by the shared passwordsMatch validator
  form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      password: ['', [Validators.required, passwordPolicy]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [passwordsMatch] },
  );

  // The password checklist (8+ characters, 1 uppercase, 1 special character)
  get passwordRules() {
    return getPasswordRules(this.form.controls.password.value);
  }

  // True when the two new passwords are different and the user already touched "confirm"
  get passwordsDontMatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirmPassword.touched;
  }

  // True when a field has an error AND the user already touched it
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  // Runs when the form is submitted
  async submit() {
    this.errorMsg.set('');
    if (this.saving()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const { currentPassword, password } = this.form.getRawValue();
      this.otherDevicesLoggedOut.set(await this.auth.changePassword(currentPassword, password));
      this.showSuccess.set(true);
    } catch (error) {
      console.error('Change password failed:', error);
      this.errorMsg.set(error instanceof Error ? error.message : authMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  closeSuccess() {
    this.showSuccess.set(false);
    this.router.navigate(['/accounts-my-account']);
  }
}