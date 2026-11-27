import { AbstractControl, ValidationErrors } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 8;

// The checklist shown under the password field (length is checked separately, with an error message)
export function getPasswordRules(value: string) {
  return [
    { label: 'Uppercase letter', met: /[A-Z]/.test(value) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(value) },
    { label: 'Number', met: /\d/.test(value) },
  ];
}

export function passwordPolicy(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null; // empty is handled by Validators.required

  const allMet = getPasswordRules(value).every(rule => rule.met);
  return value.length >= PASSWORD_MIN_LENGTH && allMet ? null : { policy: true };
}

// Used by the forms that have "password" and "confirmPassword"
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}